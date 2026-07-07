import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

/**
 * Tools for searching files and text within the project.
 */
export default class SearchTools {
  /**
   * Searches for files matching a glob-like pattern.
   * @param {string} pattern - The search pattern.
   * @returns {Promise<string>} JSON string of matching file paths.
   * @throws {Error} If the search process fails.
   */
  async searchFilesPatternFixed(pattern) {
    const results = [];
    const regex = this.#globToRegex(pattern);

    /**
     * Recursively walks through directories to find matching files.
     * @param {string} dir - The directory to walk.
     */
    const walk = async (dir) => {
      const files = await fs.readdir(dir, { withFileTypes: true });
      await Promise.all(
        files.map(async (file) => {
          if (file.name === ".git" || file.name === "node_modules") {
            return;
          }

          const res = path.join(dir, file.name);
          if (file.isDirectory()) {
            await walk(res);
          } else if (regex.test(file.name) || regex.test(res)) {
            results.push(res.replace(/^\.\//, ""));
          }
        }),
      );
    };

    await walk(".");
    return JSON.stringify(results.slice(0, 10));
  }

  /**
   * Converts a simple glob pattern to a Regular Expression.
   * @param {string} glob - The glob pattern.
   * @returns {RegExp} The resulting regular expression.
   */
  #globToRegex(glob) {
    let result = "";
    const specialChars = '.+^${}()|[]"';
    for (let i = 0; i < glob.length; i += 1) {
      const char = glob[i];
      if (char === "*") {
        result += ".*";
      } else if (char === "?") {
        result += ".";
      } else if (specialChars.includes(char)) {
        result += `\\${char}`;
      } else {
        result += char;
      }
    }
    return new RegExp(`^${result}$`, "i");
  }

  /**
   * Searches for a text query globally across the project using grep.
   * @param {string} query - The text to search for.
   * @param {string} searchPath - The path to search in.
   * @returns {Promise<string>} JSON string of matching lines and files.
   * @throws {Error} If the grep process fails unexpectedly.
   */
  async searchText(query, searchPath = ".") {
    if (!query || query.trim() === "") {
      return JSON.stringify([]);
    }

    return new Promise((resolve, reject) => {
      const rootPath = process.cwd();
      const targetPath = path.resolve(rootPath, searchPath);
      const child = spawn("grep", [
        "-rInH",
        "--exclude-dir=.git",
        "--exclude-dir=node_modules",
        "--exclude-dir=log",
        "--",
        query,
        targetPath,
      ]);

      let stdoutData = "";
      const MAX_STDOUT_SIZE = 50 * 1024; // 50KB limit to prevent context overflow

      child.stdout.on("data", (data) => {
        stdoutData += data.toString();

        // Abort if output exceeds max size
        if (Buffer.byteLength(stdoutData, "utf8") > MAX_STDOUT_SIZE) {
          child.kill("SIGKILL");
          resolve(this.#parseGrepOutput(stdoutData, rootPath));
          return;
        }

        const currentLines = stdoutData.split("\n").filter(Boolean).length;

        if (currentLines >= 50) {
          child.kill("SIGKILL");
          resolve(this.#parseGrepOutput(stdoutData, rootPath));
        }
      });

      child.on("error", (err) => reject(err));

      child.on("close", (code) => {
        if (code === 1) {
          return resolve(JSON.stringify([]));
        }
        if (code === 0 || code === null) {
          return resolve(this.#parseGrepOutput(stdoutData, rootPath));
        }
        return reject(new Error(`Grep process exited with code ${code}`));
      });

      setTimeout(() => {
        child.kill("SIGKILL");
        resolve(this.#parseGrepOutput(stdoutData, rootPath));
      }, 80000);
    });
  }

  /**
   * Parses the raw stdout from grep into a structured JSON format.
   * @param {string} stdout - The raw grep output.
   * @param {string} rootPath - The root path for relative path calculation.
   * @returns {string} JSON string of parsed results.
   */
  #parseGrepOutput(stdout, rootPath) {
    if (!stdout) {
      return JSON.stringify([]);
    }

    const MAX_RESULT_LENGTH = 1000; // 1KB limit per matched line content

    const parsedResults = stdout
      .split("\n")
      .filter((line) => line)
      .slice(0, 10)
      .map((line) => {
        const parts = line.split(":");
        if (parts.length < 3) {
          return null;
        }

        const filePath = parts[0];
        const lineNum = parseInt(parts[1], 10);
        const content = parts.slice(2).join(":");

        if (Number.isNaN(lineNum)) {
          return null;
        }

        const truncatedContent =
          content.length > MAX_RESULT_LENGTH
            ? `${content.substring(0, MAX_RESULT_LENGTH)}... (truncated)`
            : content.trim();

        return {
          file: path.relative(rootPath, filePath),
          line: lineNum,
          content: truncatedContent,
        };
      })
      .filter(Boolean);

    return JSON.stringify(parsedResults);
  }
}

