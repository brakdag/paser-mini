// Navigation: See /robots.txt for the Cognitive Navigation Map
import SmartToolParser from "./smartParser.js";
import ExecutionEngine from "./executionEngine.js";
import CommandHandler from "./commandHandler.js";
import RepetitionDetector from "./repetitionDetector.js";
import logger from "./logger.js";
import ConfigManager from "./configManager.js";
import TurnProcessor from "./turnProcessor.js";
import HistoryManager from "./historyManager.js";
import ProviderManager from "../infrastructure/providerManager.js";

class ChatManager {
  constructor(assistant, tools, systemInstruction, ui, instanceMode = false) {
    this.assistant = assistant;
    this.tools = tools;
    this.systemInstruction = systemInstruction;
    this.ui = ui;
    this.instanceMode = instanceMode;
    this.configManager = new ConfigManager();
    this.providerManager = new ProviderManager();
    this.temperature = parseFloat(
      this.configManager.get("default_temperature", 0.7),
    );
    this.contextWindowLimit = parseInt(
      this.configManager.get("context_window_limit", 250000),
      10,
    );
    this.tpmLimit = parseInt(this.configManager.get("tpm_limit", 15000), 10);
    this.ui.bashEnabled = false;
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
    this.repetitionDetector = new RepetitionDetector();
    this.turnProcessor = new TurnProcessor(
      assistant,
      tools,
      this.parser,
      this.engine,
      ui,
      this.repetitionDetector,
    );
    this.historyManager = new HistoryManager(assistant, ui, this.configManager);

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

  saveConfig(key, value) {
    if (this.instanceMode) {
      this.configManager.config[key] = value;
      return;
    }
    this.configManager.save(key, value);
  }

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

  async run(initialInput = null) {
    logger.info("Initializing ChatManager.run");

    const model = this.configManager.get("model_name", "gemini-2.0-flash");
    this.assistant.startChat(model, this.systemInstruction, this.temperature);

    try {
      const { getToolInstance } = await import("../tools/registry.js");
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
        // eslint-disable-next-line no-await-in-loop
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

          // eslint-disable-next-line no-await-in-loop
          const handled = await this.commandHandler.handle(input);
          if (!handled) {
            this.ui.displayChatMessage(this.ui.userNickname, input);
            // eslint-disable-next-line no-await-in-loop
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

  async processTurn(userInput) {
    return this.turnProcessor.process(userInput);
  }

  stopExecution() {
    this.stopRequested = true;
  }

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
    return `Current tokens (est.): ${count} / ${limit} (${percentage.toFixed(2)}%)`;
  }
}

export default ChatManager;