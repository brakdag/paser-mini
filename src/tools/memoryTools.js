import MementoManager from "../infrastructure/memento/manager.js";

export class MemoryTools {
  #memento = new MementoManager();
  #currentAssistant = null;
  #currentChatManager = null;

  setMemoryContext(assistant, chatManager) {
    this.#currentAssistant = assistant;
    this.#currentChatManager = chatManager;
  }

  async pushMemory({ data }) {
    try {
      if (!data) {
        return "ERR: No value provided for memory.";
      }

      return await this.#memento.pushMemory("agent", "general", String(data), null);
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async pullMemory({ scope, key, direction }) {
    try {
      return await this.#memento.pullMemory(scope, key, direction);
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async getTokenCount() {
    try {
      if (!this.#currentAssistant || !this.#currentChatManager) {
        return "ERR: Memory context not initialized.";
      }

      const systemInstruction = this.#currentChatManager.systemInstruction || "";
      const historyData =
        typeof this.#currentAssistant.history === "string"
          ? this.#currentAssistant.history
          : JSON.stringify(this.#currentAssistant.history || []);

      const totalLength = systemInstruction.length + historyData.length;
      const count = Math.ceil(totalLength / 4);
      const limit = this.#currentChatManager.contextWindowLimit || 250000;

      const percentage = (count / limit) * 100;
      return `Current tokens (est.): ${count} / ${limit} (${percentage.toFixed(2)}%)`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }
}
