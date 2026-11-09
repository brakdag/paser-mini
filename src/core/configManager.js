import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Keys belonging to the user's global scope and persisting across projects.
 * @type {Set<string>}
 */
const GLOBAL_KEYS = new Set([
  "favorites",
  "fetch_headers",
  "unavailable_models",
  "user_nickname",
  "agent_nickname"
]);

/**
 * Manages the application configuration, providing layered persistence:
 * 1. Global (User home ~/.paser-mini/config.json)
 * 2. Local (Current project ./.paser-mini/config/config.json)
 */
class ConfigManager {
  #fs;

  /**
   * Initializes the ConfigManager and loads configurations from both layers.
   * @param {object} [options] Storage locations and filesystem dependency.
   * @param {string} [options.globalDir] Directory for user configuration.
   * @param {string} [options.localDir] Directory for project configuration.
   * @param {object} [options.fileSystem] Synchronous filesystem implementation.
   */
  constructor({
    globalDir = path.join(os.homedir(), ".paser-mini"),
    localDir = path.join(process.cwd(), ".paser-mini/config"),
    fileSystem = fs,
  } = {}) {
    this.#fs = fileSystem;
    this.globalPath = path.join(globalDir, "config.json");
    this.globalConfig = this._loadConfig(this.globalPath);

    this.localPath = path.join(localDir, "config.json");
    this.localConfig = this._loadConfig(this.localPath);
  }

  /**
   * Moves any global keys found in the local config to the global config.
   * Called explicitly by application startup; constructing a manager only reads.
   * Saves the global copy before removing local keys and can resume after failure.
   * @returns {boolean} Whether legacy local keys were removed.
   */
  migrateGlobalKeys() {
    let needsLocalSave = false;
    let needsGlobalSave = false;
    const globalConfig = { ...this.globalConfig };
    const localConfig = { ...this.localConfig };

    GLOBAL_KEYS.forEach((key) => {
      if (key in localConfig) {
        if (!(key in globalConfig)) {
          globalConfig[key] = localConfig[key];
          needsGlobalSave = true;
        }
        delete localConfig[key];
        needsLocalSave = true;
      }
    });

    if (needsGlobalSave) {
      this._saveConfig(this.globalPath, globalConfig);
      this.globalConfig = globalConfig;
    }
    if (needsLocalSave) {
      this._saveConfig(this.localPath, localConfig);
      this.localConfig = localConfig;
    }
    return needsLocalSave;
  }

  /**
   * Loads a configuration file from a specific path.
   * @param {string} configPath The path to the JSON config file.
   * @returns {object} The loaded configuration object.
   * @private
   */
  _loadConfig(configPath) {
    let content;
    try {
      content = this.#fs.readFileSync(configPath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw new Error(`Cannot read configuration: ${configPath}`, { cause: error });
    }
    let config;
    try {
      config = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON configuration: ${configPath}`, { cause: error });
    }
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`Configuration must contain a JSON object: ${configPath}`);
    }
    return config;
  }

  /**
   * Saves a configuration object to a specific path.
   * @param {string} configPath The path to save the JSON config file.
   * @param {object} configData The configuration object to save.
   * @private
   */
  _saveConfig(configPath, configData) {
    // Serialize before opening files: unsupported values must not affect storage.
    const content = JSON.stringify(configData, null, 4);
    this.#fs.mkdirSync(path.dirname(configPath), { recursive: true });
    let target = configPath;
    let mode = 0o600;
    let existing;
    try {
      existing = this.#fs.lstatSync(configPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (existing) {
      // Keep existing symlinks; a dangling link rejects instead of being replaced.
      if (existing.isSymbolicLink()) target = this.#fs.realpathSync(configPath);
      mode = this.#fs.statSync(target).mode % 0o1000;
    }
    const temporary = path.join(path.dirname(target), `.paser-config-${randomUUID()}.tmp`);
    let descriptor;
    let temporaryExists = false;
    try {
      descriptor = this.#fs.openSync(temporary, "wx", 0o600);
      temporaryExists = true;
      this.#fs.writeFileSync(descriptor, content, "utf8");
      this.#fs.fchmodSync(descriptor, mode);
      this.#fs.fsyncSync(descriptor);
      this.#fs.closeSync(descriptor);
      descriptor = undefined;
      this.#fs.renameSync(temporary, target);
      temporaryExists = false;
    } finally {
      try {
        if (descriptor !== undefined) this.#fs.closeSync(descriptor);
      } finally {
        if (temporaryExists) this.#fs.rmSync(temporary, { force: true });
      }
    }
  }

  /**
   * Retrieves a configuration value by its key.
   * Global keys are always read from the global layer.
   * Local keys are read from the local layer.
   * @param {string} key - The configuration key to retrieve.
   * @param {unknown} [defaultValue] - The value to return if the key is not found.
   * @returns {unknown} The configuration value or the default value.
   */
  get(key, defaultValue = null) {
    const isGlobal = GLOBAL_KEYS.has(key);

    if (isGlobal) {
      if (key in this.globalConfig) return this.globalConfig[key];
      // Preserve legacy values until the caller explicitly migrates storage.
      return key in this.localConfig ? this.localConfig[key] : defaultValue;
    }

    if (key in this.localConfig) return this.localConfig[key];
    if (key in this.globalConfig) return this.globalConfig[key];
    
    return defaultValue;
  }

  /**
   * Sets a configuration value in memory without persisting it to disk.
   * @param {string} key - The configuration key to set.
   * @param {unknown} value - The value to associate with the key.
   * @returns {void}
   */
  setTemporary(key, value) {
    const isGlobal = GLOBAL_KEYS.has(key);
    const config = isGlobal ? this.globalConfig : this.localConfig;
    config[key] = value;
  }

  /**
   * Saves a configuration value and persists it to the appropriate layer.
   * Determines the layer based on the GLOBAL_KEYS whitelist.
   * @param {string} key - The configuration key to save.
   * @param {unknown} value - The value to associate with the key.
   * @returns {void}
   */
  save(key, value) {
    const isGlobal = GLOBAL_KEYS.has(key);
    const config = isGlobal ? this.globalConfig : this.localConfig;
    const configPath = isGlobal ? this.globalPath : this.localPath;

    const updated = { ...config, [key]: value };
    this._saveConfig(configPath, updated);
    if (isGlobal) this.globalConfig = updated;
    else this.localConfig = updated;
  }
}

export default ConfigManager;
