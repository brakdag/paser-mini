import { randomBytes } from "node:crypto";
import { stripVTControlCharacters } from "node:util";

/**
 * @typedef {object} SshResult
 * @property {string} target - SSH destination.
 * @property {number|null} code - Remote exit status, null when disconnected.
 * @property {string} output - Captured command output.
 * @property {string} error - Connection failure, if any.
 * @property {boolean} truncated - Whether output exceeded the capture limit.
 */

/**
 * Quotes one literal argument for the remote POSIX shell.
 * @param {string} value - Literal argument.
 * @returns {string} Shell-quoted value.
 */
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;

/** A user-owned SSH terminal; never exposed as an autonomous agent tool. */
export default class SshSession {
  /**
   * @param {object} [options] - Injectable terminal implementation.
   * @param {typeof import("node-pty").spawn} [options.spawn] - PTY factory for offline tests.
   */
  constructor({ spawn = null } = {}) {
    this.spawn = spawn;
    this.terminal = null;
    this.target = null;
    this.token = null;
    this.connectionAttempt = null;
    this.pending = null;
    /** @type {(text: string) => void} Live output sink. */
    this.output = () => {};
    this.buffer = "";
    this.limit = 1_000_000;
  }

  /**
   * Opens SSH with normal host verification, configuration and authentication.
   * @param {string} target - SSH destination or configured host alias.
   * @param {(text: string) => void} output - Live terminal renderer.
   * @returns {Promise<SshResult>} Connection result.
   */
  async connect(target, output) {
    if (this.terminal) throw new Error(`Already connected to ${this.target}; use /ssh disconnect first.`);
    if (!/^(?:[a-zA-Z0-9_.-]+@)?[a-zA-Z0-9_][a-zA-Z0-9_.:[\]-]*$/.test(target)) {
      throw new Error("Usage: /ssh connect [user@]host (SSH config aliases are supported)");
    }
    const attempt = Symbol("SSH connection");
    this.connectionAttempt = attempt;
    const spawn = this.spawn || (await import("node-pty")).spawn;
    if (this.connectionAttempt !== attempt) throw new Error("SSH connection cancelled.");
    this.target = target;
    this.output = output;
    const token = randomBytes(16).toString("hex");
    this.token = token;
    // A shell prompt reports completion even after syntax errors and Ctrl+C.
    // Preserve the literal $? for expansion each time the interactive shell prompts.
    const remote = `stty -echo || exit; PS1=$(printf '\\036${token}:$?\\037') PS2='' ENV='' exec sh -i`;
    try {
      this.terminal = spawn("ssh", ["-tt", "-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=15",
        "-o", "ServerAliveCountMax=3", "--", target, remote], {
        name: "xterm-256color", cols: process.stdout.columns || 80, rows: process.stdout.rows || 24,
        cwd: process.cwd(), env: { ...process.env },
      });
      const { terminal } = this;
      const result = this.wait(token, 120000);
      terminal.onData(data => this.receive(data));
      terminal.onExit(({ exitCode }) => {
        if (this.terminal !== terminal) return;
        this.terminal = null;
        this.finish(null, `SSH disconnected (exit ${exitCode}).`);
      });
      return await result;
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  /**
   * Executes in the same shell, preserving directory and environment.
   * @param {string} command - Literal shell command supplied by the user.
   * @param {(text: string) => void} output - Live terminal renderer.
   * @returns {Promise<SshResult>} Captured output and remote exit status.
   */
  async run(command, output) {
    if (!this.terminal) throw new Error("No SSH session. Use /ssh connect [user@]host first.");
    if (this.pending) throw new Error("SSH is busy.");
    this.output = output;
    const result = this.wait(this.token);
    // Submit multiline input as one shell evaluation, with a single completion prompt.
    this.terminal.write(`eval ${quote(command)}\r`);
    return result;
  }

  /**
   * Starts a bounded output capture, with an optional connection deadline.
   * @param {string} token - Unpredictable completion delimiter.
   * @param {number} [timeout] - Deadline in milliseconds; commands remain interactive.
   * @returns {Promise<SshResult>} Terminal operation result.
   */
  wait(token, timeout = 0) {
    this.buffer = "";
    return new Promise(resolve => {
      this.pending = { token, resolve, text: "", truncated: false, timer: null };
      if (timeout) this.pending.timer = setTimeout(() => this.disconnect("SSH connection timed out."), timeout);
    });
  }

  /**
   * Parses completion across arbitrary PTY chunk boundaries, streaming other text.
   * @param {string} data - Terminal output chunk.
   */
  receive(data) {
    if (!this.pending) return;
    this.buffer += data;
    const start = `\x1e${this.pending.token}:`;
    const index = this.buffer.indexOf(start);
    if (index >= 0) {
      const end = this.buffer.indexOf("\x1f", index + start.length);
      if (end >= 0) {
        const status = this.buffer.slice(index + start.length, end);
        if (/^\d+$/.test(status)) {
          this.record(this.buffer.slice(0, index));
          this.buffer = this.buffer.slice(end + 1);
          this.finish(Number(status));
          return;
        }
      }
    }
    // Keep only a possible partial marker, so prompts without newlines appear immediately.
    let keep = 0;
    for (let length = 1; length <= Math.min(this.buffer.length, start.length); length += 1) {
      if (this.buffer.endsWith(start.slice(0, length))) keep = length;
    }
    if (index >= 0 && this.buffer.length - index < start.length + 16) keep = this.buffer.length - index;
    this.record(this.buffer.slice(0, this.buffer.length - keep));
    this.buffer = keep ? this.buffer.slice(-keep) : "";
  }

  /**
   * Streams output while retaining at most one million characters for model context.
   * @param {string} text - Output excluding protocol markers.
   */
  record(text) {
    if (!text || !this.pending) return;
    this.output(text);
    const available = this.limit - this.pending.text.length;
    this.pending.text += text.slice(0, available);
    if (text.length > available) this.pending.truncated = true;
  }

  /**
   * Resolves an operation even when the connection ends unexpectedly.
   * @param {number|null} code - Remote status, or null on disconnection.
   * @param {string} [error] - Connection failure description.
   */
  finish(code, error = "") {
    if (!this.pending) return;
    this.record(this.buffer);
    this.buffer = "";
    const { pending } = this;
    this.pending = null;
    clearTimeout(pending.timer);
    const output = stripVTControlCharacters(pending.text).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ""); // eslint-disable-line no-control-regex
    pending.resolve({ target: this.target, code, output, error, truncated: pending.truncated });
  }

  /**
   * Forwards terminal keystrokes; Ctrl+] always disconnects and returns to chat.
   * @param {string} data - Raw user input, deliberately excluded from history.
   */
  write(data) {
    if (data.includes("\x1d")) this.disconnect("SSH disconnected by user (Ctrl+]).");
    else this.terminal?.write(data);
  }

  /**
   * Updates the remote terminal dimensions.
   * @param {number} columns - Terminal width.
   * @param {number} rows - Terminal height.
   */
  resize(columns, rows) {
    this.terminal?.resize(columns, rows);
  }

  /**
   * Releases the SSH process and any pending operation; safe to repeat.
   * @param {string} [reason] - Reason shown for interrupted operations.
   */
  disconnect(reason = "SSH disconnected.") {
    this.connectionAttempt = null;
    const { terminal } = this;
    this.terminal = null;
    this.finish(null, reason);
    if (terminal) {
      try { terminal.kill("SIGKILL"); } catch { /* Process may already have exited. */ }
    }
  }
}
