import { test } from "node:test";
import assert from "node:assert/strict";
import TurnProcessor from "../src/core/turnProcessor.js";
import SmartToolParser from "../src/core/smartParser.js";
import RepetitionDetector from "../src/core/repetitionDetector.js";
import GeminiAdapter from "../src/infrastructure/gemini/adapter.js";
import {
  GeminiSafetyError,
  GeminiEmptyResponseError,
  UserInterruptException,
} from "../src/core/exceptions.js";

const TOOL_CALL = 'Əread("fixture.txt")';

/**
 * Builds an offline turn using the real parser, communicator and Gemini adapter.
 * @param {object} t - The test context.
 * @param {(url: string, payload: object, options: object) => Promise<object>} post - The simulated HTTP transport.
 * @returns {object} The adapter, processor and captured UI/tool events.
 */
function harness(t, post) {
  const errors = [];
  const messages = [];
  const calls = [];
  const ui = {
    model: { nickname: "agent" },
    displayError(message) { errors.push(message); },
    displayChatMessage(nick, message) { messages.push({ nick, message }); },
    displayInfo() {},
  };
  const adapter = new GeminiAdapter({
    ui,
    configManager: { get(key, fallback) { return key === "rpm_limit" ? 60000000 : fallback; } },
  });
  adapter.injectMessage("user", "Earlier question");
  adapter.injectMessage("model", "Earlier answer");
  adapter.retryHandler.maxRetries = 2;
  adapter.retryHandler.maxDelay = 0;
  const transport = t.mock.method(adapter.client, "post", post);
  const pop = t.mock.method(adapter, "popLastMessage");
  const engine = {
    toolTracker: { reset() {} },
    async executeToolCall(name, args) {
      calls.push({ name, args });
      return { response: "Tool result", result: null };
    },
  };
  const processor = new TurnProcessor(
    adapter, {}, new SmartToolParser(), engine, ui, new RepetitionDetector(),
  );
  return { adapter, processor, transport, pop, errors, messages, calls };
}

/**
 * Creates a successful Gemini response.
 * @param {string} text - The generated text.
 * @returns {object} The HTTP response.
 */
function reply(text) {
  return { data: { candidates: [{ content: { parts: [{ text }] } }] } };
}

/**
 * Creates a retryable transport error without a real network request.
 * @returns {Error} The network error.
 */
function networkError() {
  return Object.assign(new Error("Connection reset"), { code: "ECONNRESET" });
}

const invalidResponses = [
  ["safety", { candidates: [{ finishReason: "SAFETY" }] }, GeminiSafetyError],
  ["missing candidates", { candidates: [] }, GeminiEmptyResponseError],
  ["missing parts", { candidates: [{ content: { parts: [] } }] }, GeminiEmptyResponseError],
  ["blank text", { candidates: [{ content: { parts: [{ text: " " }] } }] }, GeminiEmptyResponseError],
];

