import { exec, execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import PathValidator from "../utils/pathValidator.js";
import { registerSchemas } from "../core/schemaRegistry.js";

export const SYSTEM_TOOLS_VERSION = "1.0.0";

const EXEC_TIMEOUT_MS = 60000;
const require = createRequire(import.meta.url);

/**
 * System tools for environment management, code analysis, and system control.
 */
export class SystemTools {
  #execPromise = promisify(exec);

  #execFilePromise;

  #assistant = null;

  #chatManager = null;

  /**
   * Configures subprocess execution; tests can supply a local fake.
   * @param {object} [options] - Execution dependencies.
   * @param {(command: string, args: string[], options: object) => Promise<{stdout: string}>} [options.execFileRunner] - Subprocess runner.
   */
  constructor({ execFileRunner = promisify(execFile) } = {}) {
    this.#execFilePromise = execFileRunner;
  }

  /**
   * Runs an installed dependency using the current Node executable.
   * @param {string} packageName - Declared dependency to resolve.
   * @param {string} entry - CLI path within its package.
   * @param {string[]} args - Arguments passed without a shell.
   * @returns {Promise<object>} Captured subprocess output.
   */
  #runTool(packageName, entry, args) {
    const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), entry);
    return this.#execFilePromise(process.execPath, [cli, ...args], {
      timeout: EXEC_TIMEOUT_MS,
      cwd: process.cwd(),
    });
  }

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
   * Checks JS/TS with the installed TypeScript compiler, without emitting files.
   * @param {string} targetPath File or directory containing tsconfig/jsconfig.
   * @returns {Promise<string>} The analysis output.
   * @throws {Error} If the analysis process fails.
   */
  async analyzeCode(targetPath) {
    try {
      const safePath = PathValidator.getSafePath(targetPath);
      let args;
      if ((await fs.stat(safePath)).isDirectory()) {
        const configs = await Promise.all(["tsconfig.json", "jsconfig.json"].map(async (name) => {
          const candidate = path.join(safePath, name);
          try {
            await fs.access(candidate);
            return PathValidator.getSafePath(candidate);
          } catch (error) {
            if (error.code === "ENOENT") return null;
            throw error;
          }
        }));
        const config = configs.find(Boolean);
        if (!config) throw new Error("Directory must contain tsconfig.json or jsconfig.json.");
        args = ["--project", config];
      } else {
        args = ["--allowJs", "--checkJs", "--skipLibCheck", "--target", "esnext",
          "--module", "nodenext", "--esModuleInterop", safePath];
      }
      const { stdout } = await this.#runTool("typescript", "bin/tsc", ["--noEmit", "--pretty", "false", ...args]);
      return stdout.trim() === "" ? "No type or syntax errors found." : stdout;
    } catch (e) {
      if ([1, 2].includes(e.code) && !e.killed && !e.signal && e.stdout) return e.stdout;
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
      const { stdout } = await this.#runTool("eslint", "bin/eslint.js", [safePath, "--no-color"]);
      return !stdout || stdout.trim() === "[]"
        ? "No linting issues found."
        : stdout;
    } catch (e) {
      if (e.code === 1 && !e.killed && !e.signal && e.stdout) return e.stdout;
      throw new Error(`Linting error: ${e.message}`);
    }
  }

  /**
   * Generates documentation using jsdoc.
   * @param {{path?: string, targetPath?: string, outputDir?: string}|string} options - Target or options.
   * @param {string} [outputDirFallback] - Fallback directory if not provided in options.
   * @returns {Promise<string>} Confirmation of the generation.
   * @throws {Error} If the documentation process fails or arguments are missing.
   */
  async generateDocs(options, outputDirFallback) {
    const targetPath = typeof options === "string" ? options : options?.path || options?.targetPath;
    const outputDir = (typeof options === "object" ? options?.outputDir : null) || outputDirFallback;

    if (!targetPath || !outputDir) {
      throw new Error(`Missing required arguments for generateDocs. targetPath: ${targetPath}, outputDir: ${outputDir}`);
    }

    const safeTargetPath = PathValidator.getSafePath(targetPath);
    const safeOutputDir = PathValidator.getSafeMutationPath(outputDir, { recursive: true });

    await fs.mkdir(safeOutputDir, { recursive: true });
    await this.#runTool("jsdoc", "jsdoc.js", [safeTargetPath, "-d", safeOutputDir]);
    return `Documentation successfully generated in: ${safeOutputDir}`;
  }

  /**
   * Re-registers the bundled schemas into the validator.
   * @returns {Promise<string>} Confirmation of the reload.
   * @throws {Error} If the reload fails.
   */
  async reloadSchemas() {
    await registerSchemas();
    return "Bundled schemas successfully re-registered.";
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
