import SystemCommands from "./commandHandlers/system.js";
import ModelCommands from "./commandHandlers/models.js";
import ConfigCommands from "./commandHandlers/config.js";
import FavoriteCommands from "./commandHandlers/favorites.js";
import SessionCommands from "./commandHandlers/session.js";
import InterfaceCommands from "./commandHandlers/interface.js";
import AICommands from "./commandHandlers/ai.js";

/**
 * @typedef {object} CommandContext
 * @property {import("./chatManager.js").default} cm The chat manager instance.
 * @property {object} ui The UI instance.
 * @property {string} input The raw input string.
 * @property {string} prefix The matched command prefix.
 * @property {string} payload The extracted argument string.
 */

/**
 * Extracts the argument payload from the input string, minus the command prefix.
 * @param {string} input - The raw input string.
 * @param {string} prefix - The matched command prefix.
 * @returns {string} The trimmed payload.
 */
const getPayload = (input, prefix) => input.substring(prefix.length).trim();

/**
 * Map of exact-match commands to their handler functions.
 * @type {{[key: string]: (cm: import("./chatManager.js").default, ui: object) => Promise<boolean|void> | boolean | void}}
 */
const COMMAND_MAP = {
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<void>} Resolves when exited.
   */
  "/q": SystemCommands.handleExit,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<void>} Resolves when exited.
   */
  "/quit": SystemCommands.handleExit,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<void>} Resolves when exited.
   */
  "/exit": SystemCommands.handleExit,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<void>} Resolves when exited.
   */
  ":q": SystemCommands.handleExit,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/reset": SystemCommands.handleReset,
  /**
   * @param {object} _ The chat manager (unused).
   * @param {object} ui The UI.
   * @returns {boolean} Always true.
   */
  "/clear": (_, ui) => SystemCommands.handleClear(ui),
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/c": (cm, ui) => SessionCommands.handleInjectContext(cm, ui),
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/execute": (cm, ui) => SystemCommands.handleExecute(cm, ui, ""),
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/fountain": InterfaceCommands.handleFountain,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/irc": InterfaceCommands.handleIRC,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/clean": InterfaceCommands.handleClean,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/true": InterfaceCommands.handleTrue,
  /**
   * @param {object} _ The chat manager (unused).
   * @param {object} ui The UI.
   * @returns {void}
   */
  "/help": (_, ui) => InterfaceCommands.handleHelp(ui),
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/config": ConfigCommands.handleConfig,
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/reload": (cm, ui) => SystemCommands.handleReload(cm, ui),
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/mchk": (cm, ui) => ModelCommands.handleModelsCheck(cm, ui),
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/sp": (cm, ui) => SystemCommands.handleShowSystemPrompt(cm, ui),
  /**
   * @param {import("./chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/cache": (cm, ui) => SystemCommands.handleCache(cm, ui),
  /**
   * @param {import("../chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/tools": (cm, ui) => SystemCommands.handleTools(cm, ui),
  /**
   * @param {import("../chatManager.js").default} cm The chat manager.
   * @param {object} ui The UI.
   * @returns {Promise<boolean>} Always true.
   */
  "/mcp": (cm, ui) => SystemCommands.handleMcp(cm, ui, ""),
};

/**
 * Map of prefix-based commands to their handler functions.
 * @type {{[key: string]: (args: CommandContext) => Promise<boolean|void>}}
 */
const PREFIX_COMMANDS = {
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/r ": ({ cm, ui, payload }) =>
    SessionCommands.handleRewrite(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/s ": ({ cm, ui, payload }) =>
    SessionCommands.handleSavePayload(cm, ui, payload || "last_request.json"),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/topic ": ({ cm, ui, payload }) =>
    InterfaceCommands.handleTopic(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/tool ": ({ cm, ui, payload }) =>
    SystemCommands.handleTool(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/ping ": ({ cm, ui, payload }) =>
    SystemCommands.handlePing(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/nick ": ({ cm, ui, payload }) =>
    InterfaceCommands.handleNick(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/me ": ({ cm, ui, payload }) =>
    InterfaceCommands.handleMe(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/action ": ({ cm, ui, payload }) =>
    InterfaceCommands.handleAction(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/join ": ({ cm, ui, payload }) =>
    InterfaceCommands.handleJoin(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/trunc ": ({ cm, ui, payload }) => SystemCommands.handleTrunc(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/rpm ": ({ cm, ui, payload }) => SystemCommands.handleRpm(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/paim ": ({ cm, ui, payload }) =>
    AICommands.handlePaim(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/connect": ({ cm, ui, payload }) =>
    AICommands.handleConnect(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/models": ({ cm, ui, input }) =>
    ModelCommands.handleModels(cm, ui, input.split(/\s+/)),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/fav": ({ cm, ui, input }) =>
    FavoriteCommands.handleFav(cm, ui, input.split(/\s+/)),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/execute ": ({ cm, ui, payload }) =>
    SystemCommands.handleExecute(cm, ui, payload),
  /**
   * @param {CommandContext} args The context.
   * @returns {Promise<boolean>} Always true.
   */
  "/mcp ": ({ cm, ui, payload }) =>
    SystemCommands.handleMcp(cm, ui, payload),
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
   * Checks if a command is non-blocking and can be executed without interrupting the agent turn.
   * @param {string} input - The raw input from the user.
   * @returns {boolean} True if the command is non-blocking.
   */
  isNonBlocking(input) {
    return input.trim().toLowerCase() === "/config";
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
    if (prefixKey) {
      return PREFIX_COMMANDS[prefixKey]({
        cm: this.chatManager,
        ui: this.ui,
        input,
        prefix: prefixKey,
        payload: getPayload(input, prefixKey),
      });
    }

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
