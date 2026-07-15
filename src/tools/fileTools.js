import fs from "fs/promises";
import path from "path";
import PathValidator from "../utils/pathValidator.js";

const FILE_SIZE_LIMIT = 100 * 1024;

/**
 * Provides tools for file operations.
 */
class FileTools {
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
    return content.replace(searchText, replaceText);
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
    const numericTail = parseInt(tail, 10);
    if (Number.isNaN(numericTail)) {
      throw new Error("tail must be a number");
    }
    if (numericTail <= 0) {
      return "";
    }

    const stats = await fs.stat(safePath);
    const bufferSize = 64 * 1024;
    const start = Math.max(0, stats.size - bufferSize);
    const length = stats.size - start;

    const handle = await fs.open(safePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);
      const content = buffer.toString("utf8");
      const result = content.split("\n").slice(-numericTail).join("\n");

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
   * @param {string} filepath The path to the file.
   * @returns {Promise<string>} The file contents.
   */
  async read(filepath) {
    const safePath = PathValidator.getSafePath(filepath);
    return this.#readFull(safePath);
  }

  /**
   * Reads the last N lines of a file.
   * @param {string} filepath The path to the file.
   * @param {string|number} tail Number of lines to tail from the end.
   * @returns {Promise<string>} The tailed content.
   */
  async tail(filepath, tail) {
    const safePath = PathValidator.getSafePath(filepath);
    return this.#readTail(safePath, tail);
  }

  /**
   * Writes content to a file, creating parent directories if needed.
   * @param {string} filepath The file path.
   * @param {string} content The content to write.
   */
  async write(filepath, content) {
    if (Buffer.byteLength(content, "utf8") > FILE_SIZE_LIMIT) {
      throw new Error("Content too large");
    }
    const safePath = PathValidator.getSafePath(filepath);
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, "utf8");
  }

  /**
   * Lists the contents of a directory.
   * @param {string} dirPath The path of the directory to list.
   * @returns {Promise<string>} A newline-separated string of contents.
   */
  async list(dirPath = ".") {
    const files = await fs.readdir(PathValidator.getSafePath(dirPath));
    return files.join("\n");
  }

  /**
   * Removes a file or directory recursively.
   * @param {string} filepath The path to remove.
   */
  async remove(filepath) {
    await fs.rm(PathValidator.getSafePath(filepath), { recursive: true });
  }

  /**
   * Renames or moves a file or directory.
   * @param {string} origin The source path.
   * @param {string} destination The target path.
   */
  async rename(origin, destination) {
    await fs.rename(
      PathValidator.getSafePath(origin),
      PathValidator.getSafePath(destination),
    );
  }

  /**
   * Creates a directory recursively.
   * @param {string} dirPath The directory path to create.
   */
  async mkdir(dirPath) {
    await fs.mkdir(PathValidator.getSafePath(dirPath), { recursive: true });
  }

  /**
   * Replaces the first occurrence of text in a file.
   * @param {string} filepath The file path.
   * @param {string} searchText The text to find.
   * @param {string} replaceText The text to replace it with.
   */
  async replace(filepath, searchText, replaceText) {
    const safePath = PathValidator.getSafePath(filepath);
    const content = await fs.readFile(safePath, "utf8");
    const newContent = this.#performReplace(content, searchText, replaceText);
    await fs.writeFile(safePath, newContent, "utf8");
  }

  /**
   * Appends content to the end of a file.
   * @param {string} filepath The file path.
   * @param {string} content The content to append.
   */
  async concat(filepath, content) {
    const safePath = PathValidator.getSafePath(filepath);
    await fs.appendFile(safePath, content, "utf8");
  }

  /**
   * Performs a regular expression search and replace on a file.
   * @param {string} filepath The file path.
   * @param {string} pattern The regular expression pattern.
   * @param {string} replacement The replacement string.
   * @param {string} flags The regular expression flags.
   */
  async sed(filepath, pattern, replacement = "", flags = "g") {
    const safePath = PathValidator.getSafePath(filepath);
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
      PathValidator.getSafePath(origin),
      PathValidator.getSafePath(destination),
    );
  }
}

export default FileTools;