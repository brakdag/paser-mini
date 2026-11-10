import fs from "fs/promises";
import path from "path";
import PathValidator from "../utils/pathValidator.js";

const FILE_SIZE_LIMIT = 100 * 1024;

/**
 * Provides tools for file operations.
 */
class FileTools {
  #paths;

  /**
   * Binds file operations to one project path policy.
   * @param {object} [options] - Tool dependencies.
   * @param {PathValidator|typeof PathValidator} [options.pathValidator] - Project policy.
   */
  constructor({ pathValidator = PathValidator } = {}) {
    this.#paths = pathValidator;
  }

  /**
   * Pure logic for text replacement.
   * @param {string} content The content to search in.
   * @param {string} searchText The text to find.
   * @param {string} replaceText The text to replace it with.
   * @returns {string} The modified content.
   * @throws {Error} If text is not found or multiple occurrences exist.
   */
  #performReplace(content, searchText, replaceText) {
    if (!content.includes(searchText)) {
      throw new Error("Not found");
    }
    if (content.split(searchText).length > 2) {
      throw new Error("Multiple results");
    }
    return content.replace(searchText, () => replaceText);
  }

  /**
   * Reads the full content of a file if it's within size limits.
   * @param {string} safePath The absolute path to the file.
   * @returns {Promise<string>} The file contents.
   */
  async #readFull(safePath) {
    const stats = await fs.stat(safePath);
    if (stats.size > FILE_SIZE_LIMIT) {
      throw new Error("File too large");
    }
    return fs.readFile(safePath, "utf8");
  }

  /**
   * Reads the last N lines of a file.
   * @param {string} safePath The absolute path to the file.
   * @param {string|number} tail Number of lines to tail.
   * @returns {Promise<string>} The tailed content.
   */
  async #readTail(safePath, tail) {
    const numericTail = parseInt(String(tail), 10);
    if (Number.isNaN(numericTail)) {
      throw new Error("tail must be a number");
    }
    if (numericTail <= 0) {
      return "";
    }

    const stats = await fs.stat(safePath);
    if (stats.size === 0) {
      return "";
    }

    const handle = await fs.open(safePath, "r");
    try {
      // Grow the window until it holds enough lines or reaches the file start.
      // A fixed window would return a fragment of a line when the file is
      // larger than the window.
      const bufferSize = 64 * 1024;
      let length = Math.min(stats.size, bufferSize);
      let lines = [];
      let reachedStart = false;

      for (;;) {
        const start = stats.size - length;
        reachedStart = start === 0;

        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, start);
        let content = buffer.subarray(0, bytesRead).toString("utf8");

        if (!reachedStart) {
          // The window began mid-line; discard that partial line. If the
          // window holds no newline at all, it is entirely partial.
          const firstBreak = content.indexOf("\n");
          if (firstBreak === -1) {
            content = "";
          } else {
            content = content.slice(firstBreak + 1);
          }
        }

        // Remove only the final terminator before splitting. A complete empty
        // line must remain [""], while an empty window has no lines.
        lines = content === "" ? [] : content.replace(/\n$/, "").split("\n");

        if (reachedStart || lines.length >= numericTail) {
          break;
        }
        // Bound the window. The result may not exceed FILE_SIZE_LIMIT, and at
        // most one chunk of the window is a discarded partial leading line, so
        // a window larger than FILE_SIZE_LIMIT + chunk cannot be needed: if
        // the requested lines do not fit, the result is over the limit.
        // Without this cap a large newline-free file was fully buffered before
        // the size check rejected it.
        const maxWindow = FILE_SIZE_LIMIT + bufferSize;
        if (length >= maxWindow) {
          throw new Error("Tail result too large");
        }
        length = Math.min(stats.size, Math.min(length * 2, maxWindow));
      }

      const result = lines.slice(-numericTail).join("\n");

      if (Buffer.byteLength(result, "utf8") > FILE_SIZE_LIMIT) {
        throw new Error("Tail result too large");
      }
      return result;
    } finally {
      await handle.close();
    }
  }

  /**
   * Reads the contents of a file.
   * @param {string} filePath The path to the file.
   * @returns {Promise<string>} The file contents.
   */
  async read(filePath) {
    const safePath = this.#paths.getSafePath(filePath);
    return this.#readFull(safePath);
  }

  /**
   * Reads the last N lines of a file.
   *
   * Omits the final line terminator and preserves empty lines, so "a\nb\n"
   * tailed by 1 yields "b", while "a\n\n" tailed by 2 yields "a\n".
   * Asking for more lines than exist returns all lines within the size limit.
   * @param {string} filePath The path to the file.
   * @param {string|number} tail Number of lines to tail from the end.
   * @returns {Promise<string>} The tailed content.
   */
  async tail(filePath, tail) {
    const safePath = this.#paths.getSafePath(filePath);
    return this.#readTail(safePath, tail);
  }

  /**
   * Writes content to a file, creating parent directories if needed.
   * @param {string} filePath The file path.
   * @param {string} content The content to write.
   */
  async write(filePath, content) {
    if (Buffer.byteLength(content, "utf8") > FILE_SIZE_LIMIT) {
      throw new Error("Content too large");
    }
    const safePath = this.#paths.getSafeMutationPath(filePath);
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, "utf8");
  }

  /**
   * Lists the contents of a directory.
   * @param {string} dirPath The path of the directory to list.
   * @returns {Promise<string>} A newline-separated string of contents.
   */
  async list(dirPath = ".") {
    const files = await fs.readdir(this.#paths.getSafePath(dirPath));
    return files.join("\n");
  }

  /**
   * Removes a file or directory recursively.
   * @param {string} filePath The path to remove.
   */
  async remove(filePath) {
    const safePath = this.#paths.getSafeMutationPath(filePath, { operation: "remove", recursive: true });
    await fs.rm(safePath, { recursive: true });
  }

  /**
   * Renames or moves a file or directory.
   * @param {string} origin The source path.
   * @param {string} destination The target path.
   */
  async rename(origin, destination) {
    const safeOrigin = this.#paths.getSafeMutationPath(origin, { operation: "move", recursive: true });
    const safeDestination = this.#paths.getSafeMutationPath(destination, { operation: "overwrite", recursive: true });
    await fs.rename(safeOrigin, safeDestination);
  }

  /**
   * Creates a directory recursively.
   * @param {string} dirPath The directory path to create.
   */
  async mkdir(dirPath) {
    await fs.mkdir(this.#paths.getSafeMutationPath(dirPath), { recursive: true });
  }

  /**
   * Replaces the first occurrence of text in a file.
   * @param {string} filePath The file path.
   * @param {string} searchText The text to find.
   * @param {string} replaceText The text to replace it with.
   */
  async replace(filePath, searchText, replaceText) {
    const safePath = this.#paths.getSafeMutationPath(filePath);
    const content = await fs.readFile(safePath, "utf8");
    const newContent = this.#performReplace(content, searchText, replaceText);
    await fs.writeFile(safePath, newContent, "utf8");
  }

  /**
   * Appends the source file bytes to the destination, within the text tool limit.
   * @param {string} destination The destination file path.
   * @param {string} source The source file path.
   */
  async concat(destination, source) {
    const safeDestination = this.#paths.getSafeMutationPath(destination);
    const safeSource = this.#paths.getSafePath(source);
    const sourceStats = await fs.stat(safeSource);
    let destinationStats;
    try {
      destinationStats = await fs.stat(safeDestination);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (destinationStats && sourceStats.dev === destinationStats.dev &&
        sourceStats.ino === destinationStats.ino) throw new Error("Cannot concatenate a file into itself");
    if (sourceStats.size + (destinationStats?.size || 0) > FILE_SIZE_LIMIT) {
      throw new Error("Concatenated file too large");
    }
    const content = await fs.readFile(safeSource);
    await fs.appendFile(safeDestination, content);
  }

  /**
   * Performs a regular expression search and replace on a file.
   * @param {string} filePath The file path.
   * @param {string} pattern The regular expression pattern.
   * @param {string} replacement The replacement string.
   * @param {string} flags The regular expression flags.
   */
  async sed(filePath, pattern, replacement = "", flags = "g") {
    const safePath = this.#paths.getSafeMutationPath(filePath);
    const content = await fs.readFile(safePath, "utf8");
    const regex = new RegExp(pattern, flags);
    const newContent = content.replace(regex, replacement);
    if (newContent === content) {
      throw new Error("Pattern not found in file.");
    }
    await fs.writeFile(safePath, newContent, "utf8");
  }

  /**
   * Copies a file from origin to destination.
   * @param {string} origin The source file path.
   * @param {string} destination The destination file path.
   */
  async copy(origin, destination) {
    await fs.copyFile(
      this.#paths.getSafePath(origin),
      this.#paths.getSafeMutationPath(destination),
    );
  }
}

export default FileTools;
