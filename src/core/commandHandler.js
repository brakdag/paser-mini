import SystemCommands from "./commandHandlers/system.js";
import ModelCommands from "./commandHandlers/models.js";
import ConfigCommands from "./commandHandlers/config.js";
import FavoriteCommands from "./commandHandlers/favorites.js";
import SessionCommands from "./commandHandlers/session.js";
import InterfaceCommands from "./commandHandlers/interface.js";
import AICommands from "./commandHandlers/ai.js";

/**
 * Map of exact-match commands to their handler functions.
 * @property {function(import("./chatManager.js").default): void} /q - Exits the application.
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
  /**
   * Resets the current session.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/reset": SystemCommands.handleReset,
  /**
   * Clears the terminal screen.
   * @param {unknown} _ - Unused chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/clear": (_, ui) => SystemCommands.handleClear(ui),
  /**
   * Toggles the bash execution mode.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/execute": (cm, ui) => SystemCommands.handleExecute(cm, ui, ""),
  /**
   * Sets the rendering mode to Fountain.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/fountain": InterfaceCommands.handleFountain,
  /**
   * Sets the rendering mode to IRC.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/irc": InterfaceCommands.handleIRC,
  /**
   * Sets the rendering mode to Clean.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/clean": InterfaceCommands.handleClean,
  /**
   * Enables Immersion Mode.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/true": InterfaceCommands.handleTrue,
  /**
   * Displays the help menu.
   * @param {unknown} _ - Unused chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/help": (_, ui) => InterfaceCommands.handleHelp(ui),
  /**
   * Displays the current configuration.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/config": ConfigCommands.handleConfig,
  /**
   * Reloads the system prompt and tools cache.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/reload": (cm, ui) => SystemCommands.handleReload(cm, ui),
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
   * Rebuilds the system prompt and tools cache.
   * @param {import("./chatManager.js").default} cm - The chat manager instance.
   * @param {object} ui - The UI instance.
   * @returns {void}
   */
  "/cache": (cm, ui) => SystemCommands.handleCache(cm, ui),
};

/**
 * Map of prefix-based commands to their handler functions.
 */
const PREFIX_COMMANDS = {
  /**
   * Rewrites the last message.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/r ": ({ cm, ui, input, prefix }) =>
    SessionCommands.handleRewrite(cm, ui, input.substring(prefix.length).trim()),
  /**
   * Saves the last payload to a file.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/s ": ({ cm, ui, input, prefix }) =>
    SessionCommands.handleSavePayload(
      cm,
      ui,
      input.substring(prefix.length).trim() || "last_request.json",
    ),
  /**
   * Sets the channel topic.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/topic ": ({ cm, ui, input, prefix }) => {
    const topic = input.substring(prefix.length).trim();
    return InterfaceCommands.handleTopic(cm, ui, topic);
  },
  /**
   * Executes an agent tool directly without affecting history.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/tool ": ({ cm, ui, input, prefix }) => {
    const toolCall = input.substring(prefix.length).trim();
    return SystemCommands.handleTool(cm, ui, toolCall);
  },
  /**
   * Sends a message and measures response latency.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/ping ": ({ cm, ui, input, prefix }) => {
    const message = input.substring(prefix.length).trim();
    return SystemCommands.handlePing(cm, ui, message);
  },
  /**
   * Changes the user nickname.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/nick ": ({ cm, ui, input, prefix }) => {
    const newNick = input.substring(prefix.length).trim();
    return InterfaceCommands.handleNick(cm, ui, newNick);
  },
  /**
   * Performs a /me action.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/me ": ({ cm, ui, input, prefix }) => {
    const action = input.substring(prefix.length).trim();
    return InterfaceCommands.handleMe(cm, ui, action);
  },
  /**
   * Performs a screenplay action.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/action ": ({ cm, ui, input, prefix }) => {
    const actionText = input.substring(prefix.length).trim();
    return InterfaceCommands.handleAction(cm, ui, actionText);
  },
  /**
   * Joins a virtual channel.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {void}
   */
  "/join ": ({ cm, ui, input, prefix }) => {
    const channel = input.substring(prefix.length).trim();
    return InterfaceCommands.handleJoin(cm, ui, channel);
  },
  /**
   * Sets the FIFO context window truncation limit.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/trunc ": ({ cm, ui, input }) => SystemCommands.handleTrunc(cm, ui, input),
  /**
   * Sets the rate limit (requests per minute).
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/rpm ": ({ cm, ui, input }) => SystemCommands.handleRpm(cm, ui, input),
  /**
   * Injects a custom AI message into the conversation history.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/paim ": ({ cm, ui, input, prefix }) =>
    AICommands.handlePaim(cm, ui, input.substring(prefix.length).trim()),
  /**
   * Connects to a specific AI provider.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/connect": ({ cm, ui, input }) =>
    AICommands.handleConnect(cm, ui, input.split(/s+/).slice(1).join(" ")),
  /**
   * Lists or queries available AI models.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/models": ({ cm, ui, input }) =>
    ModelCommands.handleModels(cm, ui, input.split(/s+/)),
  /**
   * Manages favorite prompts.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @returns {void}
   */
  "/fav": ({ cm, ui, input }) =>
    FavoriteCommands.handleFav(cm, ui, input.split(/s+/)),
  /**
   * Executes bash commands with arguments.
   * @param {object} param0 - Destructured parameters.
   * @param {import("./chatManager.js").default} param0.cm - The chat manager instance.
   * @param {object} param0.ui - The UI instance.
   * @param {string} param0.input - The raw input string.
   * @param {string} param0.prefix - The command prefix.
   * @returns {Promise<boolean>} True if the operation succeeded.
   */
  "/execute ": ({ cm, ui, input, prefix }) =>
    SystemCommands.handleExecute(cm, ui, input.substring(prefix.length).trim()),
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
    const lowerInput = input.trim().toLowerCase();
    return ["/config"].includes(lowerInput);
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
