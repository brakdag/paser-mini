import { spawn } from "child_process";
import PathValidator from "../utils/pathValidator.js";

const PROMPT = "debug> ";
const TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 50;

/**
 * Manages a stateful NodeJS inspect session.
 */
export default class InspectTools {
  #inspectProcess = null;

  #buffer = "";

  #waiters = new Set();

  #closing = null;

  #generation = 0;

  #spawnProcess;

  /**
   * Creates an inspector with an injectable process launcher.
   * @param {object} [options] - Process dependencies.
   * @param {(command: string, args: string[], options: object) => object} [options.spawnProcess] - Child process launcher.
   */
  constructor({ spawnProcess = spawn } = {}) {
    this.#spawnProcess = spawnProcess;
  }

  /**
   * Resolves when the debug prompt appears in the buffer.
   * @returns {Promise<string>} Accumulated output up to the prompt.
   */
  #waitForPrompt() {
    return new Promise((resolve) => {
      let resolved = false;
      let interval;
      let timeout;
      let cancel;

      /**
       * Resolves the promise with the given output.
       * @param {string} output - The output to resolve with.
       * @param {boolean} isTimeout - Whether this is a timeout resolution.
       */
      const done = (output, isTimeout = false) => {
        if (resolved) return;
        resolved = true;
        this.#waiters.delete(cancel);
        clearInterval(interval);
        clearTimeout(timeout);
        this.#buffer = "";
        resolve(output.trim() || (isTimeout ? "Timeout: No prompt received." : ""));
      };

      /**
       * Checks if the prompt is in the buffer or process has terminated.
       */
      const check = () => {
        if (resolved) return;

        const idx = this.#buffer.indexOf(PROMPT);
        if (idx !== -1) {
          const output = this.#buffer.substring(0, idx);
          this.#buffer = this.#buffer.substring(idx + PROMPT.length);
          done(output);
          return;
        }

        if (!this.#inspectProcess) {
          done(this.#buffer);
        }
      };

      /**
       * Completes pending polling when the owner closes the session.
       * @returns {void}
       */
      cancel = () => done(this.#buffer);
      this.#waiters.add(cancel);
      interval = setInterval(check, POLL_INTERVAL_MS);

      timeout = setTimeout(() => done(this.#buffer, true), TIMEOUT_MS);
    });
  }

  /**
   * Stops the inspector process group, resolves polling and waits for process exit.
   * @returns {Promise<void>} Idempotent cleanup completion.
   */
  close() {
    if (this.#closing) return this.#closing;
    this.#generation += 1;
    const child = this.#inspectProcess;
    this.#inspectProcess = null;
    this.#waiters.forEach(done => done());
    this.#buffer = "";
    if (!child) return Promise.resolve();
    /**
     * Terminates both the debugger and its debuggee on Unix.
     * @param {"SIGTERM"|"SIGKILL"} signal - Termination signal.
     */
    const kill = (signal) => {
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    };
    this.#closing = new Promise((resolve) => {
      if (!child.pid || child.exitCode !== null) {
        kill("SIGKILL");
        resolve();
        return;
      }
      const timer = setTimeout(() => kill("SIGKILL"), 200);
      child.once("close", () => { clearTimeout(timer); kill("SIGKILL"); resolve(); });
      child.stdin.destroy();
      kill("SIGTERM");
    });
    return this.#closing;
  }

  /**
   * Starts or interacts with a node inspect session.
   * @param {string} [path] - The file to inspect.
   * @param {string} [command] - The command to send to the inspector.
   * @returns {Promise<string>} The output of the inspection or command.
   */
  async inspect(path, command) {
    let p = path;
    let c = command;

    if (!p && !c) {
      throw new Error("Either 'path' to start or 'command' to interact must be provided.");
    }

    // If session active, treat first arg as command if no command given,
    // or ignore path if both are provided (session already running)
    if (this.#inspectProcess) {
      if (!c) {
        c = p;
      }
      p = undefined;
    }

    if (p && !this.#inspectProcess) {
      const safePath = PathValidator.getSafePath(p);
      this.#buffer = "";
      const generation = this.#generation;
      if (this.#closing) await this.#closing;
      if (this.#inspectProcess) throw new Error("An inspector session is already active");
      if (generation !== this.#generation) throw new Error("Inspector was closed during startup");
      this.#closing = null;
      this.#inspectProcess = this.#spawnProcess("node", ["inspect", safePath], { detached: process.platform !== "win32" });
      const child = this.#inspectProcess;

      /**
       * Handles incoming data from stdout/stderr.
       * @param {Buffer} data - The data chunk received.
       */
      const dataHandler = (data) => {
        this.#buffer += data.toString();
      };

      this.#inspectProcess.stdout.on("data", dataHandler);
      this.#inspectProcess.stderr.on("data", dataHandler);

      child.on("error", (err) => {
        this.#buffer += `Inspector error: ${err.message}`;
        if (this.#inspectProcess === child) this.#inspectProcess = null;
        this.#waiters.forEach(done => done());
      });
      child.on("close", () => {
        child.stdout.removeListener("data", dataHandler);
        child.stderr.removeListener("data", dataHandler);
        child.stdin.destroy();
        if (this.#inspectProcess === child) this.#inspectProcess = null;
        this.#waiters.forEach(done => done());
      });

      const startupOutput = await this.#waitForPrompt();

      if (this.#inspectProcess !== child) {
        return `Process exited during startup.\nOutput:\n${startupOutput}`;
      }

      if (c) {
        // Allow the debugger to stabilize in paused state after break-on-start
        await new Promise((r) => { setTimeout(r, 200); });
        if (this.#inspectProcess !== child) return "[Process terminated]";
        this.#buffer = "";
        child.stdin.write(`${c}\n`);
        const output = await this.#waitForPrompt();
        if (!this.#inspectProcess) {
          return `${output}\n\n[Process terminated]`;
        }
        return output;
      }

      return "Inspect session started.";
    }

    if (!this.#inspectProcess) {
      throw new Error("No active node inspect session. Provide a 'path' to start a new session.");
    }

    if (c === "exit" || c === ".exit" || c === "kill") {
      await this.close();
      return "Node inspect session terminated.";
    }

    if (c) {
      if (this.#inspectProcess.killed) {
        this.#inspectProcess = null;
        this.#buffer = "";
        throw new Error("Inspect process has terminated. Start a new session with a 'path'.");
      }
      this.#buffer = "";
      this.#inspectProcess.stdin.write(`${c}\n`);
      const output = await this.#waitForPrompt();
      if (!this.#inspectProcess) {
        return `${output}\n\n[Process terminated]`;
      }
      return output;
    }

    throw new Error("Either 'path' to start or 'command' to interact must be provided.");
  }
}
