import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { registerSchemas } from "../core/schemaRegistry.js";

export const SYSTEM_TOOLS_VERSION = "1.0.0";

export class SystemTools {
  #execPromise = promisify(exec);

  setContext(assistant, chatManager) {
    this._assistant = assistant;
    this._chatManager = chatManager;
  }

  async reset(userMessage) {
    if (!this._assistant || !this._chatManager) {
      throw new Error("System context not initialized");
    }
    try {
      this._assistant.hardReset();
      this._chatManager.ui.inputQueue.push(userMessage);
      this._chatManager.engine.toolTracker.reset();
      return `Context reset successfully. New session started with message: "${userMessage}"`;
    } catch (e) {
      return `ERR: Reset failed: ${e.message}`;
    }
  }

  async analyzeCode(targetPath) {
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

  async lintCode(targetPath) {
    try {
      const { stdout } = await this.#execPromise(
        `npx eslint ${targetPath} --no-color`,
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

  async generateDocs(targetPath, outputDir) {
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

  async executeBash(command) {
    try {
      const { stdout, stderr } = await this.#execPromise(command, {
        cwd: process.cwd(),
        timeout: 60000,
      });
      return stdout || stderr || "Command executed successfully (no output).";
    } catch (e) {
      if (e.stdout)
        return `Exit Code ${e.code}:\n${e.stdout}\n${e.stderr || ""}`;
      return `ERR: Bash error: ${e.message}`;
    }
  }
}
