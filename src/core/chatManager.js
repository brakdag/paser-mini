import SmartToolParser from "./smartParser.js";
import ExecutionEngine from "./executionEngine.js";
import CommandHandler from "./commandHandler.js";
import RepetitionDetector from "./repetitionDetector.js";
import logger from "./logger.js";
import ConfigManager from "./configManager.js";
import TurnProcessor from "./turnProcessor.js";
import ProviderManager from "../infrastructure/providerManager.js";

/**
 * ChatManager orchestrates the interaction between the user, the AI assistant,
 * and the tool execution engine. It manages the conversation lifecycle, 
 * configuration, and turn processing.
 */
class ChatManager {
  /**
   * Initializes a new instance of the ChatManager.
   * @param {object} assistant - The AI assistant adapter.
   * @param {{[key: string]: (...args: unknown[]) => unknown}} tools - The available tools map.
   * @param {string} systemInstruction - The system prompt/instructions.
   * @param {object} ui - The user interface handler.
   * @param {boolean} [instanceMode] - Whether this is a sub-instance of the agent.
   * @param {ConfigManager|null} [configManager] - Optional injected configuration manager.
   * @param {ProviderManager|null} [providerManager] - Optional injected provider manager.
   */
  constructor(assistant, tools, systemInstruction, ui, instanceMode = false, configManager = null, providerManager = null) {
    this.assistant = assistant;
    this.tools = tools;
    this.systemInstruction = systemInstruction;
    this.ui = ui;
    this.instanceMode = instanceMode;
    this.configManager = configManager || new ConfigManager();
    this.providerManager = providerManager || new ProviderManager();
    const DEFAULT_TEMPERATURE = 0.7;
    const DEFAULT_CONTEXT_WINDOW_LIMIT = 250000;
    const DEFAULT_TPM_LIMIT = 15000;

    this.temperature = parseFloat(
      this.configManager.get("default_temperature", DEFAULT_TEMPERATURE),
    );
    this.contextWindowLimit = parseInt(
      this.configManager.get("context_window_limit", DEFAULT_CONTEXT_WINDOW_LIMIT),
      10,
    );
    this.tpmLimit = parseInt(this.configManager.get("tpm_limit", DEFAULT_TPM_LIMIT), 10);
    this.ui.setBashEnabled(false);
    this.currentChannel = "#main";
    this.timestampsEnabled = this.configManager.get(
      "timestamps_enabled",
      false,
    );
    this.safemode = this.configManager.get("safemode", false);
    this.parser = new SmartToolParser();
    this.engine = new ExecutionEngine(
      assistant,
      tools,
      this.parser,
      ui,
      instanceMode,
      null,
      this.systemInstruction === "",
    );
    this.commandHandler = new CommandHandler(this, ui);
    this.ui.setCommandHandler(this.commandHandler);
    this.repetitionDetector = new RepetitionDetector();
    this.turnProcessor = new TurnProcessor(
      assistant,
      tools,
      this.parser,
      this.engine,
      ui,
      this.repetitionDetector,
    );

    this.ui.agentNickname = this.configManager.get(
      "agent_nickname",
      "paser_mini",
    );
    logger.setAgentNickname(this.ui.agentNickname);
    this.ui.userNickname = this.configManager.get("user_nickname", "user");
    this.setRenderingMode(this.configManager.get("rendering_mode", "IRC"));
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
    if (this.assistant) {
      if (this.assistant.setRenderingMode) {
        this.assistant.setRenderingMode(mode);
      } else if (this.assistant.state?.setRenderingMode) {
        this.assistant.state.setRenderingMode(mode);
      }
    }
  }

  /**
   * Placeholder for temperature adjustment logic.
   */
  setTemperature() {}

  /**
   * Updates the current active channel.
   * @param {string} channel - The channel name.
   */
  setCurrentChannel(channel) {
    this.currentChannel = channel;
  }

  /**
   * Signals the manager to stop the execution loop.
   */
  requestExit() {
    this.stopRequested = true;
  }

