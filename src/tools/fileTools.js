import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
const FILE_SIZE_LIMIT = 100 * 1024;

class FileTools {
  #getSafePath(inputPath) {
    const resolved = path.resolve(process.cwd(), inputPath);
    if (!resolved.startsWith(process.cwd()))
      throw new Error("Security Error: Path is outside of project root");
    return resolved;
  }

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

  async write(filepath, content) {
    try {
      const newContent = content.replaceAll("\\`", "`");
      if (Buffer.byteLength(content, "utf8") > FILE_SIZE_LIMIT)
        return "ERR: Content too large";
      const safePath = this.#getSafePath(filepath);
      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, newContent, "utf8");
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async list(dirPath = ".") {
    try {
      return (await fs.readdir(this.#getSafePath(dirPath))).join("\n");
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async remove(filepath) {
    try {
      await fs.rm(this.#getSafePath(filepath), { recursive: true });
      return "OK";
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

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

    async mkdir(dirPath) {
      try {
        await fs.mkdir(this.#getSafePath(dirPath), { recursive: true });
        return "OK";
      } catch (e) {
        return `ERR: ${e.message}`;
      }
    }
  
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

    async concat(filepath, content) {
      try {
        const safePath = this.#getSafePath(filepath);
        await fs.appendFile(safePath, content, "utf8");
        return "OK";
      } catch (e) {
        return `ERR: ${e.message}`;
      }
    }
  
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
