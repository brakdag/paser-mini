class FountainAdapter {
  constructor(assistant, ui) {
    this.assistant = assistant;
    this.ui = ui;
  }

  processInput(userInput) {
    const nick =
      userInput.startsWith("* SCENE:") || userInput.startsWith("* ACTION:")
        ? "system"
        : this.ui.userNickname;
    return this.ui._renderFountain(nick, userInput);
  }

  async processResponse(response) {
    const formatted = this.ui._renderFountain(
      this.ui.agentNickname,
      response,
    );
    await this.assistant.popLastMessage();
    await this.assistant.injectMessage("model", formatted);
    return formatted;
  }

  formatToolResults(results) {
    return this.ui._renderFountain("system", results.join("\n"));
  }
}

export default FountainAdapter;