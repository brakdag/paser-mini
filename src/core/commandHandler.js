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
  "/kick": SystemCommands.handleKick,
  "/enablebash": SystemCommands.handleEnableBash,
  "/compact": SessionCommands.handleCompact,
  "/fountain": InterfaceCommands.handleFountain,
  "/irc": InterfaceCommands.handleIRC,
  "/clean": InterfaceCommands.handleClean,
  /**
   * Displays the help menu.
   * @param {unknown} _ - Unused chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/help": (_, ui) => InterfaceCommands.handleHelp(ui),
  "/connect": AICommands.handleConnect,
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
   * Inserts a file's content into the chat.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @param {string} input - The raw input string.
   * @returns {void}
   */
  "/insertfile ": (cm, ui, input) =>
    InterfaceCommands.handleInsertFile(cm, ui, input.slice(12).trim()),
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
   * Handles the /w command for window configuration.
   * @param {string} input - The raw input string.
   * @returns {boolean} True if the command was handled, false otherwise.
   */
  _handleWindowConfig(input) {
    const parts = input.split(/\s+/);
    if (parts.length !== 4) {
      this.ui.displayError("Usage: /w <tokens> <rpm_limit> <tpm_limit>");
      return true;
    }
    const [, tokens, rpm, tpm] = parts.map((p) => parseInt(p, 10));
    this.chatManager.configManager.save("context_window_limit", tokens);
    this.chatManager.configManager.save("rpm_limit", rpm);
    this.chatManager.configManager.save("tpm_limit", tpm);
    this.ui.displayInfo(
      `Context window: ${tokens} | RPM: ${rpm} | TPM: ${tpm}`,
    );
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

    if (input.startsWith("/w ")) return this._handleWindowConfig(input);

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