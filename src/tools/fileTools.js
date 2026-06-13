import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
const FILE_SIZE_LIMIT = 100 * 1024;


class FileTools {
  async #guardianValidate(filePath) {
    if (!filePath.endsWith(".js")) return { valid: true };
    try {
      const { stdout } = await execPromise(`npx eslint ${filePath} --format json`, { timeout: 30000 });
      const data = JSON.parse(stdout);
      const errors = data.flatMap((f) => f.messages.filter((m) => m.severity === 2));
      return errors.length === 0 ? { valid: true } : { valid: false, error: `ESLint found ${errors.length} errors.` };
    } catch (e) {
      return { valid: false, error: `Guardian System Error: ${e.message}` };
    }
  }

  #getSafePath(inputPath) {
    const resolved = path.resolve(process.cwd(), inputPath);
    if (!resolved.startsWith(process.cwd())) throw new Error("Security Error: Path is outside of project root");
    return resolved;
  }

  async readFile({ path: filePath, tail }) {
    try {
      const safePath = this.#getSafePath(filePath);
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
        try { await handle.read(buffer, 0, length, start); } finally { await handle.close(); }
        const content = buffer.toString("utf8");
        const result = content.split("\n").slice(-numericTail).join("\n");
        return Buffer.byteLength(result, "utf8") > FILE_SIZE_LIMIT ? "ERR: Tail result too large" : result;
      }
      if (stats.size > FILE_SIZE_LIMIT) return "ERR: File too large";
      return await fs.readFile(safePath, "utf8");
    } catch (e) { return `ERR: ${e.message}`; }
  }

  async writeFile({ path: filePath, content }) {
    try {
      if (Buffer.byteLength(content, "utf8") > FILE_SIZE_LIMIT) return "ERR: Content too large";
      const safePath = this.#getSafePath(filePath);
      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, content, "utf8");
      if (!filePath.endsWith(".js")) return "OK";
      const validation = await this.#guardianValidate(safePath);
      if (!validation.valid) { await fs.rm(safePath); return validation.error; }
      return "OK";
    } catch (e) { return `ERR: ${e.message}`; }
  }

  async listDir({ path: dirPath = "." }) {
    try { return (await fs.readdir(this.#getSafePath(dirPath))).join("\n"); } catch (e) { return `ERR: ${e.message}`; }
  }

  async removeFile({ path: filePath }) {
    try { await fs.rm(this.#getSafePath(filePath), { recursive: true }); return "OK"; } catch (e) { return `ERR: ${e.message}`; }
  }

  async createDir({ path: dirPath }) {
    try { await fs.mkdir(this.#getSafePath(dirPath), { recursive: true }); return "OK"; } catch (e) { return `ERR: ${e.message}`; }
  }

  async renamePath({ origin, destination }) {
    try { await fs.rename(this.#getSafePath(origin), this.#getSafePath(destination)); return "OK"; } catch (e) { return `ERR: ${e.message}`; }
  }

  async replaceString({ path: filePath, search_text: searchText, replace_text: replaceText }) {
    try {
      const safePath = this.#getSafePath(filePath);
      const content = await fs.readFile(safePath, "utf8");
      if (!content.includes(searchText)) return "ERR: Not found";
      const newContent = content.replace(searchText, replaceText);
      await fs.writeFile(safePath, newContent, "utf8");
      return "OK";
    } catch (e) { return `ERR: ${e.message}`; }
  }

  async copyFile({ origin, destination }) {
    try { await fs.copyFile(this.#getSafePath(origin), this.#getSafePath(destination)); return "OK"; } catch (e) { return `ERR: ${e.message}`; }
  }
}

export default FileTools;