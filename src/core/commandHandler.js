import SystemCommands from "./commandHandlers/system.js";
import ModelCommands from "./commandHandlers/models.js";
import ConfigCommands from "./commandHandlers/config.js";
import FavoriteCommands from "./commandHandlers/favorites.js";
import SessionCommands from "./commandHandlers/session.js";
import InterfaceCommands from "./commandHandlers/interface.js";
import AICommands from "./commandHandlers/ai.js";

/**
 * Map of exact-match commands to their handler functions.
 */
const COMMAND_MAP = {
  /**
   * Exits the application.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @returns {void}
   */
  "/q": (cm) => SystemCommands.handleExit(cm),
  /**
   * Exits the application.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @returns {void}
   */
  "/quit": (cm) => SystemCommands.handleExit(cm),
  /**
   * Exits the application.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @returns {void}
   */
  "/exit": (cm) => SystemCommands.handleExit(cm),
  /**
   * Exits the application.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @returns {void}
   */
  ":q": (cm) => SystemCommands.handleExit(cm),
  "/reset": SystemCommands.handleReset,
  /**
   * Clears the terminal screen.
   * @param {unknown} _ - Unused chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/clear": (_, ui) => SystemCommands.handleClear(ui),
  "/enablebash": SystemCommands.handleEnableBash,
  "/fountain": InterfaceCommands.handleFountain,
  "/irc": InterfaceCommands.handleIRC,
  "/clean": InterfaceCommands.handleClean,
  "/true": InterfaceCommands.handleTrue,
  /**
   * Displays the help menu.
   * @param {unknown} _ - Unused chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/help": (_, ui) => InterfaceCommands.handleHelp(ui),

  "/config": ConfigCommands.handleConfig,
  /**
   * Checks available models.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/mchk": (cm, ui) => ModelCommands.handleModelsCheck(cm, ui),
  /**
   * Shows the current system prompt.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/sp": (cm, ui) => SystemCommands.handleShowSystemPrompt(cm, ui),
  /**
   * Generates response variants.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/variants": (cm, ui, input) =>
    ModelCommands.handleVariants(cm, ui, input.split(/\s+/)),
};

/**
 * Map of prefix-based commands to their handler functions.
 */
const PREFIX_COMMANDS = {
  /**
   * Rewrites the last message.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/r ": (cm, ui, input) =>
    SessionCommands.handleRewrite(cm, ui, input.slice(3).trim()),
  /**
   * Saves the last payload to a file.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/s ": (cm, ui, input) =>
    SessionCommands.handleSavePayload(
      cm,
      ui,
      input.slice(3).trim() || "last_request.json",
    ),
  /**
   * Sets the channel topic.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/topic ": (cm, ui, input) =>
    InterfaceCommands.handleTopic(cm, ui, input.slice(7).trim()),
  /**
   * Executes an agent tool directly without affecting history.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/tool ": (cm, ui, input) =>
    SystemCommands.handleTool(cm, ui, input.slice(6).trim()),
  /**
   * Sends a message and measures response latency.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/ping ": (cm, ui, input) =>
    SystemCommands.handlePing(cm, ui, input.slice(6).trim()),
  /**
   * Changes the user nickname.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/nick ": (cm, ui, input) =>
    InterfaceCommands.handleNick(cm, ui, input.slice(6).trim()),
  /**
   * Performs a /me action.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/me ": (cm, ui, input) =>
    InterfaceCommands.handleMe(cm, ui, input.slice(4).trim()),
  /**
   * Performs a screenplay action.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/action ": (cm, ui, input) =>
    InterfaceCommands.handleAction(cm, ui, input.slice(8).trim()),
  /**
   * Joins a virtual channel.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/join ": (cm, ui, input) =>
    InterfaceCommands.handleJoin(cm, ui, input.slice(6).trim()),
  /**
   * Invokes the Paimal AI assistant.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/paim ": (cm, ui, input) =>
    AICommands.handlePaim(cm, ui, input.slice(6).trim()),
  /**
   * Lists available models.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  /**
   * Connects to an AI provider.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/connect": (cm, ui, input) =>
    AICommands.handleConnect(cm, ui, input.split(/\s+/).slice(1).join(" ")),
  /**
   * Lists available models.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/models": (cm, ui, input) =>
    ModelCommands.handleModels(cm, ui, input.split(/\s+/)),
  /**
   * Manages favorite prompts.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/fav": (cm, ui, input) =>
    FavoriteCommands.handleFav(cm, ui, input.split(/\s+/)),
};

/**
 * Handles the parsing and execution of user-entered commands.
 */
class CommandHandler {
  /**
   * Initializes the CommandHandler.
   * @param {import("./chatManager.js").default} chatManager - The chat manager instance.
   * @param {object} ui - The UI instance.
   */
  constructor(chatManager, ui) {
    this.chatManager = chatManager;
    this.ui = ui;
  }

  /**
   * Handles the /trunc command to dynamically set the FIFO context window truncation limit.
   * @param {string} input - The raw input string (e.g., /trunc 8000).
   * @returns {boolean} True if the command was handled, false otherwise.
   */
  _handleTruncConfig(input) {
    const parts = input.split(/\s+/);
    if (parts.length !== 2) {
      this.ui.displayError("Usage: /trunc <limit_in_tokens> (use 0 to disable)");
      return true;
    }
    const limit = parseInt(parts[1], 10);
    if (Number.isNaN(limit) || limit < 0) {
      this.ui.displayError("Truncation limit must be a positive integer, or 0 to disable.");
      return true;
    }
    this.chatManager.configManager.save("context_window_limit", limit);
    this.chatManager.contextWindowLimit = limit;

    if (limit === 0) {
      this.ui.displayInfo("Context truncation DISABLED. Context window is now infinite.");
    } else {
      this.ui.displayInfo(`Context truncation ENABLED. FIFO limit strictly set to: ${limit} tokens.`);
    }
    return true;
  }

  /**
   * Handles the /rpm command for setting the Rate Per Minute limit.
   * @param {string} input - The raw input string.
   * @returns {boolean} True if the command was handled, false otherwise.
   */
  _handleRpmConfig(input) {
    const parts = input.split(/\s+/);
    if (parts.length !== 2) {
      this.ui.displayError("Usage: /rpm <limit>");
      return true;
    }
    const rpm = parseInt(parts[1], 10);
    if (Number.isNaN(rpm) || rpm < 1) {
      this.ui.displayError("RPM limit must be a positive integer.");
      return true;
    }
    this.chatManager.configManager.save("rpm_limit", rpm);
    this.ui.displayInfo(`RPM limit set to: ${rpm}`);
    return true;
  }

  /**
   * Checks if a command is non-blocking and can be executed without interrupting the agent turn.
   * @param {string} input - The raw input from the user.
   * @returns {boolean} True if the command is non-blocking.
   */
  isNonBlocking(input) {
    const lowerInput = input.trim().toLowerCase();
    return ["/config", "/token"].includes(lowerInput);
  }

  /**
   * Processes the user input to determine if it is a command and executes it.
   * @param {string} userInput - The raw input from the user.
   * @returns {Promise<boolean|void>} True if a command was handled, false if it should be treated as a message.
   */
  async handle(userInput) {
    const input = userInput.trim();
    const lowerInput = input.toLowerCase();

    if (COMMAND_MAP[lowerInput])
      return COMMAND_MAP[lowerInput](this.chatManager, this.ui);

    const prefixKey = Object.keys(PREFIX_COMMANDS).find((key) =>
      lowerInput.startsWith(key),
    );
    if (prefixKey)
      return PREFIX_COMMANDS[prefixKey](this.chatManager, this.ui, input);

    if (input.startsWith("/rpm ")) return this._handleRpmConfig(input);
    if (input.startsWith("/trunc")) return this._handleTruncConfig(input);

    if (input.startsWith("/") || input.startsWith(":")) {
      this.ui.displayError(
        "Invalid command. See /help for available commands.",
      );
      return true;
    }
    return false;
  }
}

export default CommandHandler;