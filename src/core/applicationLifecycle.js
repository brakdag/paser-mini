/** Owns application cleanup, including a final log flush, under one deadline. */
export default class ApplicationLifecycle {
  /**
   * @param {object} [options] - Shutdown settings.
   * @param {number} [options.timeoutMs] - Total shutdown deadline.
   * @param {() => unknown} [options.flush] - Final buffered log flush.
   */
  // MCP stdio shutdown can spend 2s on EOF and 2s on SIGTERM before SIGKILL.
  // The resource phase (80% of the deadline) must leave room for that escalation.
  constructor({ timeoutMs = 7500, flush = () => {} } = {}) {
    this.timeoutMs = timeoutMs;
    this.flush = flush;
    this.resources = [];
    this.closing = false;
    this.completion = null;
  }

  /**
   * Registers cleanup immediately after acquiring a resource.
   * @param {() => unknown} dispose - Idempotent cleanup callback.
   */
  own(dispose) {
    if (this.closing) throw new Error("Application is shutting down");
    this.resources.push(dispose);
  }

  /**
   * Runs every cleanup despite failures, then flushes logs before returning.
   * @returns {Promise<void>} One shared shutdown completion.
   */
  close() {
    if (this.completion) return this.completion;
    this.closing = true;
    // Defer callbacks so a reentrant close sees the same completion promise.
    this.completion = Promise.resolve().then(async () => {
      const deadline = Date.now() + this.timeoutMs;
      const errors = [];
      /**
       * Bounds a phase and always removes its timer.
       * @param {() => Promise<unknown>} operation - Cleanup phase.
       * @param {number} ms - Remaining phase budget.
       */
      const bounded = async (operation, ms) => {
        let timer;
        try {
          await Promise.race([
            Promise.resolve().then(operation),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error("Application shutdown deadline exceeded")), Math.max(1, ms));
            }),
          ]);
        } catch (error) {
          errors.push(error);
        } finally {
          clearTimeout(timer);
        }
      };
      await bounded(async () => {
        const results = await Promise.allSettled(this.resources.map(dispose => Promise.resolve().then(dispose)));
        results.forEach(result => { if (result.status === "rejected") errors.push(result.reason); });
      }, this.timeoutMs * 0.8);
      await bounded(async () => this.flush(), deadline - Date.now());
      if (errors.length) throw new AggregateError(errors, "Application cleanup failed");
    });
    return this.completion;
  }
}

/**
 * Installs process handlers only while the executable is running.
 * @param {() => Promise<void>} work - Application startup and execution.
 * @param {ApplicationLifecycle} lifecycle - Resource owner.
 * @returns {Promise<number>} Exit status after cleanup.
 */
export async function runProcess(work, lifecycle) {
  const stopped = Promise.withResolvers();
  let exitCode = 0;
  /**
   * Requests the same bounded cleanup for signals and fatal process errors.
   * @param {unknown} [error] - Fatal error, if present.
   */
  const stop = (error) => {
    if (error) {
      exitCode = 1;
      console.error("Paser Mini error:", error);
    }
    stopped.resolve();
  };
  /**
   * Stops on a termination signal.
   * @returns {void}
   */
  const signal = () => { exitCode = 130; console.error("Paser Mini interrupted"); stop(); };
  /**
   * @param {unknown} error - Unhandled failure.
   * @returns {void}
   */
  const fatal = error => stop(error || new Error("Unhandled failure"));
  process.on("SIGINT", signal);
  process.on("SIGTERM", signal);
  process.on("uncaughtException", fatal);
  process.on("unhandledRejection", fatal);
  try {
    await Promise.race([Promise.resolve().then(work), stopped.promise]);
  } catch (error) {
    stop(error);
  } finally {
    try {
      await lifecycle.close();
    } catch (error) {
      exitCode = 1;
      console.error("Paser Mini shutdown error:", error);
    }
    process.off("SIGINT", signal);
    process.off("SIGTERM", signal);
    process.off("uncaughtException", fatal);
    process.off("unhandledRejection", fatal);
  }
  return exitCode;
}
