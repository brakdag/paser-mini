/**
 * Handles configuration-related commands, providing visibility into the current system settings.
 */
class ConfigCommands {
  /**
   * Displays the current system configuration, including provider, model, and resource limits.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleConfig(chatManager, ui) {
    const tokenUsage = chatManager.getTokenCount();

    const truncLimit = chatManager.configManager.get("context_window_limit", 0);
    const truncDisplay = truncLimit === 0 ? "Disabled (provider limits still apply)" : `~${truncLimit} tokens`;

    const configData = [
      ["Provider", chatManager.assistant.providerId || "Unknown"],
      ["Model", chatManager.assistant.currentModel],
      ["Temperature", chatManager.model.temperature],
      ["Rendering Mode", chatManager.ui.renderingMode],
      ["Truncation Limit", truncDisplay],
      ["RPM Limit", chatManager.configManager.get("rpm_limit", "N/A")],
      ["Execute", chatManager.ui.bashEnabled ? "ENABLED" : "DISABLED"],
      ["Estimated Token Usage", tokenUsage],
    ];

    ui.displayInfoPanel("Current Configuration", configData);
    return true;
  }
}

export default ConfigCommands;