import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { registerSchemas } from "../core/schemaRegistry.js";

export class SystemTools {
  #execPromise = promisify(exec);

  async analyzeCode({ path: targetPath = "." }) {
    try {
      const { stdout } = await this.#execPromise(
        `npx pyright --outputjson ${targetPath}`,
        { timeout: 60000 },
      );
      if (stdout.trim() === "") {
        return "No type or syntax errors found.";
      }
      return stdout;
    } catch (e) {
      if (e.stdout) return e.stdout;
      return `ERR: Analysis error: ${e.message}`;
    }
  }

  async lintCode({ path: targetPath = "." }) {
    try {
      const { stdout } = await this.#execPromise(
        `npx eslint ${targetPath} --format json`,
        { timeout: 60000 },
      );
      if (!stdout || stdout.trim() === "[]") {
        return "No linting issues found.";
      }
      return stdout;
    } catch (e) {
      if (e.stdout) return e.stdout;
      return `ERR: Linting error: ${e.message}`;
    }
  }

  async generateDocs({
    path: targetPath = ".",
    outputDir = "docs/api",
  }) {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      await this.#execPromise(`npx jsdoc ${targetPath} -d ${outputDir}`, {
        timeout: 60000,
      });
      return `Documentation successfully generated in: ${outputDir}`;
    } catch (e) {
      return `ERR: Documentation error: ${e.message}`;
    }
  }

  async reloadSchemas() {
    try {
      await registerSchemas();
      return "Schemas successfully reloaded from disk.";
    } catch (e) {
      return `ERR: Failed to reload schemas: ${e.message}`;
    }
  }

  async executeBash({ command }) {
    try {
      const { stdout, stderr } = await this.#execPromise(command, {
        cwd: process.cwd(),
        timeout: 60000,
      });
      return stdout || stderr || "Command executed successfully (no output).";
    } catch (e) {
      if (e.stdout) return `Exit Code ${e.code}:\n${e.stdout}\n${e.stderr || ""}`;
      return `ERR: Bash error: ${e.message}`;
    }
  }
}
