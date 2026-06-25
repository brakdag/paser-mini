import MementoManager from "./mementoManager.js";

/** Memory management tools. */
export default class MemoryTools {
  #memento = new MementoManager();

  #currentAssistant = null;

  #currentChatManager = null;

  /**
   * Set context.
   * @param {object} assistant Assistant.
   * @param {object} chatManager ChatManager.
   */
  setMemoryContext(assistant, chatManager) {
    this.#currentAssistant = assistant;
    this.#currentChatManager = chatManager;
  }

  /**
   * Push memory.
   * @param {object} args Args object.
   * @param {string} args.data Data to store.
   * @returns {Promise<string>} Result.
   */
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

  /**
   * Get token count.
   * @returns {Promise<string>} Result.
   */
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