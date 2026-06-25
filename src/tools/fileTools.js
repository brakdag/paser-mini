import fs from "fs/promises";
import path from "path";

const FILE_SIZE_LIMIT = 100 * 1024;

/**
 * Provides tools for file operations.
 */
class FileTools {
  /**
   * Resolves and verifies that a path is safely within the project root.
   * @param {string} inputPath The path to verify.
   * @returns {string} The safe absolute path.
   */
  #getSafePath(inputPath) {
    const resolved = path.resolve(process.cwd(), inputPath);
    if (!resolved.startsWith(process.cwd()))
      throw new Error("Security Error: Path is outside of project root");
    return resolved;
  }

  /**
   * Reads the contents of a file, optionally tailing the last N lines.
   * @param {string} filepath The path to the file.
   * @param {string|number} [tail] Number of lines to tail from the end.
   * @returns {Promise<string>} The file contents or an error string.
   */
  async read(filepath, tail) {
    try {
      const safePath = this.#getSafePath(filepath);
      const stats = await fs.stat(safePath);
      if (tail !== undefined && tail !== null) {
        const numericTail = parseInt(tail, 10);
        if (Number.isNaN(numericTail)) return "ERR: tail must be a number";
        if (numericTail <= 0) return "";
        const bufferSize = 64 * 1024;
        const start = Math.max(0, stats.size - bufferSize);
        const length = stats.size - start;
        const handle = await fs.open(safePath, "r");
        const buffer = Buffer.alloc(length);
        try {
          await handle.read(buffer, 0, length, start);
        } finally {
          await handle.close();
        }
        const content = buffer.toString("utf8");
        const result = content.split("\n").slice(-numericTail).join("\n");
        return Buffer.byteLength(result, "utf8") > FILE_SIZE_LIMIT
          ? "ERR: Tail result too large"
          : result;
      }
      if (stats.size > FILE_SIZE_LIMIT) return "ERR: File too large";
      return await fs.readFile(safePath, "utf8");
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Writes content to a file, creating parent directories if needed.
   * @param {string} filepath The file path.
   * @param {string} content The content to write.
   * @returns {Promise<string>} 'OK' or an error string.
   */
  async write(filepath, content) {
    try {
      if (Buffer.byteLength(content, "utf8") > FILE_SIZE_LIMIT)
        return "ERR: Content too large";
      const safePath = this.#getSafePath(filepath);
      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, content, "utf8");
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Lists the contents of a directory.
   * @param {string} dirPath The path of the directory to list.
   * @returns {Promise<string>} A newline-separated string of contents or an error.
   */
  async list(dirPath = ".") {
    try {
      return (await fs.readdir(this.#getSafePath(dirPath))).join("\n");
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Removes a file or directory recursively.
   * @param {string} filepath The path to remove.
   * @returns {Promise<string>} 'OK' or an error string.
   */
  async remove(filepath) {
    try {
      await fs.rm(this.#getSafePath(filepath), { recursive: true });
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Renames or moves a file or directory.
   * @param {string} origin The source path.
   * @param {string} destination The target path.
   * @returns {Promise<string>} 'OK' or an error string.
   */
  async rename(origin, destination) {
    try {
      await fs.rename(
        this.#getSafePath(origin),
        this.#getSafePath(destination),
      );
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Creates a directory recursively.
   * @param {string} dirPath The directory path to create.
   * @returns {Promise<string>} 'OK' or an error string.
   */
  async mkdir(dirPath) {
    try {
      await fs.mkdir(this.#getSafePath(dirPath), { recursive: true });
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Replaces the first occurrence of text in a file.
   * @param {string} filepath The file path.
   * @param {string} searchText The text to find.
   * @param {string} replaceText The text to replace it with.
   * @returns {Promise<string>} 'OK' or an error string.
   */
  async replace(filepath, searchText, replaceText) {
    try {
      const safePath = this.#getSafePath(filepath);
      const content = await fs.readFile(safePath, "utf8");
      if (!content.includes(searchText)) return "ERR: Not found";
      if (content.split(searchText).length > 2) return "ERR: Multiple results";
      const newContent = content.replace(searchText, replaceText);
      await fs.writeFile(safePath, newContent, "utf8");

      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Appends content to the end of a file.
   * @param {string} filepath The file path.
   * @param {string} content The content to append.
   * @returns {Promise<string>} 'OK' or an error string.
   */
  async concat(filepath, content) {
    try {
      const safePath = this.#getSafePath(filepath);
      await fs.appendFile(safePath, content, "utf8");
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Copies a file from origin to destination.
   * @param {string} origin The source file path.
   * @param {string} destination The destination file path.
   * @returns {Promise<string>} 'OK' or an error string.
   */
  async copy(origin, destination) {
    try {
      await fs.copyFile(
        this.#getSafePath(origin),
        this.#getSafePath(destination),
      );
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }
}

export default FileTools;
