import { spawn } from "child_process";

const PROMPT = "debug> ";
const TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 50;

/**
 * Manages a stateful NodeJS inspect session.
 */
export default class InspectTools {
  #inspectProcess = null;

  #buffer = "";

  /**
   * Resolves when the debug prompt appears in the buffer.
   * @returns {Promise<string>} Accumulated output up to the prompt.
   */
  #waitForPrompt() {
    return new Promise((resolve) => {
      let resolved = false;
      let interval;
      let timeout;

      /**
       * Resolves the promise with the given output.
       * @param {string} output - The output to resolve with.
       * @param {boolean} isTimeout - Whether this is a timeout resolution.
       */
      const done = (output, isTimeout = false) => {
        if (resolved) return;
        resolved = true;
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

      interval = setInterval(check, POLL_INTERVAL_MS);

      timeout = setTimeout(() => done(this.#buffer, true), TIMEOUT_MS);
    });
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

    // If session active, treat first arg as command if no command given,
    // or ignore path if both are provided (session already running)
    if (this.#inspectProcess) {
      if (!c) {
        c = p;
      }
      p = undefined;
    }

    if (p && !this.#inspectProcess) {
      this.#buffer = "";
      this.#inspectProcess = spawn("node", ["inspect", p]);

      /**
       * Handles incoming data from stdout/stderr.
       * @param {Buffer} data - The data chunk received.
       */
      const dataHandler = (data) => {
        this.#buffer += data.toString();
      };

      this.#inspectProcess.stdout.on("data", dataHandler);
      this.#inspectProcess.stderr.on("data", dataHandler);

      this.#inspectProcess.on("error", (err) => {
        this.#inspectProcess = null;
        throw err;
      });

      this.#inspectProcess.on("close", (_code) => {
        if (this.#inspectProcess) {
          this.#inspectProcess.kill();
          this.#inspectProcess.stdout.removeAllListeners();
          this.#inspectProcess.stderr.removeAllListeners();
          this.#inspectProcess.stdin.destroy();
        }
        // Preserve buffer for waitForPrompt to capture error output
        this.#inspectProcess = null;
      });

      const startupOutput = await this.#waitForPrompt();

      if (!this.#inspectProcess) {
        return `Process exited during startup.\nOutput:\n${startupOutput}`;
      }

      if (c) {
        // Allow the debugger to stabilize in paused state after break-on-start
        await new Promise((r) => { setTimeout(r, 200); });
        this.#buffer = "";
        this.#inspectProcess.stdin.write(`${c}\n`);
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
      this.#inspectProcess.stdin.write(".exit\n");
      this.#inspectProcess.kill();
      this.#inspectProcess.stdout.removeAllListeners();
      this.#inspectProcess.stderr.removeAllListeners();
      this.#inspectProcess.stdin.destroy();
      this.#inspectProcess = null;
      this.#buffer = "";
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
