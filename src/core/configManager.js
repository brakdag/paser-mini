import fs from "fs";
import os from "os";
import path from "path";

/**
 * Claves que pertenecen al ámbito global del usuario y persisten entre proyectos.
 * @type {Set<string>}
 */
const GLOBAL_KEYS = new Set([
  "favorites",
  "fetch_headers",
  "unavailable_models",
  "user_nickname", // El nick del usuario suele ser global
  "agent_nickname" // El nick del agente suele ser global
]);

/**
 * Manages the application configuration, providing layered persistence:
 * 1. Global (User home `~/.paser-mini/config.json`)
 * 2. Local (Current project `./config/config.json`)
 */
class ConfigManager {
  /**
   * Initializes the ConfigManager and loads configurations from both layers.
   */
  constructor() {
    // Capa Global
    const globalDir = path.join(os.homedir(), ".paser-mini");
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    this.globalPath = path.join(globalDir, "config.json");
    this.globalConfig = this._loadConfig(this.globalPath);

    // Capa Local
    const localDir = path.join(process.cwd(), "config");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    this.localPath = path.join(localDir, "config.json");
    this.localConfig = this._loadConfig(this.localPath);
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
    } catch {
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
   * Retrieves a configuration value by its key, checking local first, then global.
   * @param {string} key - The configuration key to retrieve.
   * @param {unknown} [defaultValue] - The value to return if the key is not found.
   * @returns {unknown} The configuration value or the default value.
   */
  get(key, defaultValue = null) {
    if (key in this.localConfig) return this.localConfig[key];
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
    
    if (isGlobal) {
      this.globalConfig[key] = value;
      this._saveConfig(this.globalPath, this.globalConfig);
    } else {
      this.localConfig[key] = value;
      this._saveConfig(this.localPath, this.localConfig);
    }
  }
}

export default ConfigManager;
