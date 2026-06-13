import MementoManager from "../infrastructure/memento/manager.js";

export default class MemoryTools {
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

      return await this.#memento.pushMemory(
        "agent",
        "general",
        String(data),
        null,
      );
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async getTokenCount() {
    try {
      if (!this.#currentChatManager) {
        return "ERR: Memory context not initialized.";
      }

      return this.#currentChatManager.getTokenCount();
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }
}
