/**
 * Abstract base class for formatting plugins.
 * Defines the contract for transforming text before it is sent to the UI, adapter, or log.
 */
class FormatPlugin {
  /**
   * Formats a standard chat message.
   * @param {string} _nickname - The sender's nickname.
   * @param {string} _text - The message text.
   */
  formatMessage(_nickname, _text) {
    throw new Error("Method 'formatMessage()' must be implemented.");
  }

  /**
   * Formats a system or server message.
   * @param {string} _text - The system message text.
   */
  formatSystem(_text) {
    throw new Error("Method 'formatSystem()' must be implemented.");
  }

  /**
   * Formats a narrative action (e.g., roleplay).
   * @param {string} _nickname - The sender's nickname.
   * @param {string} _text - The action text.
   */
  formatAction(_nickname, _text) {
    throw new Error("Method 'formatAction()' must be implemented.");
  }
}

export default FormatPlugin;
