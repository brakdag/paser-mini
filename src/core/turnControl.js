import { performance } from "node:perf_hooks";
import TurnLimitError from "./exceptions/TurnLimitError.js";
import { UserInterruptException } from "./exceptions.js";

/** Owns the scheduling limits and cancellation state of one turn. */
export default class TurnControl {
  /**
   * Creates finite budgets. The deadline stops scheduling; it cannot kill in-flight work.
   * @param {object} ui - Input queue owner.
   * @param {object} [options] - Programmatic limits and clock for tests.
   * @param {number} [options.maxActions] - Tool calls, including invalid arguments.
   * @param {number} [options.maxRequests] - Model exchanges, including recovery requests.
   * @param {number} [options.maxErrors] - Consecutive failed actions.
   * @param {number} [options.maxDurationMs] - Elapsed scheduling deadline.
   * @param {() => number} [options.now] - Monotonic clock.
   */
  constructor(ui, { maxActions = 500, maxRequests = 500, maxErrors = 10, maxDurationMs = 1800000, now = () => performance.now() } = {}) {
    if ([maxActions, maxRequests, maxErrors, maxDurationMs].some(value => !Number.isSafeInteger(value) || value <= 0)) {
      throw new RangeError("Turn limits must be positive safe integers.");
    }
    this.ui = ui;
    this.maxActions = maxActions;
    this.maxRequests = maxRequests;
    this.maxErrors = maxErrors;
    this.now = now;
    this.deadline = now() + maxDurationMs;
    this.actions = 0;
    this.requests = 0;
    this.errors = 0;
    this.cancelled = false;
  }

  /** Prevents subsequent work after cancellation, queued input or deadline. */
  check() {
    if (this.cancelled || this.ui.inputQueue?.length) throw new UserInterruptException();
    if (this.now() >= this.deadline) throw new TurnLimitError("Turn time limit reached.");
  }

  /** Reserves an action before it starts, including parser failures. */
  beforeAction() {
    this.check();
    if (this.actions >= this.maxActions) throw new TurnLimitError("Turn action limit reached.");
    this.actions += 1;
  }

  /** Reserves a model exchange; provider transport retries remain governed by T12. */
  beforeRequest() {
    this.check();
    if (this.requests >= this.maxRequests) throw new TurnLimitError("Turn model request limit reached.");
    this.requests += 1;
  }

  /**
   * Updates consecutive errors per action, in execution order.
   * @param {boolean} success - Whether the action succeeded.
   */
  recordResult(success) {
    this.check();
    this.errors = success ? 0 : this.errors + 1;
    if (this.errors >= this.maxErrors) throw new TurnLimitError("Turn consecutive error limit reached.");
  }
}
