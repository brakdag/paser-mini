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
   */
  async searchFilesPatternFixed(pattern) {
    try {
      const results = [];
      /**
       * Recursively walks through directories to find matching files.
       * @param {string} dir - The directory to walk.
       */
      const walk = async (dir) => {
        const files = await fs.readdir(dir, { withFileTypes: true });
        await Promise.all(
          files.map(async (file) => {
            if (file.name !== ".git" && file.name !== "node_modules") {
              const res = path.join(dir, file.name);
              if (file.isDirectory()) {
                await walk(res);
              } else {
                const regex = this.#globToRegex(pattern);
                if (regex.test(file.name) || regex.test(res)) {
                  results.push(res.replace(/^\.\//, ""));
                }
              }
            }
          }),
        );
      };
      await walk(".");
      return JSON.stringify(results.slice(0, 10));
    } catch (e) {
      return `ERR: Search error: ${e.message}`;
    }
  }

  /**
   * Converts a simple glob pattern to a Regular Expression.
   * @param {string} glob - The glob pattern.
   * @returns {RegExp} The resulting regular expression.
   */
  #globToRegex(glob) {
    let result = "";
    const specialChars = ".+^${}()|[]\\";
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
   * @returns {Promise<string>} JSON string of matching lines and files.
   */
  async searchTextGlobal(query) {
    if (!query || query.trim() === "") return JSON.stringify([]);

    return new Promise((resolve) => {
      const rootPath = process.cwd();
      const child = spawn("grep", [
        "-rIn",
        "--exclude-dir=.git",
        "--exclude-dir=node_modules",
        "--exclude-dir=log",
        "--",
        query,
        rootPath,
      ]);

      let stdoutData = "";

      child.stdout.on("data", (data) => {
        stdoutData += data.toString();
        const currentLines = stdoutData.split("\\n").filter(Boolean).length;

        if (currentLines >= 10) {
          child.kill("SIGKILL");
          resolve(this.#parseGrepOutput(stdoutData, rootPath));
        }
      });

      child.stderr.on("data", (_data) => {
        // Grep returns 1 if no matches are found, which is not an error
      });

      child.on("close", (code) => {
        if (code === 1) {
          return resolve(JSON.stringify([]));
        }
        return resolve(this.#parseGrepOutput(stdoutData, rootPath));
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
    if (!stdout) return JSON.stringify([]);
    const parsedResults = stdout
      .split("\n")
      .filter((line) => line)
      .slice(0, 10)
      .map((line) => {
        const parts = line.split(":");
        const filePath = parts[0];
        const lineNum = parseInt(parts[1], 10);
        return { file: path.relative(rootPath, filePath), line: lineNum };
      })
      .filter(Boolean);
    return JSON.stringify(parsedResults);
  }
}
