import SmartToolParser from "../smartParser.js";
import promptManager from "../systemPromptManager.js";

/**
 * Handles system-level commands such as clearing the terminal, 
 * exiting the application, and resetting the session.
 */
class SystemCommands {
  /**
   * Initializes the SmartToolParser instance for direct tool execution.
   */
  static parser = new SmartToolParser();

  /**
   * Clears the terminal screen.
   * @returns {boolean} True if the operation succeeded.
   */
  static handleClear() {
    process.stdout.write("\x1Bc");
    return true;
  }

  /**
   * Requests the application to exit and terminates the process.
   * @param {object} chatManager The chat manager instance.
   * @returns {void}
   */
  static handleExit(chatManager) {
    chatManager.requestExit();
    process.exit(0);
  }

  /**
   * Performs a hard reset of the assistant's state.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleReset(chatManager, ui) {
    ui.displayInfo("Performing Hard Reset...");
    ui.displayInfo("Starting fresh.");
    chatManager.assistant.hardReset();
    return true;
  }

  /**
   * Toggles or sets the state of bash execution, persisting it to the configuration.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} args The arguments ('on', 'off', or empty for toggle).
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleExecute(chatManager, ui, args) {
    const currentStatus = ui.bashEnabled;
    let targetStatus = !currentStatus; // Default to toggle

    if (args) {
      const lowerArgs = args.toLowerCase();
      if (lowerArgs === "on") targetStatus = true;
      else if (lowerArgs === "off") targetStatus = false;
    }

    if (targetStatus === currentStatus) {
      ui.displayInfo(`Bash execution is already ${targetStatus ? "ENABLED" : "DISABLED"}.`);
      return true;
    }

    ui.setBashEnabled(targetStatus);
    chatManager.configManager.save("execute_enabled", targetStatus);
    ui.displayInfo(`Bash execution ${targetStatus ? "ENABLED" : "DISABLED"}.`);

    const stateChangeMsg = targetStatus
      ? "SYSTEM UPDATE: Bash access has been enabled. You now have access to the tool `execute(command: string)`, which allows you to execute shell commands in the project root."
      : "SYSTEM UPDATE: Bash access has been disabled. The tool `execute` is no longer available.";
    
    chatManager.assistant.injectMessage("server", ui.formatSystemMessage(stateChangeMsg));
    return true;
  }

  /**
   * Handles the /trunc command to dynamically set the FIFO context window truncation limit.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} input The arguments (e.g., 8000).
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleTrunc(chatManager, ui, input) {
    const parts = input.split(/\s+/);
    if (parts.length !== 2) {
      ui.displayError("Usage: /trunc <limit_in_tokens> (use 0 to disable)");
      return true;
    }
    const limit = parseInt(parts[1], 10);
    if (Number.isNaN(limit) || limit < 0) {
      ui.displayError("Truncation limit must be a positive integer, or 0 to disable.");
      return true;
    }
    chatManager.configManager.save("context_window_limit", limit);
    chatManager.setContextWindowLimit(limit);

    if (limit === 0) {
      ui.displayInfo("Context truncation DISABLED. Context window is now infinite.");
    } else {
      ui.displayInfo(`Context truncation ENABLED. FIFO limit strictly set to: ${limit} tokens.`);
    }
    return true;
  }

  /**
   * Handles the /rpm command for setting the Rate Per Minute limit.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} input The arguments (e.g., 60).
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleRpm(chatManager, ui, input) {
    const parts = input.split(/\s+/);
    if (parts.length !== 2) {
      ui.displayError("Usage: /rpm <limit>");
      return true;
    }
    const rpm = parseInt(parts[1], 10);
    if (Number.isNaN(rpm) || rpm < 1) {
      ui.displayError("RPM limit must be a positive integer.");
      return true;
    }
    chatManager.configManager.save("rpm_limit", rpm);
    ui.displayInfo(`RPM limit set to: ${rpm}`);
    return true;
  }

  /**
   * Forces a cache rebuild and hot-reloads the system prompt and tools.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleCache(chatManager, ui) {
    try {
      ui.displayInfo("Forcing system cache rebuild...");
      const { systemInstruction, filteredTools } = await promptManager.rebuildCache();

      chatManager.updateSystemContext(systemInstruction, filteredTools);

      promptManager.saveCache();
      ui.displayInfo("Cache rebuilt and updated successfully.");
    } catch (e) {
      ui.displayError(`Failed to rebuild cache: ${e.message}`);
    }
    return true;
  }

  /**
   * Changes the agent nickname using the shared identity object.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} newNick The new nickname.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleNick(chatManager, ui, newNick) {
    chatManager.updateModelNickname(newNick);
    ui.displayInfo(`Agent nickname successfully changed to '${newNick}'`);
    return true;
  }

  /**
   * Displays the current system prompt to the user.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleShowSystemPrompt(chatManager, ui) {
    const { systemInstruction } = chatManager;
    ui.displayInfo("--- CURRENT SYSTEM PROMPT ---");
    ui.displayMessage(systemInstruction);
    ui.displayInfo("----------------------------");
    return true;
  }

  /**
   * Sends a message to the agent and measures response latency in milliseconds.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} message The message to send to the agent.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handlePing(chatManager, ui, message) {
    if (!message) {
      ui.displayError("Usage: /ping <message>");
      return true;
    }
    ui.displayChatMessage(ui.userNickname, message);
    const start = Date.now();
    await chatManager.processTurn(message);
    const elapsed = Date.now() - start;
    ui.displayInfo(`${elapsed}ms pong`);
    return true;
  }

  /**
   * Executes an agent tool directly and displays the result without modifying history.
   * @param {object} chatManager The chat manager instance.
   * @param {object} ui The terminal UI instance.
   * @param {string} rawToolCall The raw tool call expression (e.g. read("file.js")).
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  static async handleTool(chatManager, ui, rawToolCall) {
    const { data, error } = SystemCommands.parser.parseCall(rawToolCall);
    if (error || !data) {
      ui.displayError(`Tool Parse Error: ${error || "Invalid format"}`);
      return true;
    }

    try {
      ui.displayInfo(`Executing tool: ${data.name}`);
      const { result } = await chatManager.engine.executeToolCall(
        data.name,
        data.args,
      );
      
      const output = typeof result === "object" 
        ? JSON.stringify(result, null, 2) 
        : result;
      
      ui.displayMessage(`\n[Tool Output]\n${output}\n`);
    } catch (e) {
      ui.displayError(`Execution Error: ${e.message}`);
    }
    return true;
  }
}

export default SystemCommands;