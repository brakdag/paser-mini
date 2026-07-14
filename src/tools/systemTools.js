import { exec, execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import PathValidator from "../utils/pathValidator.js";
import { registerSchemas } from "../core/schemaRegistry.js";

export const SYSTEM_TOOLS_VERSION = "1.0.0";

/**
 * System tools for environment management, code analysis, and system control.
 */
export class SystemTools {
  #execPromise = promisify(exec);

  #execFilePromise = promisify(execFile);

  #assistant = null;

  #chatManager = null;

  /**
   * Sets the assistant and chat manager context.
   * @param {object} assistant The assistant instance.
   * @param {object} chatManager The chat manager instance.
   */
  setContext(assistant, chatManager) {
    this.#assistant = assistant;
    this.#chatManager = chatManager;
  }

  /**
   * Resets the system context to a clean state.
   * @param {string} userMessage The message to start the new session.
   * @returns {Promise<string>} Confirmation of the reset operation.
   * @throws {Error} If the system context is not initialized.
   */
  async reset(userMessage) {
    if (!this.#assistant || !this.#chatManager) {
      throw new Error("System context not initialized");
    }

    this.#assistant.hardReset();
    this.#chatManager.ui.inputQueue.push(userMessage);
    this.#chatManager.engine.toolTracker.reset();

    return `Context reset successfully. New session started with message: "${userMessage}"`;
  }

  /**
   * Analyzes code using pyright for type and syntax errors.
   * @param {string} targetPath Path to the file to analyze.
   * @returns {Promise<string>} The analysis output.
   * @throws {Error} If the analysis process fails.
   */
  async analyzeCode(targetPath) {
    try {
      const safePath = PathValidator.getSafePath(targetPath);
      const { stdout } = await this.#execFilePromise(
        "npx",
        ["pyright", "--outputjson", safePath],
        {
          timeout: 60000,
        },
      );
      return stdout.trim() === "" ? "No type or syntax errors found." : stdout;
    } catch (e) {
      if (e.stdout) return e.stdout;
      throw new Error(`Analysis error: ${e.message}`);
    }
  }

  /**
   * Lints code using eslint to ensure style and quality standards.
   * @param {string} targetPath Path to the file to lint.
   * @returns {Promise<string>} The linting output.
   * @throws {Error} If the linting process fails.
   */
  async lintCode(targetPath) {
    try {
      const safePath = PathValidator.getSafePath(targetPath);
      const { stdout } = await this.#execFilePromise(
        "npx",
        ["eslint", safePath, "--no-color"],
        {
          timeout: 60000,
        },
      );
      return !stdout || stdout.trim() === "[]"
        ? "No linting issues found."
        : stdout;
    } catch (e) {
      if (e.stdout) return e.stdout;
      throw new Error(`Linting error: ${e.message}`);
    }
  }

  /**
   * Generates documentation using jsdoc.
   * @param {string|object} targetPathOrOptions - Path to the file or options object.
   * @param {string} [outputDir] - Directory for the generated docs.
   * @returns {Promise<string>} Confirmation of the generation.
   * @throws {Error} If the documentation process fails.
   */
  async generateDocs(targetPathOrOptions, outputDir) {
    let targetPath = targetPathOrOptions;
    let finalOutputDir = outputDir;

    if (typeof targetPathOrOptions === 'object' && targetPathOrOptions !== null) {
      targetPath = targetPathOrOptions.targetPath;
      finalOutputDir = targetPathOrOptions.outputDir || outputDir;
    }

    if (!targetPath || !finalOutputDir) {
      throw new Error(`Missing required arguments for generateDocs. targetPath: ${targetPath}, outputDir: ${finalOutputDir}`);
    }

    const safeTargetPath = PathValidator.getSafePath(targetPath);
    const safeOutputDir = PathValidator.getSafePath(finalOutputDir);

    await fs.mkdir(safeOutputDir, { recursive: true });
    await this.#execFilePromise("npx", ["jsdoc", safeTargetPath, "-d", safeOutputDir], {
      timeout: 60000,
    });
    return `Documentation successfully generated in: ${safeOutputDir}`;
  }

  /**
   * Reloads schemas from disk into the registry.
   * @returns {Promise<string>} Confirmation of the reload.
   * @throws {Error} If the reload fails.
   */
  async reloadSchemas() {
    await registerSchemas();
    return "Schemas successfully reloaded from disk.";
  }

  /**
   * Executes a bash command in the system shell.
   * @param {string} command The command to execute.
   * @returns {Promise<string>} The command output.
   * @throws {Error} If the bash command fails.
   */
  async execute(command) {
    try {
      const { stdout, stderr } = await this.#execPromise(command, {
        cwd: process.cwd(),
        timeout: 60000,
      });
      return stdout || stderr || "Command executed successfully (no output).";
    } catch (e) {
      if (e.stdout) {
        return `Exit Code ${e.code}:\n${e.stdout}\n${e.stderr || ""}`;
      }
      throw new Error(`Bash error: ${e.message}`);
    }
  }
}
