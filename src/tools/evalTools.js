import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import PathValidator from "../utils/pathValidator.js";

const source = fileURLToPath(new URL("../../", import.meta.url));
const MAX_BYTES = 1024 * 1024;

/** Runs each JavaScript call in a disposable Linux mount/network/PID namespace. */
export default class EvalTools {
  #paths;

  #timeoutMs;

  /**
   * Creates a project-scoped runner. Missing OS isolation fails closed.
   * @param {object} [options] - Execution policy.
   * @param {PathValidator|typeof PathValidator} [options.pathValidator] - Project paths.
   * @param {number} [options.timeoutMs] - Total deadline, at most five seconds.
   */
  constructor({ pathValidator = PathValidator, timeoutMs = 5000 } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) {
      throw new Error("run timeoutMs must be an integer between 1 and 5000");
    }
    this.#paths = pathValidator;
    this.#timeoutMs = timeoutMs;
  }

  /**
   * Constructs the fixed OS policy; no shell, inherited environment or host home.
   * @returns {string[]} Bubblewrap arguments.
   */
  #arguments() {
    const root = this.#paths.getRoot();
    const realRoot = fs.realpathSync(root);
    // These trees supply the runtime and private kernel interfaces. A project
    // must not replace them, or be an ancestor exposing the host filesystem.
    const reserved = ["/usr", "/lib", "/lib64", "/runtime", "/proc", "/dev", "/etc"];
    if ([root, realRoot].some(candidate => candidate === "/" || candidate === "/tmp" || reserved.some(entry => candidate === entry || candidate.startsWith(`${entry}/`)))) {
      throw new Error("RUN_ROOT: project root overlaps the sandbox runtime");
    }
    const args = [
      "--unshare-all", "--unshare-user", "--die-with-parent", "--new-session", "--disable-userns",
      "--cap-drop", "ALL", "--clearenv", "--setenv", "HOME", "/tmp",
      "--setenv", "PATH", "/usr/bin", "--setenv", "LANG", "C.UTF-8",
      "--ro-bind", "/usr", "/usr",
    ];
    ["/lib", "/lib64"].forEach(entry => {
      if (fs.existsSync(entry)) args.push("--ro-bind", entry, entry);
    });
    args.push(
      "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
      "--bind", root, root, "--chdir", root,
      "--ro-bind", process.execPath, "/runtime/node",
      "--ro-bind", path.join(source, "package.json"), "/runtime/package.json",
      "--ro-bind", path.join(source, "src/tools/evalWorker.js"), "/runtime/tools/evalWorker.js",
      "--ro-bind", path.join(source, "src/utils/pathValidator.js"), "/runtime/utils/pathValidator.js",
    );
    // Kernel-enforced read-only mounts complement BrowserFS mutation checks.
    [".git", ".paser-mini", ".codex", ".agents", ".aws"].forEach(name => {
      const entry = path.join(root, name);
      if (fs.existsSync(entry)) {
        const target = fs.realpathSync(entry);
        const relative = path.relative(realRoot, target);
        if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
          throw new Error("RUN_ROOT: protected metadata resolves outside the project");
        }
        args.push("--ro-bind", entry, entry);
      }
    });
    args.push(
      "/usr/bin/prlimit", "--as=1073741824:1073741824", "--cpu=5:5",
      "--fsize=16777216:16777216", "--nofile=64:64", "--nproc=256:256", "--core=0:0", "--",
      "/runtime/node", "--jitless", "--max-old-space-size=64", "--stack-size=512", "/runtime/tools/evalWorker.js",
    );
    return args;
  }

  /**
   * Executes one call, waiting for process closure before returning or throwing.
   * Globals are fresh for every call. No fallback to in-process execution exists.
   * @param {string} code - JavaScript source; top-level await is supported.
   * @returns {Promise<string>} JSON with result and captured console trace.
   */
  async executeJS(code) {
    if (typeof code !== "string" || Buffer.byteLength(code) > MAX_BYTES) {
      throw new Error("RUN_INPUT: code must be a string of at most 1 MiB");
    }
    if (process.platform !== "linux") {
      throw new Error("RUN_UNAVAILABLE: run requires Linux, Bubblewrap and prlimit; no unsafe fallback");
    }
    const args = this.#arguments();
    return new Promise((resolve, reject) => {
      const child = spawn("/usr/bin/bwrap", args, {
        env: {}, stdio: ["pipe", "pipe", "pipe"],
      });
      let failure;
      let stdout = "";
      let stderr = "";
      let bytes = 0;
      /**
       * Stops the namespace supervisor; its death kills the namespace init.
       * @param {Error} error - Reason retained until the pipes close.
       */
      const stop = error => {
        if (!failure) failure = error;
        child.kill("SIGKILL");
      };
      const timer = setTimeout(() => stop(new Error(`ASYNC_TIMEOUT: run terminated after ${this.#timeoutMs}ms (script execution timed out)`)), this.#timeoutMs);
      child.on("error", error => { failure = new Error(`RUN_UNAVAILABLE: ${error.message}`, { cause: error }); });
      child.stdin.on("error", error => {
        if (!("code" in error) || error.code !== "EPIPE") stop(error);
      });
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > MAX_BYTES) stop(new Error("RUN_OUTPUT: output exceeded 1 MiB; execution terminated"));
        else stdout += chunk.toString();
      });
      child.stderr.on("data", chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > MAX_BYTES) stop(new Error("RUN_OUTPUT: output exceeded 1 MiB; execution terminated"));
        else stderr += chunk.toString();
      });
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        if (failure) { reject(failure); return; }
        if (exitCode !== 0) {
          reject(new Error(`RUN_FAILED: sandbox exited (${signal || exitCode}): ${stderr.trim()}`));
          return;
        }
        try {
          const response = JSON.parse(stdout);
          if (response.error) throw new Error(response.error);
          if (typeof response.output !== "string") throw new Error("RUN_PROTOCOL: missing result");
          resolve(response.output);
        } catch (error) { reject(error); }
      });
      child.stdin.end(JSON.stringify({ code }));
    });
  }
}
