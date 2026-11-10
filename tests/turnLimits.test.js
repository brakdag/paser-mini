import { test } from "node:test";
import assert from "node:assert/strict";
import TurnLimitError from "../src/core/exceptions/TurnLimitError.js";
import TurnProcessor from "../src/core/turnProcessor.js";
import ExecutionEngine from "../src/core/executionEngine.js";
import SmartToolParser from "../src/core/smartParser.js";
import RepetitionDetector from "../src/core/repetitionDetector.js";
import TerminalUI from "../src/core/terminalUI.js";
import ToolExecutor from "../src/core/toolExecutor.js";
import { UserInterruptException, GeminiSafetyError } from "../src/core/exceptions.js";

/**
 * Builds an offline turn with the production parser, engine and executor.
 * @param {string} reply - Default model response.
 * @param {object} [limits] - Scheduling limits.
 * @returns {object} Harness and observed calls.
 */
function harness(reply, limits = {}) {
  const calls = [];
  const requests = [];
  const errors = [];
  const messages = [];
  const monitoring = [];
  const ui = {
    model: { nickname: "agent" }, inputQueue: [], bashEnabled: true,
    displayError(message) { errors.push(message); },
    displayChatMessage(nick, message) { messages.push({ nick, message }); },
    displayRawMessage(message) { messages.push(message); },
    startToolMonitoring() { monitoring.push("start"); },
    endToolMonitoring(_name, success) { monitoring.push(success ? "success" : "failure"); },
  };
  const tools = {
    async read(...args) { calls.push(args); return "unchanged"; },
  };
  const assistant = {
    async sendMessage(message) { requests.push(message); return reply; },
    injectMessage() {},
  };
  const parser = new SmartToolParser();
  const engine = new ExecutionEngine(tools, parser, ui);
  const processor = new TurnProcessor(assistant, tools, parser, engine, ui, new RepetitionDetector(), limits);
  // These tests exercise tool progress rather than prose repetition.
  /** @returns {boolean} Allows prose so the test exercises tool progress. */
  processor.repetitionDetector.addText = () => true;
  return { processor, engine, parser, ui, tools, calls, requests, errors, messages, monitoring };
}

test("identical successful results stop without another tool or recovery request; next turn is fresh", async () => {
  const h = harness('Əread("a")');
  await assert.rejects(h.processor.process("first"), TurnLimitError);
  assert.equal(h.calls.length, 5);
  assert.equal(h.requests.length, 6);
  assert.match(h.errors[0], /repetition limit/);
  assert.deepEqual(h.messages, []);
  await assert.rejects(h.processor.process("second"), TurnLimitError);
  assert.equal(h.calls.length, 10);
  assert.equal(h.requests.length, 12);
  assert.equal(h.errors.length, 2);
});

test("changed output permits progress but cannot bypass the action budget within one batch", async () => {
  const h = harness(Array(8).fill('Əread("a")').join(" "), { maxActions: 3 });
  /**
   * Simulates a tool result or failure at the tested boundary.
   * @param {...unknown} args Recorded invocation arguments.
   * @returns {Promise<string>} The simulated tool result.
   */
  h.tools.read = async (...args) => { h.calls.push(args); return `revision ${h.calls.length}`; };
  await assert.rejects(h.processor.process("go"), TurnLimitError);
  assert.equal(h.calls.length, 3);
  assert.equal(h.requests.length, 1);
  assert.match(h.errors[0], /action limit/);
});

[false, true].forEach((parserFailure) => {
  test(`${parserFailure ? "argument" : "execution"} failures terminate within a batch at the consecutive error limit`, async () => {
    const call = parserFailure ? 'Əread()' : 'Əread("a")';
    const h = harness(Array(8).fill(call).join(" "), { maxErrors: 3 });
    /**
     * Simulates a tool result or failure at the tested boundary.
     * @param {...unknown} args Recorded invocation arguments.
     * @returns {Promise<string>} The simulated tool result.
     */
    h.tools.read = async (...args) => { h.calls.push(args); throw new Error("tool broke"); };
    await assert.rejects(h.processor.process("go"), TurnLimitError);
    assert.equal(h.calls.length, parserFailure ? 0 : 3);
    assert.equal(h.requests.length, 1);
    assert.match(h.errors[0], /consecutive error limit/);
    assert.equal(h.processor.control, null);
  });
});

