import readline from "readline";

class TerminalInput {
  constructor() {
    this.rl = null;
    this.inputQueue = [];
    this.inputResolver = null;
  }

  init() {
    if (this.rl) return;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    this.rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed) {
        if (this.inputResolver) {
          const resolve = this.inputResolver;
          this.inputResolver = null;
          resolve(trimmed);
        } else {
          this.inputQueue.push(trimmed);
        }
      }
    });
  }

  requestInput(prompt = "> ") {
    if (this.inputQueue.length > 0) {
      const input = this.inputQueue.shift();
      process.stdout.write(prompt);
      return input;
    }

    return new Promise((resolve) => {
      this.inputResolver = resolve;
      process.stdout.write(prompt);
    });
  }

  async getConfirmation(message) {
    const answer = await this.requestInput(`${message} [y/N] \u276f `);
    return answer.toLowerCase() === "y";
  }

  clearCurrentLine() {
    if (this.rl) {
      process.stdout.write("\r\x1b[K");
    }
  }
}

export default new TerminalInput();