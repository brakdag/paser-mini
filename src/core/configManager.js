import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Manages the application configuration, providing persistence to a JSON file.
 */
class ConfigManager {
  /**
   * Initializes the ConfigManager and loads the configuration from disk.
   */
  constructor() {
    this.configPath = path.join(process.cwd(), "config", "config.json");
    this.config = this._loadConfig();
  }

  /**
   * Loads the configuration from the JSON file. Returns an empty object if the file does not exist or is invalid.
   * @returns {object} The loaded configuration object.
   */
  _loadConfig() {
    try {
      return fs.existsSync(this.configPath)
        ? JSON.parse(fs.readFileSync(this.configPath, "utf8"))
        : {};
    } catch {
      return {};
    }
  }

  /**
   * Retrieves a configuration value by its key.
   * @param {string} key - The configuration key to retrieve.
   * @param {unknown} [defaultValue] - The value to return if the key is not found.
   * @returns {unknown} The configuration value or the default value.
   */
  get(key, defaultValue = null) {
    return this.config[key] ?? defaultValue;
  }

  /**
   * Saves a configuration value and persists the updated configuration to the JSON file.
   * @param {string} key - The configuration key to save.
   * @param {unknown} value - The value to associate with the key.
   * @returns {void}
   */
  save(key, value) {
    this.config[key] = value;
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(this.config, null, 4),
      "utf8",
    );
  }
}

export default ConfigManager;