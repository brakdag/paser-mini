export default class BaseAdapter {
  constructor(
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  ) {
    if (this.constructor === BaseAdapter) {
      throw new Error(
        "BaseAdapter is an abstract class and cannot be instantiated directly.",
      );
    }
    this.ui = ui;
    this.configManager = configManager;
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
  }

  async sendMessage(message, role = "user") {
    throw new Error("Method 'sendMessage()' must be implemented.");
  }

  startChat(modelName, systemInstruction, temperature = 0.7) {
    throw new Error("Method 'startChat()' must be implemented.");
  }

  injectMessage(role, content, timestamp = null) {
    throw new Error("Method 'injectMessage()' must be implemented.");
  }

  popLastMessage() {
    throw new Error("Method 'popLastMessage()' must be implemented.");
  }

  getHistory() {
    throw new Error("Method 'getHistory()' must be implemented.");
  }

  updateNicknames(userNickname, agentNickname) {
    this.userNickname = userNickname;
    this.agentNickname = agentNickname;
  }

  async getAvailableModels() {
    throw new Error("Method 'getAvailableModels()' must be implemented.");
  }

  async checkAvailability(modelName) {
    throw new Error("Method 'checkAvailability()' must be implemented.");
  }

  getVariants() {
    return [];
  }
}
