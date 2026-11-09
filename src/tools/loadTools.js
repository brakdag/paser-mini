import fs from "fs/promises";
import { constants } from "fs";
import path from "path";
import ignore from "ignore";
import PathValidator from "../utils/pathValidator.js";

const FILE_SIZE_LIMIT = 100 * 1024;
const IGNORE_SIZE_LIMIT = 64 * 1024;
const BOUNDARY = "---çç";
const INTERNAL_NAMES = new Set([".git", ".paser-mini", ".codex", ".agents", ".aws"]);
const DEFAULT_LIMITS = {
  maxIndexFiles: 1000,
  maxIndexEntries: 10000,
  maxIndexBytes: 512 * 1024,
  maxDepth: 64,
  maxBatchFiles: 50,
  maxBatchBytes: 512 * 1024,
};
const MIME_TYPES = {
  js: "text/javascript", json: "application/json", md: "text/markdown",
  txt: "text/plain", html: "text/html", css: "text/css", xml: "application/xml",
  yml: "text/yaml", yaml: "text/yaml",
};

/**
 * Compares the identity and modification metadata captured around a read.
 * @param {object} left Earlier file stats.
 * @param {object} right Later file stats.
 * @returns {boolean} Whether both describe the same unchanged regular file.
 */
function sameFile(left, right) {
  return right.isFile() && ["dev", "ino", "size", "mtimeMs", "ctimeMs"]
    .every((key) => left[key] === right[key]);
}

/**
 * Creates an error with a stable diagnostic code.
 * @param {string} code Diagnostic code.
 * @param {string} message Human-readable explanation.
 * @returns {Error} The coded error.
 */
function loadError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** Provides bounded file indexing and batch loading within one project. */
class LoadTools {
  #cachedIndex = null;

  #paths;

  #fs;

  #limits;