  /**
   * Switches the AI provider and migrates the conversation history.
   * @param {string} providerId - The ID of the new provider.
   * @param {string} model - The model name to use.
   * @param {number} temperature - The sampling temperature.
   * @returns {Promise<void>}
   */
  async switchProvider(providerId, model, temperature) {
    const oldAssistant = this.assistant;
    let newAssistant;

    try {
      newAssistant = await this.providerManager.createAdapter(
        providerId,
        this.ui,
        this.configManager,
        this.ui.userNickname,
        this.ui.agentNickname,
      );
    } catch (e) {
      this.ui.displayError(`Failed to switch provider: ${e.message}`);
      return;
    }

    // Migrate history
    if (oldAssistant && oldAssistant.getHistory) {
      const history = oldAssistant.getHistory();
      if (history?.length > 0) {
        history.forEach((msg) => {
          const text = msg.text ?? msg.parts?.[0]?.text ?? "";
          newAssistant.injectMessage(msg.role, text);
        });
      }
    }

    this.assistant = newAssistant;
    this.assistant.startChat(model, this.systemInstruction, temperature);

    // Synchronize references
    if (this.turnProcessor) {
      this.turnProcessor.assistant = newAssistant;
      if (this.turnProcessor.api) {
        this.turnProcessor.api.assistant = newAssistant;
      }
      if (this.turnProcessor.fountain) {
        this.turnProcessor.fountain.assistant = newAssistant;
      }
    }
    if (this.engine) {
      this.engine.assistant = newAssistant;
    }

    logger.info(`Provider switched to ${providerId} | Model: ${model}`);
  }

  /**
   * Starts the main chat loop and initializes memory/system contexts.
   * @param {string|null} [initialInput] - Optional initial message to process.
   * @returns {Promise<void>}
   */
  async run(initialInput = null) {
    logger.info("Initializing ChatManager.run");

    const model = this.configManager.get("model_name", "gemini-2.0-flash");
    this.assistant.startChat(model, this.systemInstruction, this.temperature);

    try {
      const { getToolInstance } = await import("../infrastructure/registry.js");
      const memoryTools = await getToolInstance("memoryTools");
      memoryTools.setMemoryContext(this.assistant, this);
      const systemTools = await getToolInstance("systemTools");
      systemTools.setContext(this.assistant, this);
    } catch (e) {
      logger.error("Failed to initialize memory context", e);
    }

    if (initialInput) {
      const logMsg = this.ui.getLogOpenedString();
      const welcomeMsg = "System initialized. Ready for input.";
      const combinedMsg = `${logMsg}
${welcomeMsg}`;

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
            const formattedLog =
              this.ui.renderingMode === "FOUNTAIN"
                ? this.ui._renderFountain("system", logMsg)
                : logMsg;
            this.assistant.injectMessage("server", formattedLog);
          }

          const handled = await this.commandHandler.handle(input);
          if (!handled) {
            this.ui.displayChatMessage(this.ui.userNickname, input);

            await this.processTurn(input);
          }
        }
      } catch (e) {
        if (e.name === "UserInterruptException") {
          logger.info("Turn interrupted by user input");
          this.ui.displayInfo("Agent interrupted. Processing new request...");
        } else if (e.name === "APIError") {
          this.ui.displayError(
            `AI connection error: ${e.message}. The session remains active; please try again in a moment.`,
          );
          logger.error(`API Error: ${e.message}`, e);
        } else {
          this.ui.displayError(`Critical error in processTurn: ${e.message}`);
          logger.error(`Critical error: ${e.message}`, e);
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
    const historyData =
      typeof this.assistant.history === "string"
        ? this.assistant.history
        : JSON.stringify(this.assistant.history || []);

    const totalLength = systemInstruction.length + historyData.length;
    const count = Math.ceil(totalLength / 4);
    const limit = this.contextWindowLimit || 250000;

    const percentage = (count / limit) * 100;
    return `${count}/${limit}(${percentage.toFixed(1)}%)`;
  }
}

export default ChatManager;