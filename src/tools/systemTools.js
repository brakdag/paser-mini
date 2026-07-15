import { exec, execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import PathValidator from "../utils/pathValidator.js";
import { registerSchemas } from "../core/schemaRegistry.js";

export const SYSTEM_TOOLS_VERSION = "1.0.0";

const EXEC_TIMEOUT_MS = 60000;

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
          timeout: EXEC_TIMEOUT_MS,
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
          timeout: EXEC_TIMEOUT_MS,
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
   * @param {object|string} options - The target path string or an options object.
   * @param {string} [options.path] - Path to the file to document.
   * @param {string} [options.targetPath] - Alternative key for path.
   * @param {string} [options.outputDir] - Directory for the generated docs.
   * @param {string} [outputDirFallback] - Fallback directory if not provided in options.
   * @returns {Promise<string>} Confirmation of the generation.
   * @throws {Error} If the documentation process fails or arguments are missing.
   */
  async generateDocs(options, outputDirFallback) {
    const targetPath = options?.path || options?.targetPath || (typeof options === 'string' ? options : null);
    const outputDir = options?.outputDir || outputDirFallback;

    if (!targetPath || !outputDir) {
      throw new Error(`Missing required arguments for generateDocs. targetPath: ${targetPath}, outputDir: ${outputDir}`);
    }

    const safeTargetPath = PathValidator.getSafePath(targetPath);
    const safeOutputDir = PathValidator.getSafePath(outputDir);

    await fs.mkdir(safeOutputDir, { recursive: true });
    await this.#execFilePromise("npx", ["jsdoc", safeTargetPath, "-d", safeOutputDir], {
      timeout: EXEC_TIMEOUT_MS,
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
        timeout: EXEC_TIMEOUT_MS,
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
