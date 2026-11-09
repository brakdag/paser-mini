/** A deadline shared by rate limiting, transport attempts and retry waits. */
export default class RequestBudget {
  /**
   * @param {number} maxElapsedMs - Total request time in milliseconds.
   * @param {AbortSignal} [signal] - Caller cancellation.
   * @param {() => number} [now] - Monotonic clock for elapsed time.
   */
  constructor(maxElapsedMs, signal, now = performance.now.bind(performance)) {
    if (!Number.isSafeInteger(maxElapsedMs) || maxElapsedMs <= 0 || maxElapsedMs > 2147483647) {
      throw new RangeError("Request time budget must be a positive timer-safe integer");
    }
    this.now = now;
    this.deadline = now() + maxElapsedMs;
    this.controller = new AbortController();
    this.signal = signal ? AbortSignal.any([signal, this.controller.signal]) : this.controller.signal;
    this.timer = setTimeout(this.expire.bind(this), maxElapsedMs);
  }

  /** Expires the budget without replacing an earlier caller cancellation. */
  expire() {
    this.controller.abort(new DOMException("API request time budget exhausted", "TimeoutError"));
  }

  /**
   * @returns {number} Time remaining, or throws the cancellation/deadline reason.
   */
  remaining() {
    const remaining = this.deadline - this.now();
    if (remaining <= 0) this.expire();
    this.signal.throwIfAborted();
    return remaining;
  }

  /** Releases the deadline timer once the request has settled. */
  close() {
    clearTimeout(this.timer);
  }
}