[false, true].forEach((afterTools) => {
  const phase = afterTools ? "after tools" : "initial request";

  invalidResponses.forEach(([label, data, ErrorType]) => {
    test(`${phase}: ${label} recovers once without deleting earlier history`, { timeout: 2000 }, async (t) => {
      const payloads = [];
      let step = 0;
      const h = harness(t, async (_url, payload) => {
        payloads.push(payload);
        step += 1;
        if (afterTools && step === 1) return reply(TOOL_CALL);
        if (step === (afterTools ? 2 : 1)) return { data };
        return reply("Recovered answer");
      });
      const before = structuredClone(h.adapter.getHistory());
      const processResponse = t.mock.method(h.adapter, "_processApiResponse");

      await h.processor.process("Current question");

      const expectedPrefix = afterTools
        ? [...before, { role: "user", parts: [{ text: "Current question" }] }, { role: "model", parts: [{ text: TOOL_CALL }] }]
        : before;
      const history = h.adapter.getHistory();
      assert.deepEqual(history.slice(0, before.length), before);
      assert.deepEqual(history.slice(0, expectedPrefix.length).map(({ role, parts }) => ({ role, parts })),
        expectedPrefix.map(({ role, parts }) => ({ role, parts })));
      assert.equal(history.length, expectedPrefix.length + 2);
      assert.match(history.at(-2).parts[0].text, /Model Error.*[Pp]lease rephrase/);
      assert.equal(history.at(-1).parts[0].text, "Recovered answer");
      assert.equal(h.transport.mock.callCount(), afterTools ? 3 : 2);
      assert.equal(h.errors.length, 1);
      assert.match(h.errors[0], /Model Error/);
      assert.deepEqual(h.messages, [{ nick: "agent", message: "Recovered answer" }]);
      assert.equal(h.calls.length, afterTools ? 1 : 0);
      assert.equal(h.pop.mock.callCount(), 0);
      const failedCall = processResponse.mock.calls[afterTools ? 1 : 0];
      assert.ok(failedCall.error instanceof ErrorType);
      assert.equal(payloads.at(-1).contents.length, expectedPrefix.length + 1);
    });
  });

  test(`${phase}: exhausted network failures preserve cause and history`, { timeout: 2000 }, async (t) => {
    const cause = networkError();
    let step = 0;
    const h = harness(t, async () => {
      step += 1;
      if (afterTools && step === 1) return reply(TOOL_CALL);
      throw cause;
    });
    const before = structuredClone(h.adapter.getHistory());

    await assert.rejects(h.processor.process("Current question"), (error) => {
      assert.equal(error.name, "APIError");
      assert.equal(error.code, cause.code);
      assert.equal(error.cause, cause);
      return true;
    });

    const history = h.adapter.getHistory();
    assert.deepEqual(history.slice(0, before.length), before);
    assert.equal(history.length, before.length + (afterTools ? 2 : 0));
    if (afterTools) assert.equal(history.at(-1).parts[0].text, TOOL_CALL);
    assert.equal(h.transport.mock.callCount(), afterTools ? 3 : 2);
    assert.equal(h.errors.filter((message) => message.startsWith("Model Error")).length, 0);
    assert.deepEqual(h.messages, []);
    assert.equal(h.pop.mock.callCount(), 0);
    assert.equal(h.processor.api.pendingRequest, null);
  });

  test(`${phase}: interruption propagates unchanged without a recovery request`, { timeout: 2000 }, async (t) => {
    const interruption = new UserInterruptException("User chose another model");
    let step = 0;
    const h = harness(t, async () => {
      step += 1;
      if (afterTools && step === 1) return reply(TOOL_CALL);
      throw interruption;
    });
    const before = structuredClone(h.adapter.getHistory());

    await assert.rejects(h.processor.process("Current question"), (error) => error === interruption);

    assert.deepEqual(h.adapter.getHistory().slice(0, before.length), before);
    assert.equal(h.adapter.getHistory().length, before.length + (afterTools ? 2 : 0));
    assert.equal(h.transport.mock.callCount(), afterTools ? 2 : 1);
    assert.deepEqual(h.errors, []);
    assert.deepEqual(h.messages, []);
    assert.equal(h.pop.mock.callCount(), 0);
  });

  test(`${phase}: a failed recovery is propagated without recursively retrying recovery`, { timeout: 2000 }, async (t) => {
    let step = 0;
    const h = harness(t, async () => {
      step += 1;
      if (afterTools && step === 1) return reply(TOOL_CALL);
      return { data: { candidates: [{ finishReason: "SAFETY" }] } };
    });
    const before = structuredClone(h.adapter.getHistory());

    await assert.rejects(h.processor.process("Current question"), GeminiSafetyError);

    assert.deepEqual(h.adapter.getHistory().slice(0, before.length), before);
    assert.equal(h.adapter.getHistory().length, before.length + (afterTools ? 2 : 0));
    assert.equal(h.transport.mock.callCount(), afterTools ? 3 : 2);
    assert.equal(h.errors.length, 1);
    assert.deepEqual(h.messages, []);
  });
});

test("failed requests restore history removed by context preparation", async (t) => {
  const cause = Object.assign(new Error("Bad request"), { response: { status: 400 } });
  const h = harness(t, async () => { throw cause; });
  /**
   * Forces context preparation to discard earlier messages.
   * @param {string} key - The configuration key.
   * @param {unknown} fallback - The default setting.
   * @returns {unknown} The context limit, output reserve or default.
   */
  h.adapter.configManager.get = (key, fallback) => {
    if (key === "context_window_limit") return 800;
    if (key === "max_tokens") return 1;
    return fallback;
  };
  h.adapter.getHistory()[0].parts[0].text = "Earlier question ".repeat(400);
  const before = structuredClone(h.adapter.getHistory());

  await assert.rejects(h.processor.process("Current question"), { name: "APIError", cause });

  assert.deepEqual(h.adapter.getHistory(), before);
  assert.equal(h.transport.mock.calls[0].arguments[1].contents.length, 1);
});