  /**
   * Binds indexing and loading to one stable project root.
   * @param {object} [options] Tool dependencies and resource limits.
   * @param {PathValidator|typeof PathValidator} [options.pathValidator] Project policy.
   * @param {object} [options.fileSystem] Promise-based filesystem implementation.
   * @param {object} [options.limits] Overrides of the documented index/batch limits.
   */
  constructor({ pathValidator = PathValidator, fileSystem = fs, limits = {} } = {}) {
    this.#paths = pathValidator;
    this.#fs = fileSystem;
    this.#limits = { ...DEFAULT_LIMITS, ...limits };
    Object.entries(this.#limits).forEach(([key, value]) => {
      if (!Object.hasOwn(DEFAULT_LIMITS, key) || !Number.isSafeInteger(value) || value < 1) {
        throw new Error(`Invalid load limit: ${key}`);
      }
    });
    if (this.#limits.maxIndexBytes < 2048 || this.#limits.maxBatchBytes < 1024 || this.#limits.maxDepth > 128) {
      throw new Error("Index/batch byte limits must be at least 2048/1024 and maxDepth at most 128");
    }
  }

  /**
   * Reads at most limit + 1 bytes from a regular file, closing on every outcome.
   * @param {string} filePath Validated path to open without following its final link.
   * @param {number} limit Maximum accepted input bytes.
   * @param {object|null} [expected] Optional indexed metadata to validate before reading.
   * @returns {Promise<Buffer>} Complete bytes of an unchanged file.
   */
  async #readBounded(filePath, limit, expected = null) {
    // Nonblocking open also prevents a replaced FIFO from hanging the tool.
    // eslint-disable-next-line no-bitwise -- These are independent POSIX open flags.
    const flags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
    const handle = await this.#fs.open(filePath, flags);
    try {
      const before = await handle.stat();
      if (!before.isFile() || (expected && !sameFile(expected, before))) {
        throw loadError("FILE_CHANGED", "File changed since indexing; run index() again.");
      }
      if (before.size > limit) throw loadError("FILE_TOO_LARGE", `File exceeds size limit of ${limit} bytes.`);
      const buffer = Buffer.alloc(limit + 1);
      let length = 0;
      let finished = false;
      while (!finished && length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        length += bytesRead;
        finished = bytesRead === 0;
      }
      const after = await handle.stat();
      if (!sameFile(before, after) || length !== before.size) {
        throw loadError("FILE_CHANGED", "File changed during reading; run index() again.");
      }
      if (length > limit) throw loadError("FILE_TOO_LARGE", `File exceeds size limit of ${limit} bytes.`);
      return buffer.subarray(0, length);
    } finally {
      await handle.close();
    }
  }

  /**
   * Adds this directory's .gitignore rules to the inherited layers.
   * @param {string} directory Canonical directory within the project.
   * @param {Array} layers Ancestor rule layers.
   * @param {string} root Canonical project root, including when its policy uses an alias.
   * @returns {Promise<Array>} Layers with this directory's rules, if present.
   */
  async #rules(directory, layers, root) {
    if (layers.at(-1)?.directory === directory) return layers;
    const safePath = this.#paths.getSafePath(path.relative(root, path.join(directory, ".gitignore")));
    let content;
    try {
      // Internal ignore-file symlinks keep working; external ones fail validation.
      const resolved = await this.#fs.realpath(safePath);
      content = await this.#readBounded(resolved, IGNORE_SIZE_LIMIT);
    } catch (error) {
      if (error.code === "ENOENT") return layers;
      const relative = path.join(path.relative(root, directory), ".gitignore");
      throw loadError(error.code || "IGNORE_ERROR", `Cannot read ${relative}: ${error.message}`);
    }
    return [...layers, { directory, matcher: ignore({ ignorecase: false }).add(content.toString("utf8")) }];
  }

  /**
   * Applies ancestor rules followed by more specific rules and negations.
   * @param {string} fullPath Candidate absolute path.
   * @param {boolean} directory Whether it is a directory.
   * @param {Array} layers Ordered ancestor .gitignore matchers.
   * @returns {boolean} Whether the candidate should be pruned.
   */
  #isIgnored(fullPath, directory, layers) {
    let ignored = false;
    layers.forEach((layer) => {
      const relative = path.relative(layer.directory, fullPath);
      const result = layer.matcher.test(`${relative}${directory ? "/" : ""}`);
      if (result.ignored) ignored = true;
      else if (result.unignored) ignored = false;
    });
    return ignored;
  }

  /**
   * Records a bounded diagnostic without letting error output bypass index limits.
   * @param {object} operation Mutable state for this index operation.
   * @param {string} relative Project-relative path.
   * @param {Error} error Failure to report.
   * @returns {void}
   */
  #diagnose(operation, relative, error) {
    const state = operation;
    const diagnostic = { path: relative, code: error.code || "INDEX_ERROR", message: error.message.slice(0, 512) };
    const bytes = Buffer.byteLength(JSON.stringify(diagnostic)) + 1;
    if (state.diagnostics.length < 50 && bytes <= state.remaining) {
      state.diagnostics.push(diagnostic);
      state.remaining -= bytes;
    } else {
      state.omittedDiagnostics += 1;
      state.truncated = true;
    }
  }

  /**
   * Traverses with bounded directory handles, output size, file count and entries.
   * @param {string} directory Validated directory.
   * @param {Array} inherited Ancestor ignore rules.
   * @param {object} operation Shared traversal limits, records and diagnostics.
   * @param {number} depth Depth relative to the project root.
   * @returns {Promise<void>} Resolves after scanning or reaching a limit.
   */
  async #scan(directory, inherited, operation, depth) {
    const state = operation;
    const relative = path.relative(state.root, directory);
    if (depth > this.#limits.maxDepth) {
      state.truncated = true;
      this.#diagnose(state, relative, loadError("DEPTH_LIMIT", "Directory depth limit reached."));
      return;
    }
    let handle;
    try {
      const layers = await this.#rules(directory, inherited, state.root);
      handle = await this.#fs.opendir(this.#paths.getSafePath(relative || "."));
      let entry = await handle.read();
      while (entry && !state.stopped) {
        if (state.visited >= this.#limits.maxIndexEntries) {
          state.stopped = true;
          state.truncated = true;
          this.#diagnose(state, relative, loadError("ENTRY_LIMIT", "Index entry limit reached; index a narrower directory."));
        } else {
          state.visited += 1;
          const fullPath = path.join(directory, entry.name);
          if (!INTERNAL_NAMES.has(entry.name) && !this.#isIgnored(fullPath, entry.isDirectory(), layers)) {
            if (entry.isDirectory()) await this.#scan(fullPath, layers, state, depth + 1);
            else if (entry.isFile()) await this.#indexFile(fullPath, state);
          }
          if (!state.stopped) entry = await handle.read();
        }
      }
    } catch (error) {
      // A failed rules read skips the subtree; scanning without its rules is unsafe.
      this.#diagnose(state, relative, error);
    } finally {
      if (handle) await handle.close();
    }
  }

  /**
   * Captures one file's metadata, with independent handling of disappearing files.
   * @param {string} fullPath Candidate absolute path.
   * @param {object} operation Index operation state.
   * @returns {Promise<void>} Resolves after recording or skipping the candidate.
   */
  async #indexFile(fullPath, operation) {
    const state = operation;
    const relative = path.relative(state.root, fullPath);
    const extension = path.extname(fullPath).slice(1).toLowerCase();
    if (state.extensions && !state.extensions.includes(extension)) return;
    try {
      const stats = await this.#fs.lstat(this.#paths.getSafePath(relative));
      if (!stats.isFile()) throw loadError("FILE_CHANGED", "File type changed during indexing.");
      const file = { id: state.files.length, path: relative, size: stats.size };
      const bytes = Buffer.byteLength(JSON.stringify(file)) + 1;
      if (state.files.length >= this.#limits.maxIndexFiles || bytes > state.remaining) {
        state.stopped = true;
        state.truncated = true;
        this.#diagnose(state, relative, loadError("INDEX_LIMIT", "Index file/output limit reached; index a narrower directory."));
      } else {
        state.files.push(file);
        state.snapshots.push({ ...file, stats });
        state.remaining -= bytes;
      }
    } catch (error) {
      this.#diagnose(state, relative, error);
    }
  }

  /**
   * Indexes files with nested .gitignore rules and permanent metadata exclusions.
   * @param {string} [dirPath] Directory within the project, defaulting to its root.
   * @param {string|null} [filter] Optional comma-separated extensions (e.g. "js,ts").
   * @returns {Promise<string>} Bounded JSON index with truncation and diagnostics.
   */
  async index(dirPath = ".", filter = null) {
    this.#cachedIndex = null;
    const directory = await this.#fs.realpath(this.#paths.getSafePath(dirPath));
    if (!(await this.#fs.stat(directory)).isDirectory()) throw loadError("ENOTDIR", "Index path must be a directory.");
    const root = await this.#fs.realpath(this.#paths.getRoot());
    const segments = path.relative(root, directory).split(path.sep).filter(Boolean);
    const state = {
      root, files: [], snapshots: [], diagnostics: [], omittedDiagnostics: 0,
      remaining: this.#limits.maxIndexBytes - 1024, visited: 0, stopped: false, truncated: false,
      extensions: filter ? String(filter).split(",").map((ext) => ext.trim().replace(/^\./, "").toLowerCase()).filter(Boolean) : null,
    };
    let layers = [];
    let current = root;
    let excluded = false;
    if (segments.length > this.#limits.maxDepth) {
      excluded = true;
      state.truncated = true;
      this.#diagnose(state, path.relative(root, directory), loadError("DEPTH_LIMIT", "Directory depth limit reached."));
    }
    // Build ancestor rules even when the caller starts indexing a subdirectory.
    for (let i = 0; i < segments.length && !excluded; i += 1) {
      layers = await this.#rules(current, layers, root);
      current = path.join(current, segments[i]);
      excluded = INTERNAL_NAMES.has(segments[i]) || this.#isIgnored(current, true, layers);
    }
    // Validate root rules before scanning so invalid external rule symlinks reject.
    if (!segments.length) layers = await this.#rules(root, [], root);
    if (!excluded) await this.#scan(directory, layers, state, segments.length);
    this.#cachedIndex = state.snapshots;
    return JSON.stringify({
      total: state.files.length, files: state.files, truncated: state.truncated,
      diagnostics: state.diagnostics, omittedDiagnostics: state.omittedDiagnostics,
    });
  }

  /**
   * Formats one MIME part, escaping file names so they cannot inject headers.
   * @param {number} id Indexed file identifier.
   * @param {string} relative File path or diagnostic label.
   * @param {string} content Text body.
   * @param {boolean} [error] Whether this is a diagnostic instead of file content.
   * @returns {string} MIME part with its encoded body's actual byte length.
   */
  #part(id, relative, content, error = false) {
    const safeName = JSON.stringify(relative).slice(1, -1);
    const type = error ? "text/plain" : MIME_TYPES[path.extname(relative).slice(1).toLowerCase()] || "text/plain";
    return `${BOUNDARY}\nContent-ID: ${id}\nContent-Path: ${safeName}\nContent-Type: ${type}\nContent-Length: ${Buffer.byteLength(content)}\n\n${content}`;
  }

  /**
   * Loads a bounded batch; stale, missing and unreadable files become MIME diagnostics.
   * @param {string} ids Comma-separated file IDs (e.g. "0,3,5").
   * @returns {Promise<string>} Bounded multipart contents with any per-file errors.
   */
  async load(ids) {
    const input = String(ids).trim();
    if (input.length > this.#limits.maxBatchFiles * 32) throw new Error("ID request too large; use a smaller batch.");
    if (!/^\d+(?:\s*,\s*\d+)*$/.test(input)) throw new Error("No valid IDs provided; use comma-separated nonnegative integers.");
    const requested = input.split(",").map(Number);
    if (requested.some((id) => !Number.isSafeInteger(id))) throw new Error("No valid IDs provided; ID exceeds integer range.");
    if (requested.length > this.#limits.maxBatchFiles) throw new Error(`Batch exceeds ${this.#limits.maxBatchFiles} IDs; use a smaller batch.`);
    const idList = [...new Set(requested)];
    if (!this.#cachedIndex) throw new Error("No index available. Run index() first.");
    const fileMap = new Map(this.#cachedIndex.map((file) => [file.id, file]));
    const parts = [];
    let remaining = this.#limits.maxBatchBytes - 512;
    let truncated = false;
    for (let i = 0; i < idList.length && !truncated; i += 1) {
      const id = idList[i];
      const file = fileMap.get(id);
      let part;
      try {
        if (!file) throw loadError("NOT_IN_INDEX", `File with ID ${id} not found in index.`);
        const safePath = this.#paths.getSafePath(file.path);
        const content = await this.#readBounded(safePath, FILE_SIZE_LIMIT, file.stats);
        part = this.#part(id, file.path, content.toString("utf8"));
      } catch (error) {
        part = this.#part(id, file?.path || "File not found", `Error [${error.code || "LOAD_ERROR"}]: ${error.message.slice(0, 512)}`, true);
      }
      const bytes = Buffer.byteLength(part) + 1;
      if (bytes > remaining) truncated = true;
      else {
        parts.push(part);
        remaining -= bytes;
      }
    }
    if (truncated) {
      parts.push(this.#part(-1, "Batch truncated", `Batch byte limit of ${this.#limits.maxBatchBytes} reached. Remaining IDs omitted; request a smaller batch.`, true));
    }
    return `${parts.join("\n")}\n${BOUNDARY}--\n`;
  }
}

export default LoadTools;
