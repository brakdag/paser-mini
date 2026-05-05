import fs from 'fs';
import path from 'path';

export class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'config.json');
    this.config = this._loadConfig();
  }

  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error(`Error loading config: ${e.message}`);
    }
    return {};
  }

  get(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  save(key, value) {
    this.config[key] = value;
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4), 'utf8');
    } catch (e) {
      console.error(`Error saving config: ${e.message}`);
    }
  }
}