import { test } from "node:test";
import assert from "node:assert/strict";
import RetryHandler from "../src/utils/retryHandler.js";

test("exhausted retries preserve the error without scheduling another wait", async () => {
  const handler = new RetryHandler(3, 0);
  const error = Object.assign(new Error("busy"), { response: { status: 503 } });
  let attempts = 0;
  const retries = [];
  await assert.rejects(handler.execute(async () => {
    attempts += 1;
    throw error;
  }, {
    /**
     * Records only retries that have another attempt available.
     * @param {number} attempt - Failed attempt number.
     * @returns {number} Recorded retry count.
     */
    onRetry: (attempt) => retries.push(attempt),
  }), (caught) => caught === error);
  assert.equal(attempts, 3);
  assert.deepEqual(retries, [1, 2]);
});

test("a single failed attempt never calculates backoff", async () => {
  const handler = new RetryHandler(1);
  /**
   * Fails if an exhausted handler requests a delay.
   * @returns {never} Always fails.
   */
  handler._getExponentialDelay = () => { assert.fail("no attempt remains"); };
  const error = Object.assign(new Error("busy"), { response: { status: 429 } });
  await assert.rejects(handler.execute(async () => { throw error; }), (caught) => caught === error);
});

test("nonrecoverable failures are not retried", async () => {
  const handler = new RetryHandler(3, 0);
  let attempts = 0;
  await assert.rejects(handler.execute(async () => {
    attempts += 1;
    throw new Error("invalid credentials");
  }, {
    /**
     * Fails if a permanent error schedules a retry.
     * @returns {never} Always fails.
     */
    onRetry: () => { assert.fail("unexpected retry"); },
  }), /invalid credentials/);
  assert.equal(attempts, 1);
});

test("cancellation during backoff prevents the next attempt", async () => {
  const handler = new RetryHandler(3);
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(handler.execute(async () => {
    attempts += 1;
    throw Object.assign(new Error("busy"), { response: { status: 503 } });
  }, {
    signal: controller.signal,
    /**
     * Cancels before the backoff timer can finish.
     * @returns {void}
     */
    onRetry: () => controller.abort(),
  }), { name: "AbortError" });
  assert.equal(attempts, 1);
});

[ { name: "AbortError" }, { code: "ERR_CANCELED" } ].forEach((details) => {
  test(`cancellation ${JSON.stringify(details)} is never retried by message matching`, async () => {
    const handler = new RetryHandler(3, 0);
    const error = Object.assign(new Error("retry me"), details);
    let attempts = 0;
    await assert.rejects(handler.execute(async () => {
      attempts += 1;
      throw error;
    }, { recoverableErrors: ["retry me"] }), (caught) => caught === error);
    assert.equal(attempts, 1);
  });
});

test("a late result is rejected when cancellation occurs during the request", async () => {
  const handler = new RetryHandler(3, 0);
  const controller = new AbortController();
  const reason = new Error("cancelled by user");
  await assert.rejects(handler.execute(async () => {
    controller.abort(reason);
    return "late response";
  }, { signal: controller.signal }), (caught) => caught === reason);
});
