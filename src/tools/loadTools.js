import fs from "fs/promises";
import path from "path";

const FILE_SIZE_LIMIT = 100 * 1024;
const BOUNDARY = "---çç";

/**
 * Provides tools for efficient file indexing and batch loading.
 */
class LoadTools {
  /**
   * Resolves and verifies that a path is safely within the project root.
   * @param {string} inputPath The path to verify.
   * @returns {string} The safe absolute path.
   */
  #getSafePath(inputPath) {
    const resolved = path.resolve(process.cwd(), inputPath);
    if (!resolved.startsWith(process.cwd())) {
      throw new Error("Security Error: Path is outside of project root");
    }
    return resolved;
  }

  /**
   * Parses .gitignore and returns a set of ignore patterns.
   * @param {string} baseDir The directory containing .gitignore.
   * @returns {Promise<string[]>} Array of gitignore patterns.
   */
  async #parseGitignore(baseDir) {
    const gitignorePath = path.join(baseDir, ".gitignore");
    try {
      const content = await fs.readFile(gitignorePath, "utf8");
      return content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    } catch {
      return [];
    }
  }

  /**
   * Checks if a relative path matches any gitignore pattern.
   * @param {string} relPath The relative path from project root.
   * @param {string[]} patterns The gitignore patterns.
   * @returns {boolean} True if the path should be ignored.
   */
  #isIgnored(relPath, patterns) {
    const normalized = relPath.replace(/\\/g, "/");
    for (let i = 0; i < patterns.length; i += 1) {
      const cleanPattern = patterns[i].replace(/\\/g, "/").replace(/\/$/, "");
      if (cleanPattern.startsWith("/")) {
        const p = cleanPattern.slice(1);
        if (normalized === p || normalized.startsWith(`${p}/`)) return true;
      } else {
        const parts = normalized.split("/");
        for (let j = 0; j < parts.length; j += 1) {
          if (parts.slice(j).join("/") === cleanPattern) return true;
          if (parts[j] === cleanPattern) return true;
        }
      }
    }
    return false;
  }

  /**
   * Recursively scans a directory and indexes files.
   * @param {string} dirPath The absolute directory path.
   * @param {string} baseDir The project root for relative paths.
   * @param {string[]} patterns The gitignore patterns.
   * @param {number} startId The starting ID counter.
   * @returns {Promise<{files: Array, nextId: number}>} Indexed files and next ID.
   */
  async #scanDirectory(dirPath, baseDir, patterns, startId) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];
    let currentId = startId;

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(baseDir, fullPath);

      if (!this.#isIgnored(relPath, patterns)) {
        if (entry.isDirectory()) {
          const result = await this.#scanDirectory(fullPath, baseDir, patterns, currentId);
          files.push(...result.files);
          currentId = result.nextId;
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          files.push({
            id: currentId,
            path: relPath,
            size: stats.size,
          });
          currentId += 1;
        }
      }
    }
    return { files, nextId: currentId };
  }

  /**
   * Indexes all files in a directory tree, respecting .gitignore.
   * @param {string} dirPath The root directory to index.
   * @returns {Promise<string>} JSON string with file index and total count.
   */
  async index(dirPath = ".") {
    const safePath = this.#getSafePath(dirPath);
    const patterns = await this.#parseGitignore(safePath);
    const { files } = await this.#scanDirectory(safePath, safePath, patterns, 0);
    return JSON.stringify({ total: files.length, files });
  }

  /**
   * Loads multiple files by their IDs and returns them as MIME multipart.
   * @param {string} ids Comma-separated file IDs (e.g., "0,3,5").
   * @returns {Promise<string>} MIME multipart formatted string with file contents.
   */
  async load(ids) {
    const idList = String(ids)
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id));

    if (idList.length === 0) {
      throw new Error("No valid IDs provided");
    }

    const indexData = JSON.parse(await this.index("."));
    const fileMap = new Map(indexData.files.map((f) => [f.id, f]));

    const parts = [];
    for (let i = 0; i < idList.length; i += 1) {
      const id = idList[i];
      const fileEntry = fileMap.get(id);
      if (!fileEntry) {
        parts.push(
          `${BOUNDARY}\nContent-ID: ${id}\nContent-Type: text/plain\nContent-Description: File not found\n\nError: File with ID ${id} not found in index.`
        );
      } else {
        const safePath = this.#getSafePath(fileEntry.path);
        const stats = await fs.stat(safePath);

        if (stats.size > FILE_SIZE_LIMIT) {
          parts.push(
            `${BOUNDARY}\nContent-ID: ${id}\nContent-Type: text/plain\nContent-Description: File too large\n\nError: File ${fileEntry.path} exceeds size limit of ${FILE_SIZE_LIMIT} bytes.`
          );
        } else {
          const content = await fs.readFile(safePath, "utf8");
          const ext = path.extname(fileEntry.path).slice(1).toLowerCase();
          const mimeTypes = {
            js: "text/javascript",
            json: "application/json",
            md: "text/markdown",
            txt: "text/plain",
            html: "text/html",
            css: "text/css",
            xml: "application/xml",
            yml: "text/yaml",
            yaml: "text/yaml",
          };
          const contentType = mimeTypes[ext] || "text/plain";

          parts.push(
            `${BOUNDARY}\nContent-ID: ${id}\nContent-Path: ${fileEntry.path}\nContent-Type: ${contentType}\nContent-Length: ${stats.size}\n\n${content}`
          );
        }
      }
    }

    return `${parts.join("\n")}\n${BOUNDARY}--\n`;
  }
}

export default LoadTools;