/**
 * Adapts input and output to the Fountain screenplay format.
 */
class FountainAdapter {
  /**
   * Initializes the FountainAdapter.
   * @param {object} assistant - The assistant instance for message manipulation.
   * @param {object} ui - The UI instance for rendering Fountain content.
   */
  constructor(assistant, ui) {
    this.assistant = assistant;
    this.ui = ui;
  }

  /**
   * Processes user input and renders it using the Fountain format.
   * @param {string} userInput - The raw input string from the user.
   * @returns {string} The rendered Fountain string.
   */
  processInput(userInput) {
    const nick =
      userInput.startsWith("* SCENE:") || userInput.startsWith("* ACTION:")
        ? "system"
        : this.ui.userNickname;
    return this.ui._renderFountain(nick, userInput);
  }

  /**
   * Processes the model response, renders it in Fountain format, and updates the assistant history.
   * @param {string} response - The raw response string from the model.
   * @returns {Promise<string>} The rendered Fountain string.
   */
  async processResponse(response) {
    const formatted = this.ui._renderFountain(
      this.ui.agentNickname,
      response,
    );
    await this.assistant.popLastMessage();
    await this.assistant.injectMessage("model", formatted);
    return formatted;
  }

  /**
   * Formats tool execution results into a Fountain-compatible string.
   * @param {string[]} results - An array of result strings from tool executions.
   * @returns {string} The rendered Fountain string containing all results.
   */
  formatToolResults(results) {
    return this.ui._renderFountain("system", results.join("\n"));
  }
}

export default FountainAdapter;