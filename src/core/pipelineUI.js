import TerminalUI from "./terminalUI.js";

/** One-turn UI: only the final assistant reply is published to stdout. */
export default class PipelineUI extends TerminalUI {
  /**
   * @param {object} [options] - Streams for the pipeline.
   * @param {import("node:stream").Writable} [options.output] - Completed reply stream.
   * @param {import("node:stream").Writable} [options.diagnostic] - Diagnostics stream.
   */
  constructor({ output = process.stdout, diagnostic = process.stderr } = {}) {
    super();
    this.output = output;
    this.diagnostic = diagnostic;
    this.streaming = false;
    this.response = "";
    this.outputError = null;
    /** @param {Error} error - Output failure retained until publication. */
    this.onOutputError = error => { this.outputError = error; };
    output.on("error", this.onOutputError);
  }

  /**
   * @param {string} nickname - Sender.
   * @param {string} text - Completed message.
   */
  displayChatMessage(nickname, text) {
    if (nickname === this.model.nickname) this.response = text;
    else this.displayInfo(text);
  }

  /** @param {string} text - Diagnostic. */
  displayInfo(text) { this.diagnostic.write(`${text}\n`); }

  /** @param {string} text - Diagnostic. */
  displayError(text) { this.displayInfo(text); }

  /** @param {string} text - Diagnostic. */
  displayRawMessage(text) { this.displayInfo(text); }

  /** @param {string} text - Diagnostic. */
  displayThought(text) { this.displayInfo(text); }

  /** Pipeline has no monitoring UI. */
  startToolMonitoring() {}

  /** Pipeline has no monitoring UI. */
  endToolMonitoring() {}

  /** @param {string} _text - Partial response omitted from pipeline output. */
  previewResponse(_text) {}

  /** Writes the completed reply and waits for write errors, including EPIPE. */
  async publish() {
    if (this.outputError) throw this.outputError;
    await new Promise((resolve, reject) => {
      this.output.write(`${this.response}\n`, error => error ? reject(error) : resolve());
    });
    if (this.outputError) throw this.outputError;
  }
}
