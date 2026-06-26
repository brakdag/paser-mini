import MementoManager from "./mementoManager.js";

/**
 * Memory management tools providing an interface to the memento system.
 */
export default class MemoryTools {
  #memento = new MementoManager();
  #currentAssistant = null;
  #currentChatManager = null;

  /**
   * Set the operational context for memory tools.
   * @param {object} assistant The assistant instance.
   * @param {object} chatManager The chat manager instance.
   */
  setMemoryContext(assistant, chatManager) {
    this.#currentAssistant = assistant;
    this.#currentChatManager = chatManager;
  }

  /**
   * Push a new memory entry into the memento log.
   * @param {object} options - Memory options.
   * @param {string} options.data - The data to store.
   * @returns {Promise<string>} Confirmation message from the memento manager.
   * @throws {Error} If no data is provided or the storage operation fails.
   */
  async pushMemory({ data }) {
    if (!data) {
      throw new Error("No value provided for memory.");
    }

    return this.#memento.pushMemory(
      "agent",
      "general",
      String(data),
      null,
    );
  }

  /**
   * Retrieves the current token count from the chat manager.
   * @returns {Promise<string>} The current token count.
   * @throws {Error} If the memory context has not been initialized.
   */
  async getTokenCount() {
    if (!this.#currentChatManager) {
      throw new Error("Memory context not initialized.");
    }

    return this.#currentChatManager.getTokenCount();
  }
}
