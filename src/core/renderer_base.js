class BaseRenderer {
  constructor(ui) {
    this.ui = ui;
  }

  /**
   * @param {Object} message - The raw message object
   * @param {string} message.nickname - The sender's nickname
   * @param {string} message.text - The raw text content
   * @param {string} [message.time] - Formatted timestamp
   * @param {string} [message.type] - 'chat', 'system', 'error', 'info', 'thought'
   * @returns {string} The formatted string for terminal output
   */
  render(_message) {
    throw new Error("render() must be implemented by subclass");
  }
}


export default BaseRenderer;
