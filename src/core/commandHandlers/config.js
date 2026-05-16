import * as memoryTools from "../../tools/memoryTools.js";

export class ConfigCommands {
  static async handleConfig(chatManager, ui) {
    const tokenUsage = await memoryTools.getTokenCount();

    const configInfo = `| Setting | Value |
| :--- | :--- |
| Model | ${chatManager.assistant.currentModel} |
| Temperature | ${chatManager.temperature} |
| Rendering Mode | ${chatManager.ui.renderingMode} |
| Context Window | ${chatManager.configManager.get("context_window_limit", "N/A")} tokens |
| TPM Limit | ${chatManager.configManager.get("tpm_limit", "N/A")} |
| RPM Limit | ${chatManager.configManager.get("rpm_limit", "N/A")} |
| Instance Timeout | ${chatManager.configManager.get("instance_timeout", 300)}s |
| Sandbox Mode | ${chatManager.configManager.get("sandbox_mode", false) ? "ENABLED" : "DISABLED"} |
| Safe Mode | ${chatManager.configManager.get("safemode", false) ? "ENABLED" : "DISABLED"} |
| Token Usage | ${tokenUsage} |`;

    ui.displayMessage(`--- Current Configuration ---\n${configInfo}`);
    return true;
  }
}
