import readline from "readline";

/**
 * Handles reading input from the terminal using the readline interface.
 */
export class TerminalInput {
  /**
   * Initializes the TerminalInput instance.
   */
  constructor() {
    this.rl = null;
    this.inputQueue = [];
    this.inputResolver = null;
    this.commandHandler = null;
    this.closed = false;
  }

  /**
   * Initializes the readline interface and sets up the line event listener.
   * @returns {void}
   */
  init() {
    if (this.rl || this.closed) return;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: Boolean(process.stdin.isTTY),
    });

    this.rl.on("SIGINT", () => {
      this.close();
      process.emit("SIGINT");
    });
    this.rl.once("close", () => {
      this.closed = true;
      const resolve = this.inputResolver;
      this.inputResolver = null;
      resolve?.(null);
    });
    this.rl.on("line", async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      // Command handlers normalize built-ins; personal shortcuts retain their literal payload.
      const submitted = trimmed.startsWith("/") ? line.trimStart() : trimmed;

      if (this.commandHandler?.interruptForExit?.(trimmed)) return;

      // Intercept non-blocking commands before they enter the queue
      if (this.commandHandler && this.commandHandler.isNonBlocking(trimmed)) {
        await this.commandHandler.handle(trimmed);
        return;
      }

      const modelChange = this.commandHandler?.interruptForModelChange(trimmed);

      if (this.inputResolver) {
        const resolve = this.inputResolver;
        this.inputResolver = null;
        resolve(submitted);
      } else if (modelChange) {
        this.inputQueue.unshift(submitted);
      } else {
        this.inputQueue.push(submitted);
      }
    });
  }

  /**
   * Requests input from the user. Returns immediately if input is queued, otherwise returns a promise.
   * @param {string} [prompt] - The prompt to display to the user.
   * @returns {string|null|Promise<string|null>} The user input or a promise that resolves to the user input.
   */
  requestInput(prompt = "> ") {
    if (this.inputQueue.length > 0) {
      const input = this.inputQueue.shift();
      process.stdout.write(prompt);
      return input;
    }

    if (this.closed) return null;

    return new Promise((resolve) => {
      this.inputResolver = resolve;
      process.stdout.write(prompt);
    });
  }

  /**
   * Temporarily transfers the physical terminal to a user-owned interactive session.
   * Keystrokes bypass readline, queues and session logs, including passwords.
   * @param {object} session - Interactive terminal with write and resize methods.
   * @param {(output: (text: string) => void) => Promise<object>} operation - Operation completed by the remote shell.
   * @returns {Promise<object>} Operation result after restoring chat input.
   */
  async withTerminal(session, operation) {
    if (!process.stdin.isTTY || !process.stdout.isTTY || !this.rl || this.closed) {
      throw new Error("/ssh requires an interactive terminal.");
    }
    const input = process.stdin;
    const wasRaw = input.isRaw;
    this.rl.pause();
    const listeners = /** @type {Array<(data: Buffer|string) => void>} */ (input.listeners("data"));
    listeners.forEach(listener => input.removeListener("data", listener));
    /**
     * @param {Buffer|string} data - Raw terminal keystrokes.
     * @returns {void} Keystrokes forwarded privately.
     */
    const forward = data => session.write(data.toString());
    /**
     * Resizes the remote terminal with the local window.
     * @returns {void} Remote terminal resized.
     */
    const resize = () => session.resize(process.stdout.columns || 80, process.stdout.rows || 24);
    try {
      input.setRawMode(true);
      input.on("data", forward);
      process.stdout.on("resize", resize);
      input.resume();
      return await operation(text => process.stdout.write(text));
    } finally {
      input.pause();
      input.removeListener("data", forward);
      process.stdout.removeListener("resize", resize);
      input.setRawMode(this.closed ? false : wasRaw);
      if (!this.closed) {
        listeners.forEach(listener => input.on("data", listener));
        this.rl.resume();
      }
      process.stdout.write("\n");
    }
  }

  /** Closes readline and resolves pending reads; repeated calls are harmless. */
  close() {
    this.closed = true;
    this.inputQueue.length = 0;
    this.commandHandler = null;
    const resolve = this.inputResolver;
    this.inputResolver = null;
    resolve?.(null);
    this.rl?.close();
  }

  /**
   * Requests a yes/no confirmation from the user.
   * @param {string} message - The confirmation message to display.
   * @returns {Promise<boolean>} A promise that resolves to true if the user answered 'y', false otherwise.
   */
  async getConfirmation(message) {
    const answer = await this.requestInput(`${message} [y/N] \u276f `);
    return answer?.toLowerCase() === "y";
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
