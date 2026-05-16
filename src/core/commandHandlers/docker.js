import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

class DockerCommands {
  static async handle(chatManager, ui, input) {
    const args = input.split(/\s+/).slice(1);
    const subCommand = args[0];
    const val = args[1];

    try {
      switch (subCommand) {
        case "net":
          return await this.handleNet(chatManager, ui, val);
        case "ram":
          return await this.handleRam(chatManager, ui, val);
        case "cpu":
          return await this.handleCpu(chatManager, ui, val);
        default:
          ui.displayError(
            "Usage: /docker [net on|off | ram <val> | cpu <val>]",
          );
          return true;
      }
    } catch (error) {
      ui.displayError(`Docker Error: ${error.message}`);
      return true;
    }
  }

  static async updateEnv(key, value) {
    const envPath = path.join(process.cwd(), ".env");
    let content = await fs.readFile(envPath, "utf-8");
    const regex = new RegExp(`^${key}=.*`, "m");

    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    await fs.writeFile(envPath, `${content.trim()}\n`);
  }

  static async apply() {
    await execAsync("docker compose up -d");
  }

  static async handleNet(chatManager, ui, mode) {
    if (mode === "on") {
      await this.updateEnv("NETWORK_MODE", "bridge");
    } else if (mode === "off") {
      await this.updateEnv("NETWORK_MODE", "none");
    } else {
      ui.displayError("Usage: /docker net on|off");
      return true;
    }
    await this.apply();
    ui.displayInfo(`Docker Network: ${mode === "on" ? "ON" : "OFF"}`);
    return true;
  }

  static async handleRam(chatManager, ui, val) {
    if (!val || !/^[0-9]+[m|g|k]?$/.test(val)) {
      ui.displayError("Usage: /docker ram <val> (e.g., 512m, 1g)");
      return true;
    }
    await this.updateEnv("MEM_LIMIT", val);
    await this.apply();
    ui.displayInfo(`Docker RAM Limit: ${val}`);
    return true;
  }

  static async handleCpu(chatManager, ui, val) {
    if (!val || !/^[0-9]+(\.[0-9]+)?$/.test(val)) {
      ui.displayError("Usage: /docker cpu <val> (e.g., 0.5, 1.0)");
      return true;
    }
    await this.updateEnv("CPU_LIMIT", val);
    await this.apply();
    ui.displayInfo(`Docker CPU Limit: ${val}`);
    return true;
  }
}


export default DockerCommands;
