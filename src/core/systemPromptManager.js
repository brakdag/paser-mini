import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  generateSystemInstruction,
  AVAILABLE_TOOLS,
} from "../infrastructure/registry.js";
import mcpManager from "../infrastructure/McpManager.js";
import logger from "./logger.js";

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * SystemPromptManager handles the construction of the system prompt,
 * incorporating CLI injections, filtering tools, and caching the result for fast startup.
 */
export class SystemPromptManager {
  /**
   * Initializes the SystemPromptManager.
   * @param {object} [settings] - Storage settings.
   * @param {string} [settings.cacheDir] - Startup cache directory.
   */
  constructor({ cacheDir = path.join(process.cwd(), ".paser-mini/cache") } = {}) {
    this.cacheDir = cacheDir;
    this.cacheFile = path.join(cacheDir, "startup.json");
    this._pendingCache = null;
    this._options = null;
    this._forceRebuild = false;
  }

  /**
   * Retrieves the file modification times for a list of files.
   * @param {string[]} files - The files to check.
   * @returns {Promise<number[]>} An array of timestamps.
   * @private
   */
  async _getMtimes(files) {
    return Promise.all(
      files.map(async (file) => {
        try {
          const stat = await fsp.stat(file);
          return stat.mtimeMs;
        } catch {
          return 0;
        }
      }),
    );
  }

  /**
   * Helper method to check file existence asynchronously.
   * @param {string} filePath - The file path to check.
   * @returns {Promise<boolean>} True if exists, false otherwise.
   * @private
   */
  async _exists(filePath) {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loads the system prompt from cache if valid, otherwise builds a new one.
   * @param {object} options - The parsed CLI options from commander.
   * @returns {Promise<{systemInstruction: string, filteredTools: object, pureMode: boolean}>} The prompt, tools and explicit execution mode.
   */
  async buildPrompt(options) {
    this._options = options;

    if (options.pureMode) {
      this._pendingCache = null;
      return { systemInstruction: "", filteredTools: {}, pureMode: true };
    }

    // --- MCP Integration ---
    await mcpManager.initialize();
    const mcpTools = mcpManager.getTools();
    const availableTools = { ...AVAILABLE_TOOLS, ...mcpTools };
    const mcpSchemas = mcpManager.getSchemas();
    // -----------------------

    const defaultPath = ".paser-mini/staff/default.log";
    const injectionFile =
      options.fileSystemInstruction ||
      ((await this._exists(defaultPath)) ? defaultPath : null);

    const dependencies = [
      path.join(APP_ROOT, "src/infrastructure/toolDefinitions.js"),
      path.join(APP_ROOT, "src/core/schemas.js"),
      path.join(APP_ROOT, "src/infrastructure/system_instruction.json"),
      path.join(".paser-mini", "config", "mcp.json"),
      ...(injectionFile ? [injectionFile] : []),
    ];

    const dependencyPaths = dependencies.map((file) => path.resolve(file));
    const currentMtimes = await this._getMtimes(dependencyPaths);
    const hashes = await Promise.all(dependencyPaths.map(async (file) => {
      try {
        return createHash("sha256").update(await fsp.readFile(file)).digest("hex");
      } catch {
        return null;
      }
    }));
    const catalogKey = JSON.stringify({ names: Object.keys(availableTools).sort(), schemas: mcpSchemas });
    const date = new Date().toDateString();

    if (!this._forceRebuild) {
      try {
        const cacheData = JSON.parse(await fsp.readFile(this.cacheFile, "utf8"));
        const isCacheValid =
          cacheData.date === date && cacheData.catalogKey === catalogKey &&
          JSON.stringify(cacheData.hashes) === JSON.stringify(hashes) &&
          JSON.stringify(cacheData.dependencies) === JSON.stringify(dependencyPaths) &&
          dependencyPaths.every((_, i) => cacheData.mtimes[i] === currentMtimes[i]);

        const optionsMatch =
          cacheData.options.pureMode === false &&
          cacheData.options.injectSystemInstruction ===
            options.injectSystemInstruction &&
          cacheData.options.systemInstruction === options.systemInstruction;

        if (isCacheValid && optionsMatch) {
          const filteredTools = Object.fromEntries(
            Object.entries(availableTools).filter(
              ([name]) =>
                cacheData.filteredToolNames.includes(name) ||
                name.startsWith("mcp_"),
            ),
          );

          this._pendingCache = null;

          return {
            systemInstruction: cacheData.systemInstruction,
            filteredTools,
            pureMode: false,
          };
        }
      } catch (err) {
        logger.warn(`Cache read failed, rebuilding: ${err.message}`);
      }
    }

    let injection = "";
    let filteredTools = { ...availableTools };

    if (options.injectSystemInstruction) {
      injection = options.injectSystemInstruction;
    } else if (injectionFile) {
      injection = await fsp.readFile(injectionFile, "utf8");

      const toolsMatch = injection.match(/TOOLS_AVAILABLE\s*=\s*(\[.*?\])/s);
      if (toolsMatch) {
        try {
          const availableList = JSON.parse(toolsMatch[1]);
          filteredTools = Object.fromEntries(
            Object.entries(availableTools).filter(
              ([name]) =>
                availableList.includes(name) || name.startsWith("mcp_"),
            ),
          );
        } catch (e) {
          logger.warn(
            `Could not parse TOOLS_AVAILABLE array in ${injectionFile}: ${e.message}`,
          );
        }
      }
    }

    const baseInstr =
      options.systemInstruction ??
      generateSystemInstruction(Object.keys(filteredTools), mcpSchemas);

    const finalInstruction = injection
      ? `PERSON AND ROLE:\n${injection}\n\nCORE OPERATIONAL PROTOCOLS:\n${baseInstr}\n\n DATE:${new Date().toDateString()}`
      : baseInstr;

    this._pendingCache = {
      date,
      catalogKey,
      hashes,
      dependencies: dependencyPaths,
      mtimes: currentMtimes,
      options: {
        pureMode: false,
        injectSystemInstruction: options.injectSystemInstruction,
        systemInstruction: options.systemInstruction,
      },
      filteredToolNames: Object.keys(filteredTools),
      systemInstruction: finalInstruction,
    };

    this._forceRebuild = false;

    return {
      systemInstruction: finalInstruction,
      filteredTools,
      pureMode: false,
    };
  }

  /**
   * Forces a bypass of the cache, reads files from disk, and returns the fresh prompt.
   * @returns {Promise<{systemInstruction: string, filteredTools: object, pureMode: boolean}>} The fresh prompt, tools and execution mode.
   */
  async rebuildCache() {
    this._forceRebuild = true;
    if (!this._options) {
      throw new Error(
        "Cannot rebuild cache: SystemPromptManager was not initialized with options.",
      );
    }
    return this.buildPrompt(this._options);
  }

  /**
   * Saves the startup cache to disk synchronously.
   * Designed to be called on process exit or manually.
   */
  saveCache() {
    if (!this._pendingCache) return;

    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(this._pendingCache), "utf8");
      this._pendingCache = null;
    } catch (err) {
      logger.warn(`Could not write startup cache on exit: ${err.message}`);
    }
  }
}

/**
 * Singleton instance of the SystemPromptManager.
 * @type {SystemPromptManager}
 */
const promptManager = new SystemPromptManager();
export default promptManager;
