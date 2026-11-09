import { isDeepStrictEqual } from "node:util";
import SmartToolParser from "./smartParser.js";
import ExecutionEngine from "./executionEngine.js";
import CommandHandler from "./commandHandler.js";
import RepetitionDetector from "./repetitionDetector.js";
import logger from "./logger.js";
import ConfigManager from "./configManager.js";
import TurnProcessor from "./turnProcessor.js";
import { estimateContextTokens } from "../infrastructure/contextBudget.js";

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
   * @param {boolean} [params.pureMode] - Whether tool execution is explicitly disabled.
   * @param {object} params.ui - The user interface handler.
   * @param {object} params.user - The shared user identity object.
   * @param {object} params.model - The shared model identity object.
   * @param {boolean} [params.instanceMode] - Whether this is a sub-instance of the agent.
   * @param {ConfigManager|null} [params.configManager] - Optional injected configuration manager.
   */
  constructor({ assistant, tools, systemInstruction, pureMode = false, ui, user, model, instanceMode = false, configManager = null }) {
    this.assistant = assistant;
    this.tools = tools;
    this.systemInstruction = systemInstruction;
    this.pureMode = pureMode;
    this.ui = ui;
    this.user = user;
    this.model = model;
    this.instanceMode = instanceMode;
    this.providerManager = null;
    this.toolContexts = null;
    this.prepareToolContexts = null;
    this._reconfiguring = false;
    this.configManager = configManager || new ConfigManager();
    const DEFAULT_CONTEXT_WINDOW_LIMIT = 0;

    this.contextWindowLimit = parseInt(
      this.configManager.get("context_window_limit", DEFAULT_CONTEXT_WINDOW_LIMIT),
      10,
    );

    this.ui.setBashEnabled(this.configManager.get("execute_enabled", false));
    this.currentChannel = "#main";
    
    this.parser = new SmartToolParser();
    this.engine = new ExecutionEngine(
      this.tools,
      this.parser,
      this.ui,
      { pureMode: this.pureMode },
    );
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
    this._lastTurn = null;
    this._turnInProgress = false;
  }

  /**
   * Getter for the current model temperature, delegating to the shared model identity.
   * @returns {number} The current temperature.
   */
  get temperature() {
    return this.model.temperature;
  }

  /**
   * Signals the main loop to stop execution and exit.
   */
  requestExit() {
    this.stopRequested = true;
    this.turnProcessor.cancelPendingTurn();
    this.ui.close?.();
  }

  /**
   * Sets the current active channel.
   * @param {string} channel - The channel name.
   */
  setCurrentChannel(channel) {
    this.currentChannel = channel;
  }

  /**
   * Switches the current AI provider, model, and temperature dynamically.
   * @param {object} params - The switch parameters object.
   * @param {string} params.providerId - The target provider ID.
   * @param {string} params.modelName - The target model name.
   * @param {number} params.temp - The target temperature.
   */
  async switchProvider({ providerId, modelName, temp }) {
    if (this._turnInProgress || this._reconfiguring) {
      throw new Error("Wait for the active turn or reconfiguration to finish.");
    }
    if (!modelName?.trim() || !Number.isFinite(temp)) {
      throw new Error("A model name and finite temperature are required.");
    }
    this._reconfiguring = true;
    try {
      const previous = this.assistant;
      const preserveHistory = previous.providerId === providerId;
      const nextModel = { ...this.model, name: modelName, temperature: temp };
      const candidate = await this.providerManager.createAdapter({
        providerId, ui: this.ui, configManager: this.configManager,
        userNickname: this.user.nickname, agentNickname: this.model.nickname,
      });
      candidate.setIdentities({ ...this.user }, nextModel);
      candidate.setRenderingMode(this.renderingMode);
      candidate.setImmersionMode(this.immersionMode);
      await candidate.startChat(modelName, this.systemInstruction, temp);
      if (preserveHistory) {
        const history = candidate.getHistory();
        history.splice(0, history.length, ...structuredClone(previous.getHistory()));
        candidate.updateSystemInstruction(this.systemInstruction);
      }
      candidate.checkContextLimit?.(this.contextWindowLimit);
      candidate.setIdentities(this.user, this.model);
      this.bindToolContexts(candidate);
      Object.assign(this.model, nextModel);
      this.assistant = candidate;
      this.turnProcessor.assistant = candidate;
      this.turnProcessor.api.assistant = candidate;
      this._lastTurn = null;
      this.repetitionDetector.reset();
      this.engine.toolTracker.reset();
      if (!preserveHistory) this.ui.displayInfo("Provider changed: conversation history restarted.");
    } finally {
      this._reconfiguring = false;
    }
  }

  /**
   * Binds session tools to the active adapter, including sessions started in pure mode.
   * @param {object} [assistant] - Prepared adapter to bind.
   */
  bindToolContexts(assistant = this.assistant) {
    if (!this.toolContexts) return;
    const { memory, system, util } = this.toolContexts;
    memory.setMemoryContext(this);
    system.setContext(assistant, this);
    util.setIdentityContext(this.model);
  }

  /**
   * Changes temperature through the same prepared-adapter operation.
   * @param {number} temp - New temperature.
   * @returns {Promise<void>} Reconfiguration completion.
   */
  async setTemperature(temp) {
    await this.switchProvider({ providerId: this.assistant.providerId, modelName: this.model.name, temp });
  }

  /**
   * Updates the system instruction and tools registry dynamically.
   * @param {string} systemInstruction - The new system prompt.
   * @param {object} tools - The new tools object.
   * @param {boolean} [pureMode] - The explicit execution mode, retained when omitted.
   */
  async updateSystemContext(systemInstruction, tools, pureMode = this.pureMode) {
    if (this._turnInProgress || this._reconfiguring) {
      throw new Error("Wait for the active turn or reconfiguration to finish.");
    }
    this._reconfiguring = true;
    try {
      if (!pureMode) await this.prepareToolContexts?.();
      const history = structuredClone(this.assistant.getHistory());
      try {
        this.assistant.updateSystemInstruction?.(systemInstruction);
      } catch (error) {
        this.assistant.systemInstruction = this.systemInstruction;
        const current = this.assistant.getHistory();
        current.splice(0, current.length, ...history);
        throw error;
      }
      this.systemInstruction = systemInstruction;
      this.pureMode = pureMode;
      this.tools = tools;
      this.engine.tools = tools;
      this.engine.strictPureMode = pureMode;
      this.turnProcessor.tools = tools;
    } finally {
      this._reconfiguring = false;
    }
  }

  /**
   * Updates the user's nickname in the shared identity, config, and assistant.
   * @param {string} newNick - The new user nickname.
   */
  updateUserNickname(newNick) {
    this.configManager.save("user_nickname", newNick);
    this.user.nickname = newNick;
    if (this.assistant && this.assistant.setIdentities) {
      this.assistant.setIdentities(this.user, this.model);
    }
  }

  /**
   * Sets a new context window truncation limit and persists it to the configuration.
   * @param {number} limit - The token limit.
   */
  setContextWindowLimit(limit) {
    this.assistant.checkContextLimit?.(limit);
    this.contextWindowLimit = limit;
    this.saveConfig("context_window_limit", limit);
  }

  /**
   * Updates the agent's nickname across the UI and shared identity.
   * @param {string} newNick - The new agent nickname.
   */
  updateModelNickname(newNick) {
    this.model.nickname = newNick;
    if (this.ui && this.ui.setIdentities) {
      this.ui.setIdentities(this.user, this.model);
    }
  }

  /**
   * Saves a configuration value, respecting the instance mode.
   * @param {string} key - The configuration key.
   * @param {unknown} value - The value to save.
   */
  saveConfig(key, value) {
    if (this.instanceMode) {
      this.configManager.setTemporary(key, value);
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
    this.renderingMode = mode;
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
   * Initializes the adapter without opening terminal input or requesting another turn.
   */
  initializeSession() {
    this.assistant.setIdentities(this.user, this.model);
    this.assistant.startChat(this.model.name, this.systemInstruction, this.model.temperature);
  }

  /**
   * Runs one complete conversation turn and waits for asynchronous UI publications.
   * @param {string} input - The initial issue or message.
   * @returns {Promise<void>} Resolves after the turn and its publications finish.
   */
  async runOnce(input) {
    this.initializeSession();
    const failures = [];
    try {
      await this.processTurn(input);
    } catch (error) {
      failures.push(error);
    }
    try {
      await this.ui.flush?.();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "Turn and UI publication failed");
  }

  /**
   * Starts the main chat loop and initializes memory/system contexts.
   * @param {string|null} [initialInput] - Optional initial message to process.
   * @returns {Promise<void>}
   */
  async run(initialInput = null) {
    logger.info("Initializing ChatManager.run");

    this.initializeSession();

    if (this.ui.initInput) {
      this.ui.initInput();
    }

    if (initialInput) {
      const logMsg = this.ui.getLogOpenedString();
      const welcomeMsg = "System initialized. Ready for input.";
      const combinedMsg = `${logMsg}\n${welcomeMsg}`;

      // Mostramos el mensaje visualmente en la UI, pero NO se inyecta al historial del modelo para evitar contaminar el contexto.
      this.ui.displayChatMessage("system", combinedMsg);
      this.logOpened = true;
      try {
        await this.processTurn(initialInput);
      } catch (error) {
        if (error.name !== "UserInterruptException") throw error;
        this.ui.displayInfo("Agent interrupted. Processing new request...");
      }
    }

    while (!this.stopRequested) {
      try {
        const input = await this.ui.requestInput();
        if (input === null || this.stopRequested) {
          this.requestExit();
          break;
        }
        if (input) {
          if (!this.logOpened && this.systemInstruction) {
            const logMsg = this.ui.getLogOpenedString();
            // Mostramos el mensaje visualmente en la UI, pero NO se inyecta al historial del modelo para evitar contaminar el contexto.
            this.ui.displayChatMessage("system", logMsg);
            this.logOpened = true;
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
    if (!userInput?.trim()) return undefined;
    if (this._reconfiguring) throw new Error("Session reconfiguration is in progress.");
    const { assistant } = this;
    const before = structuredClone(assistant.getHistory());
    this._turnInProgress = true;
    try {
      const result = await this.turnProcessor.process(userInput);
      this._lastTurn = { assistant, before, after: structuredClone(assistant.getHistory()) };
      return result;
    } finally {
      this._turnInProgress = false;
    }
  }

  /**
   * Replaces the last tracked turn, including tool exchanges, restoring history on failure.
   * Tool side effects outside conversation history are not reverted.
   * @param {string} userInput - The replacement user message.
   * @returns {Promise<boolean>} Whether a tracked turn was rewritten successfully.
   */
  async rewriteLastTurn(userInput) {
    if (!userInput?.trim()) {
      this.ui.displayError("Usage: /rewrite <message> (or /r <message>).");
      return false;
    }
    if (this._turnInProgress) {
      this.ui.displayError("Wait for the active turn to finish before rewriting.");
      return false;
    }
    const previous = this._lastTurn;
    if (!previous || previous.assistant !== this.assistant || !isDeepStrictEqual(previous.after, this.assistant.getHistory())) {
      this.ui.displayError("No unchanged tracked turn to rewrite. Send a new message first.");
      return false;
    }

    const historyBefore = structuredClone(this.assistant.getHistory());
    const repetitionBefore = structuredClone(this.repetitionDetector.buffer);
    try {
      const history = this.assistant.getHistory();
      history.splice(0, history.length, ...structuredClone(previous.before));
      this.repetitionDetector.reset();
      await this.processTurn(userInput);
      return true;
    } catch (error) {
      const history = this.assistant.getHistory();
      history.splice(0, history.length, ...historyBefore);
      this.repetitionDetector.buffer = repetitionBefore;
      this._lastTurn = previous;
      throw error;
    }
  }

  /**
   * Stops the execution of the chat loop.
   */
  stopExecution() {
    this.stopRequested = true;
    this.turnProcessor.cancelPendingTurn();
  }

  /**
   * Estimates token usage from the system instruction and history.
   * @returns {number} The character-based estimate.
   * @private
   */
  _calculateTokenCount() {
    const systemInstruction = this.systemInstruction || "";
    const history = this.assistant.getHistory ? this.assistant.getHistory() : [];

    const charsPerToken = typeof this.assistant.getCharsPerToken === "function" ? this.assistant.getCharsPerToken() : 3.5;
    return estimateContextTokens(history, systemInstruction, charsPerToken);
  }

  /**
   * Estimates current token usage relative to the context window limit.
   * @returns {string} A formatted string showing current/limit and percentage.
   */
  getTokenCount() {
    const usage = this.assistant.getContextUsage?.();
    const count = usage?.input ?? this._calculateTokenCount();
    const limit = usage?.limit ?? this.contextWindowLimit;
    if (!limit) return `~${count} input tokens (local limit disabled)`;
    const reserved = (usage?.output ?? 4096) + (usage?.overhead ?? 500);
    const total = count + reserved;
    return `~${total}/${limit}(${((total / limit) * 100).toFixed(1)}%; ${reserved} reserved)`;
  }
}

export default ChatManager;