test("context preparation errors roll back the pending message before any HTTP request", async (t) => {
  const cause = new Error("Invalid context configuration");
  const h = harness(t, async () => reply("Unused"));
  const before = structuredClone(h.adapter.getHistory());
  t.mock.method(h.adapter, "_enforceContextLimit", () => { throw cause; });

  await assert.rejects(h.processor.process("Current question"), (error) => error === cause);

  assert.deepEqual(h.adapter.getHistory(), before);
  assert.equal(h.transport.mock.callCount(), 0);
});

test("transport error text does not trigger domain recovery", async (t) => {
  const cause = new Error("Response blocked by safety filters.");
  const h = harness(t, async () => { throw cause; });
  h.adapter.getHistory()[0].parts[0].text = "Earlier question ".repeat(400);
  const before = structuredClone(h.adapter.getHistory());

  await assert.rejects(h.processor.process("Current question"), { name: "APIError", cause });

  assert.deepEqual(h.adapter.getHistory(), before);
  assert.equal(h.transport.mock.callCount(), 1);
  assert.deepEqual(h.errors, []);
});

test("a transient network failure retries the same pending message and records one answer", async (t) => {
  const payloads = [];
  const h = harness(t, async (_url, payload) => {
    payloads.push(payload);
    if (payloads.length === 1) throw networkError();
    return reply("Answer");
  });
  const before = structuredClone(h.adapter.getHistory());

  await h.processor.process("Current question");

  assert.deepEqual(payloads[0], payloads[1]);
  assert.deepEqual(h.adapter.getHistory().slice(0, before.length), before);
  assert.equal(h.adapter.getHistory().length, before.length + 2);
  assert.equal(h.adapter.getHistory().at(-2).parts[0].text, "Current question");
  assert.deepEqual(h.messages, [{ nick: "agent", message: "Answer" }]);
});

[GeminiSafetyError, GeminiEmptyResponseError, UserInterruptException].forEach((ErrorType) => {
  test(`Gemini preserves the identity and cause of ${ErrorType.name}`, async (t) => {
    const cause = new Error("Original cause");
    const domainError = Object.assign(new ErrorType("Typed failure"), { cause });
    const h = harness(t, async () => { throw domainError; });
    const before = structuredClone(h.adapter.getHistory());

    await assert.rejects(h.adapter.sendMessage("Current question"), (error) => {
      assert.equal(error, domainError);
      assert.equal(error.cause, cause);
      return true;
    });

    assert.deepEqual(h.adapter.getHistory(), before);
    assert.equal(h.transport.mock.callCount(), 1);
  });
});

test("HTTP status and provider details survive wrapping with the original cause", async (t) => {
  const cause = Object.assign(new Error("HTTP failure"), {
    code: "ERR_BAD_REQUEST",
    response: { status: 400, data: { error: { message: "Provider details" } } },
  });
  const h = harness(t, async () => { throw cause; });
  const before = structuredClone(h.adapter.getHistory());

  await assert.rejects(h.processor.process("Current question"), (error) => {
    assert.equal(error.name, "APIError");
    assert.equal(error.message, "Provider details");
    assert.equal(error.cause, cause);
    assert.equal(error.response, cause.response);
    assert.equal(error.code, cause.code);
    return true;
  });

  assert.deepEqual(h.adapter.getHistory(), before);
  assert.equal(h.transport.mock.callCount(), 1);
  assert.deepEqual(h.errors, []);
});

test("independent turns do not inherit repetition history", async (t) => {
  const h = harness(t, async () => reply("same answer"));
  h.processor.repetitionDetector = new RepetitionDetector(2, 2);

  await h.processor.process("First question");
  await h.processor.process("Second question");

  assert.equal(h.transport.mock.callCount(), 2);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.messages, [
    { nick: "agent", message: "same answer" },
    { nick: "agent", message: "same answer" },
  ]);
  assert.deepEqual(h.processor.repetitionDetector.buffer, ["same", "answer"]);
});
