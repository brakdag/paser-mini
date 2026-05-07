import * as memoryTools from '../../tools/memoryTools.js';

export class ConfigCommands {
  static async handleConfig(chatManager, ui) {
    const tokenUsage = await memoryTools.getTokenCount();

    const configInfo = 
      `| Setting | Value |\n` +
      `| :--- | :--- |\n` +
      `| Model | ${chatManager.assistant.currentModel} |\n` +
      `| Temperature | ${chatManager.temperature} |\n` +
      `| Context Window | ${chatManager.configManager.get('context_window_limit', 'N/A')} tokens |\n` +
      `| TPM Limit | ${chatManager.configManager.get('tpm_limit', 'N/A')} |\n` +
      `| RPM Limit | ${chatManager.configManager.get('rpm_limit', 'N/A')} |\n` +
      `| Instance Timeout | ${chatManager.configManager.get('instance_timeout', 300)}s |\n` +
      `| Sandbox Mode | ${chatManager.configManager.get('sandbox_mode', false) ? 'ENABLED' : 'DISABLED'} |\n` +
      `| Safe Mode | ${chatManager.configManager.get('safemode', false) ? 'ENABLED' : 'DISABLED'} |\n` +
      `| Token Usage | ${tokenUsage} |`;

    ui.displayMessage('--- Current Configuration ---\n' + configInfo);
    return true;
  }
}