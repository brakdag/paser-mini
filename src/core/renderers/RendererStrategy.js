export default class RendererStrategy {
  constructor(ui) {
    this.ui = ui;
  }

  displayChatMessage(nickname, text) {
    throw new Error("Not implemented");
  }

  displayToolStatus(name, success, detail) {
    throw new Error("Not implemented");
  }

  processInput(userInput) {
    return userInput;
  }

  async processResponse(assistant, response) {
    return response;
  }

  formatToolResults(results) {
    const mapped = results.map((r) => {
      if (typeof r === "string") return r;
      return r.result && r.result.mime_type ? r.result : r.response;
    });
    return mapped.every((item) => typeof item === "string")
      ? mapped.join("\n\n")
      : mapped;
  }

  formatSystemMessage(text) {
    return text;
  }

  formatAction(text) {
    return `*** [Action]: ${text}`;
  }

  formatHistoryMessage(role, text) {
    if (role === "user") return `[User]: ${text}`;
    if (role === "server") return `[System Message] ${text}`;
    if (role === "model") return `[Model]: ${text}`;
    return text;
  }

  requiresChannelHash() {
    return true;
  }
}
