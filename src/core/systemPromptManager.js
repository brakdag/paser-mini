import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import {
  generateSystemInstruction,
  AVAILABLE_TOOLS,
} from "../infrastructure/registry.js";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "startup.json");

/**
 * SystemPromptManager handles the construction of the system prompt,
 * incorporating CLI injections, filtering tools, and caching the result for fast startup.
 */
class SystemPromptManager {
  /**
   * Initializes the SystemPromptManager.
   */
  constructor() {
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
      })
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
   * @returns {Promise<{systemInstruction: string, filteredTools: object}>} An object containing the final system instruction and the filtered tools.
   */
  async buildPrompt(options) {
    this._options = options;

    if (options.noSystemInstruction) {
      return { systemInstruction: "", filteredTools: {} };
    }

    const defaultPath = ".staff/default.log";
    const injectionFile = options.fileSystemInstruction || (await this._exists(defaultPath) ? defaultPath : null);

    const dependencies = [
      "src/infrastructure/registry_positional.json",
      "src/infrastructure/system_instruction.json",
      ...(injectionFile ? [injectionFile] : [])
    ];

    const currentMtimes = await this._getMtimes(dependencies);

    // 1. Intentar leer de caché (a menos que se fuerce un rebuild)
    if (!this._forceRebuild) {
      try {
        const cacheData = JSON.parse(await fsp.readFile(CACHE_FILE, "utf8"));
        const isCacheValid = dependencies.every((_, i) => cacheData.mtimes[i] === currentMtimes[i]);
        
        const optionsMatch = cacheData.options.injectSystemInstruction === options.injectSystemInstruction && 
                             cacheData.options.systemInstruction === options.systemInstruction;

        if (isCacheValid && optionsMatch) {
          const filteredTools = Object.fromEntries(
            Object.entries(AVAILABLE_TOOLS).filter(([name]) =>
              cacheData.filteredToolNames.includes(name)
            )
          );
          
          this._pendingCache = null; // No hay nada nuevo que guardar

          return {
            systemInstruction: cacheData.systemInstruction,
            filteredTools
          };
        }
      } catch (err) {
        // Invalid or non-existent cache
      }
    }

    // 2. Construir desde cero
    let injection = "";
    let filteredTools = { ...AVAILABLE_TOOLS };

    if (options.injectSystemInstruction) {
      injection = options.injectSystemInstruction;
    } else if (injectionFile) {
      injection = await fsp.readFile(injectionFile, "utf8");

      const toolsMatch = injection.match(/TOOLS_AVAILABLE\s*=\s*(\[.*?\])/s);
      if (toolsMatch) {
        try {
          const availableList = JSON.parse(toolsMatch[1]);
          filteredTools = Object.fromEntries(
            Object.entries(AVAILABLE_TOOLS).filter(([name]) =>
              availableList.includes(name)
            )
          );
        } catch (e) {
          console.warn(
            `Warning: Could not parse TOOLS_AVAILABLE array in ${injectionFile}: ${e.message}`
          );
        }
      }
    }

    const baseInstr =
      options.systemInstruction ||
      generateSystemInstruction(Object.keys(filteredTools));

    const finalInstruction = injection
      ? `PERSON AND ROLE:\n${injection}\n\nCORE OPERATIONAL PROTOCOLS:\n${baseInstr}`
      : baseInstr;

    // 3. Save payload in memory
    this._pendingCache = {
      mtimes: currentMtimes,
      options: {
        injectSystemInstruction: options.injectSystemInstruction,
        systemInstruction: options.systemInstruction,
      },
      filteredToolNames: Object.keys(filteredTools),
      systemInstruction: finalInstruction
    };

    // Reset the flag if it was forced
    this._forceRebuild = false;

    return {
      systemInstruction: finalInstruction,
      filteredTools
    };
  }

  /**
   * Forces a bypass of the cache, reads files from disk, and returns the fresh prompt.
   * @returns {Promise<{systemInstruction: string, filteredTools: object}>} The fresh system prompt and tools.
   */
  async rebuildCache() {
    this._forceRebuild = true;
    if (!this._options) {
      throw new Error("Cannot rebuild cache: SystemPromptManager was not initialized with options.");
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
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this._pendingCache), "utf8");
      this._pendingCache = null; // Clear after saving
    } catch (err) {
      console.warn(`Warning: Could not write startup cache on exit: ${err.message}`);
    }
  }
}

/**
 * Singleton instance of the SystemPromptManager.
 * @type {SystemPromptManager}
 */
const promptManager = new SystemPromptManager();
export default promptManager;