test("executor preserves execution status separately from argument errors in order", async () => {
  const h = harness("");
  let step = 0;
  /** @returns {Promise<string>} Fails once, then succeeds. */
  h.tools.read = async () => { step += 1; if (step === 1) throw new Error("broken"); return "ok"; };
  const calls = h.parser.extractToolCalls('Əread("a") Əread() Əread("b")');
  const result = await ToolExecutor.execute(calls, h.engine, h.ui, {}, h.parser);
  assert.equal(result.errorCount, 1);
  assert.equal(result.executionErrorCount, 1);
  assert.equal(result.results[0].success, false);
  assert.match(result.results[1], /^ERR:/);
  assert.equal(result.results[2].success, true);
});

test("a success resets consecutive errors while total actions remain bounded", async () => {
  const h = harness('Əread("a") Əread("b") Əread("c") Əread("d")', { maxErrors: 2, maxActions: 4 });
  let step = 0;
  /**
   * Simulates a tool result or failure at the tested boundary.
   * @param {...unknown} args Recorded invocation arguments.
   * @returns {Promise<string>} The simulated tool result.
   */
  h.tools.read = async (...args) => {
    h.calls.push(args);
    step += 1;
    if (step % 2) throw new Error("failed");
    return "ok";
  };
  await assert.rejects(h.processor.process("go"), TurnLimitError);
  assert.equal(h.calls.length, 4);
  assert.match(h.errors[0], /action limit/);
});

test("repeated prose recovery exhausts the model exchange budget", async () => {
  const h = harness("same text", { maxRequests: 3 });
  /** @returns {string} Forces prose repetition recovery. */
  h.processor.repetitionDetector.addText = () => "same text";
  await assert.rejects(h.processor.process("go"), TurnLimitError);
  assert.equal(h.requests.length, 3);
  assert.equal(h.calls.length, 0);
  assert.match(h.errors.at(-1), /model request limit/);
});

test("deadline after a tool prevents the next tool and model request", async () => {
  let time = 0;
  const h = harness('Əread("a") Əread("b")', { now() { return time; }, maxDurationMs: 10 });
  /**
   * Simulates a tool result or failure at the tested boundary.
   * @param {...unknown} args Recorded invocation arguments.
   * @returns {Promise<string>} The simulated tool result.
   */
  h.tools.read = async (...args) => { h.calls.push(args); time = 10; return "ok"; };
  await assert.rejects(h.processor.process("go"), TurnLimitError);
  assert.equal(h.calls.length, 1);
  assert.equal(h.requests.length, 1);
  assert.match(h.errors[0], /time limit/);
  assert.deepEqual(h.monitoring, ["start", "success"]);
});

test("deadline after an initial response prevents tools and final rendering, including pure mode", async () => {
  await Promise.all([false, true].map(async (pure) => {
    let time = 0;
    const h = harness("unused", { now() { return time; }, maxDurationMs: 10 });
    h.engine.strictPureMode = pure;
    /** @returns {Promise<string>} Delivers a tool request after the deadline. */
    h.processor.api.assistant.sendMessage = async () => { time = 10; return 'Əread("a")'; };
    await assert.rejects(h.processor.process("go"), TurnLimitError);
    assert.equal(h.calls.length, 0);
    assert.deepEqual(h.messages, []);
    assert.match(h.errors[0], /time limit/);
  }));
});

[false, true].forEach((queuedInput) => {
  test(`${queuedInput ? "queued input" : "explicit cancellation"} during a tool prevents the next action and results request`, async () => {
    const h = harness('Əread("a") Əread("b")');
    /**
     * Simulates a tool result or failure at the tested boundary.
     * @param {...unknown} args Recorded invocation arguments.
     * @returns {Promise<string>} The simulated tool result.
     */
    h.tools.read = async (...args) => {
      h.calls.push(args);
      if (queuedInput) h.ui.inputQueue.push("new request");
      else h.processor.cancelPendingTurn();
      return "ok";
    };
    await assert.rejects(h.processor.process("go"), UserInterruptException);
    assert.equal(h.calls.length, 1);
    assert.equal(h.requests.length, 1);
    assert.deepEqual(h.messages, []);
    assert.equal(h.processor.control, null);
    assert.deepEqual(h.monitoring, ["start", "success"]);
  });
});

