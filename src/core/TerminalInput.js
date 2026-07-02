import readline from "readline";

/**
 * Handles reading input from the terminal using the readline interface.
 */
class TerminalInput {
  /**
   * Initializes the TerminalInput instance.
   */
  constructor() {
    this.rl = null;
    this.inputQueue = [];
    this.inputResolver = null;
    this.commandHandler = null;
  }

  /**
   * Initializes the readline interface and sets up the line event listener.
   * @returns {void}
   */
  init() {
    if (this.rl) return;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    this.rl.on("line", async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Intercept non-blocking commands before they enter the queue
      if (this.commandHandler && this.commandHandler.isNonBlocking(trimmed)) {
        await this.commandHandler.handle(trimmed);
        return;
      }

      if (this.inputResolver) {
        const resolve = this.inputResolver;
        this.inputResolver = null;
        resolve(trimmed);
      } else {
        this.inputQueue.push(trimmed);
      }
    });
  }

  /**
   * Requests input from the user. Returns immediately if input is queued, otherwise returns a promise.
   * @param {string} [prompt] - The prompt to display to the user.
   * @returns {string|Promise<string>} The user input or a promise that resolves to the user input.
   */
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

  /**
   * Requests a yes/no confirmation from the user.
   * @param {string} message - The confirmation message to display.
   * @returns {Promise<boolean>} A promise that resolves to true if the user answered 'y', false otherwise.
   */
  async getConfirmation(message) {
    const answer = await this.requestInput(`${message} [y/N] \u276f `);
    return answer.toLowerCase() === "y";
  }

  /**
   * Clears the current line in the terminal output.
   * @returns {void}
   */
  clearCurrentLine() {
    if (this.rl) {
      process.stdout.write("\r\x1b[K");
    }
  }
}

export default new TerminalInput();