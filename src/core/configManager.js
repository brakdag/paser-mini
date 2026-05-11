import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
    this.config = this._loadConfig();
  }

  _loadConfig() {
    try {
      return fs.existsSync(this.configPath) ? JSON.parse(fs.readFileSync(this.configPath, 'utf8')) : {};
    } catch (e) {
      return {};
    }
  }

  get(key, defaultValue = null) {
    return this.config[key] ?? defaultValue;
  }

  save(key, value) {
    this.config[key] = value;
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4), 'utf8');
  }
}