["start", "end", "format", "tool"].forEach((failurePoint) => {
  test(`monitoring closes when ${failurePoint} fails and the engine never starts the next tool`, async () => {
    const h = harness('Əread("a") Əread("b")', { maxErrors: 1 });
    if (failurePoint === "start") {
      /** Throws at the selected boundary. */
      h.ui.startToolMonitoring = () => { h.monitoring.push("start"); throw new Error("UI failed"); };
    }
    if (failurePoint === "end") {
      /** Throws at the selected boundary. */
      h.ui.endToolMonitoring = () => { h.monitoring.push("end"); throw new Error("UI failed"); };
    }
    if (failurePoint === "format") {
      /** Throws at the selected boundary. */
      h.parser.formatToolResponse = () => { throw new Error("format failed"); };
    }
    if (failurePoint === "tool") {
      /** Throws at the selected boundary. */
      h.tools.read = async () => { throw new UserInterruptException(); };
    }
    if (failurePoint === "start") await assert.rejects(h.processor.process("go"), TurnLimitError);
    else await assert.rejects(h.processor.process("go"), /failed|interrupted/i);
    assert.equal(h.monitoring.length, 2);
    assert.equal(h.calls.length, failurePoint === "end" || failurePoint === "format" ? 1 : 0);
    assert.equal(h.processor.control, null);
    assert.equal(h.requests.length, 1);
  });
});

test("argument key order cannot bypass unchanged-result detection", async () => {
  const h = harness("");
  h.engine.toolTracker.maxUnchangedResults = 2;
  await h.engine.executeToolCall("read", { path: "a", tail: 1 });
  await h.engine.executeToolCall("read", { tail: 1, path: "a" });
  const blocked = await h.engine.executeToolCall("read", { path: "a", tail: 1 });
  assert.equal(blocked.terminate, true);
  assert.equal(blocked.success, false);
  assert.equal(h.calls.length, 2);
});


test("the per-call total cap also stops calls whose output keeps changing", async () => {
  const h = harness('Əread("a")');
  h.engine.toolTracker.maxAttempts = 2;
  /** @returns {Promise<string>} A different result on every successful attempt. */
  h.tools.read = async () => String(h.calls.push([]));
  await assert.rejects(h.processor.process("go"), TurnLimitError);
  assert.equal(h.calls.length, 2);
  assert.equal(h.requests.length, 3);
  assert.match(h.errors[0], /repetition limit/);
});

test("consecutive tool errors accumulate across model exchanges", async () => {
  const h = harness('Əread("a")', { maxErrors: 2 });
  /** @returns {Promise<never>} Always rejects this action. */
  h.tools.read = async () => { h.calls.push([]); throw new Error("broken"); };
  await assert.rejects(h.processor.process("go"), TurnLimitError);
  assert.equal(h.calls.length, 2);
  assert.equal(h.requests.length, 2);
  assert.match(h.errors[0], /consecutive error limit/);
});

test("safety recovery uses the same model budget as the initial exchange", async () => {
  const h = harness("unused", { maxRequests: 1 });
  /** @returns {Promise<never>} Simulates a rejected model response. */
  h.processor.api.assistant.sendMessage = async () => {
    h.requests.push("request");
    throw new GeminiSafetyError("blocked");
  };
  await assert.rejects(h.processor.process("go"), TurnLimitError);
  assert.equal(h.requests.length, 1);
  assert.equal(h.calls.length, 0);
  assert.match(h.errors.at(-1), /model request limit/);
});

[Object.assign(new Error("aborted"), { name: "AbortError" }),
  Object.assign(new Error("cancelled"), { code: "ERR_CANCELED" })].forEach((error) => {
  test(`tool cancellation ${error.name} propagates and closes monitoring`, async () => {
    const h = harness('Əread("a") Əread("b")');
    /** @returns {Promise<never>} Interrupts the first action. */
    h.tools.read = async () => { h.calls.push([]); throw error; };
    await assert.rejects(h.processor.process("go"), failure => failure === error);
    assert.equal(h.calls.length, 1);
    assert.equal(h.requests.length, 1);
    assert.deepEqual(h.monitoring, ["start", "failure"]);
  });
});


[false, true].forEach((stopFails) => {
  test(`terminal monitoring releases its entry after ${stopFails ? "spinner" : "rendering"} failure`, (t) => {
    const ui = new TerminalUI();
    let stopped = 0;
    ui.activeSpinners.set("read", {
      stop() { stopped += 1; if (stopFails) throw new Error("spinner failed"); },
    });
    t.mock.method(ui, "displayToolStatus", () => { throw new Error("rendering failed"); });
    assert.throws(() => ui.endToolMonitoring("read", true, "file"), /failed/);
    assert.equal(stopped, 1);
    assert.equal(ui.activeSpinners.size, 0);
  });
});
