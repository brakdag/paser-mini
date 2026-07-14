import SmartToolParser from "./smartParser.js";
import ExecutionEngine from "./executionEngine.js";
import CommandHandler from "./commandHandler.js";
import RepetitionDetector from "./repetitionDetector.js";
import logger from "./logger.js";
import ConfigManager from "./configManager.js";
import TurnProcessor from "./turnProcessor.js";

/**
 * ChatManager orchestrates the interaction between the user, the AI assistant,
 * and the tool execution engine. It manages the conversation lifecycle, 
 * configuration, and turn processing.
 */
class ChatManager {
  /**
   * Initializes a new instance of the ChatManager.
   * @param {object} params - The constructor parameters.
   * @param {object} params.assistant - The AI assistant adapter.
   * @param {{[key: string]: (...args: unknown[]) => unknown}} params.tools - The available tools map.
   * @param {string} params.systemInstruction - The system prompt/instructions.
   * @param {object} params.ui - The user interface handler.
   * @param {object} params.user - The shared user identity object.
   * @param {object} params.model - The shared model identity object.
   * @param {boolean} [params.instanceMode] - Whether this is a sub-instance of the agent.
   * @param {ConfigManager|null} [params.configManager] - Optional injected configuration manager.
   */
  constructor({ assistant, tools, systemInstruction, ui, user, model, instanceMode = false, configManager = null }) {
    this.assistant = assistant;
    this.tools = tools;
    this.systemInstruction = systemInstruction;
    this.ui = ui;
    this.user = user;
    this.model = model;
    this.instanceMode = instanceMode;
    this.configManager = configManager || new ConfigManager();
    const DEFAULT_CONTEXT_WINDOW_LIMIT = 0;

    this.contextWindowLimit = parseInt(
      this.configManager.get("context_window_limit", DEFAULT_CONTEXT_WINDOW_LIMIT),
      10,
    );

    this.ui.setBashEnabled(this.configManager.get("execute_enabled", false));
    this.currentChannel = "#main";
    this.timestampsEnabled = this.configManager.get("timestamps_enabled", false);
    this.safemode = this.configManager.get("safemode", false);
    
    this.parser = new SmartToolParser();
    this.engine = new ExecutionEngine(
      this.assistant,
      this.tools,
      this.parser,
      this.ui,
      this.instanceMode,
      null,
      this.systemInstruction === "",
    );
    this.engine.chatManager = this;

    this.commandHandler = new CommandHandler(this, this.ui);
    this.ui.setCommandHandler(this.commandHandler);
    this.repetitionDetector = new RepetitionDetector();
    this.turnProcessor = new TurnProcessor(
      this.assistant,
      this.tools,
      this.parser,
      this.engine,
      this.ui,
      this.repetitionDetector,
    );
    this.turnProcessor.chatManager = this;

    this.ui.setIdentities(this.user, this.model);
    logger.setAgentNickname(this.model.nickname);
    this.setRenderingMode(this.configManager.get("rendering_mode", "IRC"));
    this.immersionMode = this.configManager.get("immersion_mode", false);
    if (this.assistant && this.assistant.setImmersionMode) {
      this.assistant.setImmersionMode(this.immersionMode);
    }
    this.stopRequested = false;
    this.logOpened = false;
  }

  /**
   * Saves a configuration value, respecting the instance mode.
   * @param {string} key - The configuration key.
   * @param {unknown} value - The value to save.
   */
  saveConfig(key, value) {
    if (this.instanceMode) {
      this.configManager.config[key] = value;
      return;
    }
    this.configManager.save(key, value);
  }

  /**
   * Updates the rendering mode for the UI and the assistant.
   * @param {string} mode - The rendering mode (e.g., 'IRC', 'FOUNTAIN').
   */
  setRenderingMode(mode) {
    this.saveConfig("rendering_mode", mode);
    this.ui.setRenderingMode(mode);
    if (this.assistant && this.assistant.setRenderingMode) {
      this.assistant.setRenderingMode(mode);
    }
  }

  /**
   * Toggles the Immersion Mode (raw formatting in API payloads).
   * @param {boolean} active - True to enable, false to disable.
   */
  setImmersionMode(active) {
    this.immersionMode = active;
    this.saveConfig("immersion_mode", active);
    if (this.assistant && this.assistant.setImmersionMode) {
      this.assistant.setImmersionMode(active);
    }
  }

  /**
   * Starts the main chat loop and initializes memory/system contexts.
   * @param {string|null} [initialInput] - Optional initial message to process.
   * @returns {Promise<void>}
   */
  async run(initialInput = null) {
    logger.info("Initializing ChatManager.run");

    this.assistant.setIdentities(this.user, this.model);
    this.assistant.startChat(this.model.name, this.systemInstruction, this.model.temperature);

    if (initialInput) {
      const logMsg = this.ui.getLogOpenedString();
      const welcomeMsg = "System initialized. Ready for input.";
      const combinedMsg = `${logMsg}\n${welcomeMsg}`;

      this.ui.displayChatMessage("system", combinedMsg);
      this.assistant.injectMessage("server", combinedMsg);

      this.logOpened = true;
      await this.processTurn(initialInput);
    }

    if (this.ui.initInput) {
      this.ui.initInput();
    }

    while (!this.stopRequested) {
      try {
        const input = await this.ui.requestInput();
        if (input) {
          if (!this.logOpened && this.systemInstruction) {
            const logMsg = this.ui.getLogOpenedString();
            this.ui.displayChatMessage("system", logMsg);
            this.logOpened = true;
            this.assistant.injectMessage("server", logMsg);
          }

          const handled = await this.commandHandler.handle(input);
          if (!handled) {
            this.ui.displayChatMessage(this.user.nickname, input);
            await this.processTurn(input);
          }
        }
      } catch (e) {
        if (e.name === "UserInterruptException") {
          logger.info("Turn interrupted by user input");
          this.ui.displayInfo("Agent interrupted. Processing new request...");
        } else if (e.name === "APIError") {
          const statusCode = e.response?.status || e.code || e.name;
          this.ui.displayError(
            `AI connection error (${statusCode}): ${e.message}. The session remains active; please try again in a moment.`,
          );
        } else {
          this.ui.displayError(`Critical error in processTurn: ${e.message}`);
          logger.error(`Critical error: ${e.message}`, { stack: e.stack });
        }
      }
    }
  }

  /**
   * Processes a single turn of conversation.
   * @param {string} userInput - The input provided by the user.
   * @returns {Promise<unknown>} The result of the turn processing.
   */
  async processTurn(userInput) {
    return this.turnProcessor.process(userInput);
  }

  /**
   * Stops the execution of the chat loop.
   */
  stopExecution() {
    this.stopRequested = true;
  }

  /**
   * Calculates the current token usage relative to the context window limit.
   * @returns {string} A formatted string showing current/limit and percentage.
   */
  getTokenCount() {
    const systemInstruction = this.systemInstruction || "";
    const history = this.assistant.getHistory ? this.assistant.getHistory() : [];
    
    let count;
    if (typeof this.assistant.countTokens === "function") {
      count = this.assistant.countTokens(systemInstruction, history);
    } else {
      const historyChars = history.reduce((acc, msg) => {
        const content = msg.content || msg.text || "";
        return acc + (typeof content === "string" ? content.length : JSON.stringify(content).length);
      }, 0);
      count = Math.ceil((systemInstruction.length + historyChars) / 4);
    }

    const limit = this.contextWindowLimit || 250000;
    const percentage = (count / limit) * 100;
    return `${count}/${limit}(${percentage.toFixed(1)}%)`;
  }
}

export default ChatManager;