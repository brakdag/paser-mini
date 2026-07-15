import fs from "fs";
import os from "os";
import path from "path";

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
  /**
   * Initializes the ConfigManager and loads configurations from both layers.
   */
  constructor() {
    // Global Layer
    const globalDir = path.join(os.homedir(), ".paser-mini");
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    this.globalPath = path.join(globalDir, "config.json");
    this.globalConfig = this._loadConfig(this.globalPath);

    // Local Layer
    const localDir = path.join(process.cwd(), ".paser-mini/config");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    this.localPath = path.join(localDir, "config.json");
    this.localConfig = this._loadConfig(this.localPath);

    // Automatic migration: if global keys exist in the local file, they are moved to the global one.
    this._migrateGlobalKeys();
  }

  /**
   * Moves any global keys found in the local config to the global config.
   * This ensures data integrity when the GLOBAL_KEYS set is updated.
   * @private
   * @returns {void}
   */
  _migrateGlobalKeys() {
    let needsLocalSave = false;
    let needsGlobalSave = false;

    GLOBAL_KEYS.forEach((key) => {
      if (key in this.localConfig) {
        // Only migrate if it does not already exist globally (prevents overwriting more recent data)
        if (!(key in this.globalConfig)) {
          this.globalConfig[key] = this.localConfig[key];
          needsGlobalSave = true;
        }
        delete this.localConfig[key];
        needsLocalSave = true;
      }
    });

    if (needsGlobalSave) {
      this._saveConfig(this.globalPath, this.globalConfig);
    }
    if (needsLocalSave) {
      this._saveConfig(this.localPath, this.localConfig);
    }
  }

  /**
   * Loads a configuration file from a specific path.
   * @param {string} configPath The path to the JSON config file.
   * @returns {object} The loaded configuration object.
   * @private
   */
  _loadConfig(configPath) {
    try {
      return fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, "utf8"))
        : {};
    } catch (error) {
      console.error(`Failed to load config from ${configPath}:`, error);
      return {};
    }
  }

  /**
   * Saves a configuration object to a specific path.
   * @param {string} configPath The path to save the JSON config file.
   * @param {object} configData The configuration object to save.
   * @private
   */
  _saveConfig(configPath, configData) {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 4), "utf8");
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
      return key in this.globalConfig ? this.globalConfig[key] : defaultValue;
    }

    if (key in this.localConfig) return this.localConfig[key];
    // Fallback in case a local key is searched that does not exist locally but does globally
    if (key in this.globalConfig) return this.globalConfig[key];
    
    return defaultValue;
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

    config[key] = value;
    this._saveConfig(configPath, config);
  }
}

export default ConfigManager;
