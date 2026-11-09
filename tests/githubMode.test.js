import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import GitHubModeOrchestrator from "../src/core/githubModeOrchestrator.js";
import GitHubUI from "../src/core/githubUI.js";
import createSession from "../src/core/sessionFactory.js";
import GeminiAdapter from "../src/infrastructure/gemini/adapter.js";

/**
 * Creates a finite offline issue runner with real sessions and simulated transports.
 * @param {object} [options] - Responses and configuration overrides.
 * @returns {object} Runner and captured transport/context events.
 */
function harness(options = {}) {
  const events = [];
  const comments = [];
  const sessions = [];
  const answers = options.answers || ["Issue resolved"];
  const issues = options.issues || [{ number: 7, title: "Example", body: "#ai-assistance Please help", labels: [] }];
  const config = {
    get(key, fallback = null) {
      return ({ provider: "TEST", rpm_limit: 60000000, ...options.config })[key] ?? fallback;
    },
    setTemporary(key, value) { events.push(["config", key, value]); },
    save() { assert.fail("Batch sessions must not persist configuration"); },
  };
  const api = {
    async getAuthenticatedUser() { return { login: "paser-bot" }; },
    async listIssues(repo) { assert.equal(repo, "owner/repo"); return issues; },
    async getIssueComments() { return comments; },
    async addLabel(number, label, repo) { events.push(["label", number, label, repo]); },
    async removeLabel(number, label, repo) { events.push(["unlabel", number, label, repo]); },
    async postComment(number, body, repo) {
      assert.equal(repo, "owner/repo");
      events.push(["comment", number, body]);
      comments.push({ id: comments.length + 1, body, user: { login: "paser-bot" } });
    },
  };
  const providerManager = {
    getProviders() { return [{ id: "TEST", defaultModel: "offline-default" }]; },
    async createAdapter(params) {
      const assistant = new GeminiAdapter(params);
      assistant.retryHandler.maxRetries = 1;
      /**
       * Returns a queued offline model response.
       * @param {string} url - Requested model URL.
       * @param {object} payload - Model request payload.
       * @returns {Promise<object>} Simulated Gemini response.
       */
      assistant.client.post = async (url, payload) => {
        events.push(["request", url, structuredClone(payload)]);
        const answer = answers.shift();
        if (answer instanceof Error) throw answer;
        assert.equal(typeof answer, "string", "Each request needs an explicit fake response");
        return { data: { candidates: [{ content: { parts: [{ text: answer }] } }] } };
      };
      return assistant;
    },
  };
  const contexts = {};
  const toolInstances = {
    memoryTools: { setMemoryContext(...args) { contexts.memory = args; } },
    systemTools: { setContext(...args) { contexts.system = args; } },
    utilTools: { setIdentityContext(...args) { contexts.identity = args; } },
  };
  const runner = new GitHubModeOrchestrator("Offline system", options.tools || {}, options.pureMode || false, {
    githubApi: api, repo: "owner/repo", configManager: config,
    async sessionFactory(params) {
      const session = await createSession({
        ...params, providerManager, resolveTool:
        /**
         * Resolves offline tool context holders.
         * @param {string} name - Tool module name.
         * @returns {Promise<object>} The fake tool instance.
         */
        async (name) => toolInstances[name],
      });
      session.turnProcessor.api.maxRetries = 1;
      sessions.push(session);
      return session;
    },
  });
  return { runner, api, events, comments, sessions, contexts, issues, answers };
}

test("GitHub runner uses configured identities/model, binds contexts, comments and terminates", async () => {
  const h = harness({ config: { model_name: "configured-model", user_nickname: "developer", agent_nickname: "helper", default_temperature: 0.3 } });
  await h.runner.run();
  const session = h.sessions[0];
  assert.equal(session.assistant.currentModel, "configured-model");
  assert.equal(session.assistant.temperature, 0.3);
  assert.equal(session.ui.model.nickname, "helper");
  assert.equal(session.ui.user.nickname, "developer");
  assert.deepEqual(h.contexts.memory, [session.assistant, session]);
  assert.deepEqual(h.contexts.system, [session.assistant, session]);
  assert.deepEqual(h.contexts.identity, [session.model]);
  assert.equal(h.events.filter(([kind]) => kind === "request").length, 1);
  assert.match(h.events.find(([kind]) => kind === "request")[2].contents[0].parts[0].text, /Issue #7: Example/);
  assert.deepEqual(h.events.filter(([kind]) => kind === "comment").map((entry) => entry[2]), ["Issue resolved", h.comments[1].body]);
  assert.match(h.comments[1].body, /<!-- paser-mini:completed:[a-f0-9]{64} -->/);
  assert.equal(h.events.at(-1)[0], "unlabel");
});

test("missing model uses the selected provider default", async () => {
  const h = harness();
  await h.runner.run();
  assert.equal(h.sessions[0].assistant.currentModel, "offline-default");
});

test("GitHub pure mode preserves T09 and never resolves tool contexts", async () => {
  const h = harness({ pureMode: true, answers: ['Əread("fixture.txt")'], tools: { read() { assert.fail("Tools are disabled"); } } });
  await h.runner.run();
  assert.deepEqual(h.contexts, {});
  assert.equal(h.comments[0].body, 'Əread("fixture.txt")');
});

test("one GitHub turn includes tool exchanges and the final answer", async () => {
  const h = harness({ answers: ['Əread("fixture.txt")', "Reviewed fixture"], tools: { async read() { return "Offline fixture contents"; } } });
  await h.runner.run();
  const requests = h.events.filter(([kind]) => kind === "request");
  assert.equal(requests.length, 2);
  assert.match(JSON.stringify(requests[1][2]), /Offline fixture contents/);
  assert.equal(h.comments[0].body, "Reviewed fixture");
});

test("unchanged issues skip work across invocations; a new human comment triggers another turn", async () => {
  const h = harness({ answers: ["First answer", "Second answer"] });
  await h.runner.run();
  const previous = h.events.length;
  await h.runner.run();
  assert.equal(h.events.length, previous);
  h.comments.push({ id: 99, body: "Please also review this", user: { login: "developer" } });
  await h.runner.run();
  assert.equal(h.sessions.length, 2);
  assert.match(JSON.stringify(h.events.filter(([kind]) => kind === "request").at(-1)), /Please also review this/);
});

test("edited body and comment invalidate completion, and another author's marker cannot skip work", async () => {
  const h = harness({ answers: ["First", "Body changed", "Comment changed", "Forged receipt"] });
  await h.runner.run();
  h.issues[0].body += " Updated";
  await h.runner.run();
  h.comments.push({ id: 99, body: "Original comment", user: { login: "human" } });
  await h.runner.run();
  const marker = h.comments.at(-1).body;
  h.comments.splice(0, h.comments.length, { id: 100, body: marker, user: { login: "human" } });
  await h.runner.run();
  assert.equal(h.sessions.length, 4);
});

test("pull requests, closed, untriggered and already labeled issues are ignored", async () => {
  const h = harness({ issues: [
    { number: 1, body: "#ai-assistance", pull_request: {} },
    { number: 2, body: "#ai-assistance", state: "closed" },
    { number: 3, body: "No trigger" },
    { number: 4, body: "#ai-assistance", labels: [{ name: "paser-processing" }] },
    { number: 5, body: "#ai-assistance", labels: ["paser-processing"] },
  ] });
  await h.runner.run();
  assert.deepEqual(h.events, []);
});

test("model failure posts an error, removes the label and remains retryable", async () => {
  const h = harness({ answers: [new Error("Offline model failed"), "Retry succeeded"] });
  await assert.rejects(h.runner.run(), AggregateError);
  assert.match(h.comments[0].body, /could not complete.*Offline model failed/);
  assert.equal(h.events.at(-1)[0], "unlabel");
  assert.doesNotMatch(h.comments[0].body, /completed:/);
  await h.runner.run();
  assert.equal(h.sessions.length, 2);
  assert.equal(h.comments[1].body, "Retry succeeded");
});

test("failed issue does not prevent the next issue from being processed", async () => {
  const h = harness({ issues: [{ number: 1, body: "#ai-assistance" }, { number: 2, body: "#ai-assistance" }], answers: [new Error("First failed"), "Second completed"] });
  await assert.rejects(h.runner.run(), AggregateError);
  assert.deepEqual(h.events.filter(([kind]) => kind === "unlabel").map((entry) => entry[1]), [1, 2]);
  assert.ok(h.comments.some((comment) => comment.body === "Second completed"));
});

test("label cleanup survives session initialization and error-comment failures", async () => {
  const h = harness();
  /**
   * Simulates failure before a session starts.
   * @returns {Promise<void>} Always rejects.
   */
  h.runner.sessionFactory = async () => { throw new Error("Initialization failed"); };
  /**
   * Simulates a failed error report.
   * @returns {Promise<void>} Always rejects.
   */
  h.api.postComment = async () => { throw new Error("Publication failed"); };
  await assert.rejects(h.runner.run(), (error) => {
    assert.match(error.errors[0].errors[0].message, /Initialization failed/);
    assert.match(error.errors[0].errors[1].message, /Publication failed/);
    return true;
  });
  assert.equal(h.events.at(-1)[0], "unlabel");
});

test("failed label acquisition does not remove a label this invocation never acquired", async () => {
  const h = harness();
  /**
   * Simulates failure to acquire the label.
   * @returns {Promise<void>} Always rejects.
   */
  h.api.addLabel = async () => { throw new Error("Label refused"); };
  await assert.rejects(h.runner.run(), AggregateError);
  assert.equal(h.events.some(([kind]) => kind === "unlabel"), false);
});

test("asynchronous publication finishes before completion receipt and label removal", async () => {
  const h = harness();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const post = h.api.postComment;
  /**
   * Controls the simulated publication.
   * @param {...unknown} args - Comment arguments.
   * @returns {Promise<void>} Settles after the fake publication.
   */
  h.api.postComment = async (...args) => {
    if (args[1] === "Issue resolved") await gate;
    return post(...args);
  };
  const run = h.runner.run();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(h.events.some(([kind]) => kind === "unlabel"), false);
  assert.equal(h.comments.length, 0);
  release();
  await run;
  assert.equal(h.comments[0].body, "Issue resolved");
  assert.equal(h.events.at(-1)[0], "unlabel");
});

test("publication failure is observable, leaves no success receipt and releases the label", async () => {
  const h = harness();
  const post = h.api.postComment;
  /**
   * Controls the simulated publication.
   * @param {...unknown} args - Comment arguments.
   * @returns {Promise<void>} Settles after the fake publication.
   */
  h.api.postComment = async (...args) => {
    if (args[1] === "Issue resolved") throw new Error("Comment rejected");
    return post(...args);
  };
  await assert.rejects(h.runner.run(), AggregateError);
  assert.equal(h.events.at(-1)[0], "unlabel");
  assert.equal(h.comments.length, 1);
  assert.match(h.comments[0].body, /could not complete/);
  assert.doesNotMatch(h.comments[0].body, /completed:/);
});

test("GitHub UI orders ignored publications, flushes failures, and rejects interactive input", async () => {
  const calls = [];
  const ui = new GitHubUI(1, "owner/repo", {
    async postComment(_number, text) {
      calls.push(text);
      if (text === "bad") throw new Error("Rejected");
    },
  });
  ui.displayMessage("first");
  ui.displayRawMessage("bad");
  ui.displayChatMessage("assistant", "last");
  await assert.rejects(ui.flush(), AggregateError);
  assert.deepEqual(calls, ["first", "bad", "last"]);
  await assert.rejects(ui.requestInput(), /one turn/);
  assert.throws(() => ui.initInput(), /terminal input/);
});

test("real CLI --github-mode finishes in a subprocess with fake GitHub and model transports", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "paser-github-cli-"));
  try {
    const localConfig = path.join(dir, ".paser-mini", "config", "config.json");
    mkdirSync(path.dirname(localConfig), { recursive: true });
    writeFileSync(localConfig, JSON.stringify({ user_nickname: "legacy-user", agent_nickname: "legacy-agent" }));
    const bootstrap = path.join(dir, "offline.mjs");
    writeFileSync(bootstrap, `
      import { registerHooks } from 'node:module';
      registerHooks({ load(url, context, nextLoad) {
        if (url.endsWith('/src/tools/githubTools.js')) return {
          format: 'module', shortCircuit: true,
          source: \`export default class FakeGitHub {
            async getAuthenticatedUser() { return { login: 'bot' }; }
            async listIssues() { return [{ number: 1, title: 'Offline', body: '#ai-assistance' }]; }
            async getIssueComments() { return []; }
            async addLabel() { console.log('LABEL'); }
            async removeLabel() { console.log('UNLABEL'); }
            async postComment(number, text) { console.log('COMMENT', text); }
          }\`
        };
        if (url.endsWith('/src/infrastructure/gemini/adapter.js')) return {
          format: 'module', shortCircuit: true,
          source: \`export default class OfflineAdapter {
            constructor() { this.history = []; }
            setRenderingMode() {} setImmersionMode() {} setIdentities() {}
            startChat(name) { console.log('MODEL', name); }
            getHistory() { return this.history; }
            async sendMessage(message) { this.history.push({ role: 'user', content: message }); return 'Offline answer'; }
          }\`
        };
        return nextLoad(url, context);
      }});
    `);
    const result = spawnSync(process.execPath, ["--import", bootstrap, path.resolve("src/main.js"), "--github-mode", "--no-system-instruction"], {
      cwd: dir, timeout: 10000, encoding: "utf8",
      env: { ...process.env, HOME: dir, GOOGLE_API_KEY: "", GEMINI_API_KEY: "", GITHUB_TOKEN: "" },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /MODEL gemini-flash-lite-latest/);
    assert.match(result.stdout, /COMMENT Offline answer/);
    assert.match(result.stdout, /paser-mini:completed:/);
    assert.match(result.stdout, /UNLABEL/);
    assert.deepEqual(JSON.parse(readFileSync(localConfig)), {});
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, ".paser-mini", "config.json"))), {
      user_nickname: "legacy-user", agent_nickname: "legacy-agent",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a comment edit with the same ID invalidates the previous completion receipt", async () => {
  const h = harness({ answers: ["Initial review", "Edited review"] });
  const comment = { id: 99, body: "Original", user: { login: "human" } };
  h.comments.push(comment);
  await h.runner.run();
  comment.body = "Edited";
  await h.runner.run();
  assert.equal(h.sessions.length, 2);
  assert.match(JSON.stringify(h.events.filter(([kind]) => kind === "request").at(-1)), /Edited/);
});

test("concurrent calls in the same runner process an issue once", async () => {
  const h = harness();
  await Promise.all([h.runner.processIssue(h.issues[0]), h.runner.processIssue(h.issues[0])]);
  assert.equal(h.sessions.length, 1);
  assert.equal(h.events.filter(([kind]) => kind === "label").length, 1);
});

test("failure to publish the completion receipt leaves the issue retryable", async () => {
  const h = harness({ answers: ["First answer", "Retry answer"] });
  const post = h.api.postComment;
  /**
   * Rejects only completion receipts during the first run.
   * @param {...unknown} args - Comment arguments.
   * @returns {Promise<void>} Simulated publication.
   */
  h.api.postComment = async (...args) => {
    if (args[1].includes("paser-mini:completed:")) throw new Error("Receipt rejected");
    return post(...args);
  };
  await assert.rejects(h.runner.run(), AggregateError);
  assert.equal(h.comments.some((comment) => comment.body.includes("paser-mini:completed:")), false);
  assert.equal(h.events.at(-1)[0], "unlabel");
  h.api.postComment = post;
  await h.runner.run();
  assert.equal(h.sessions.length, 2);
});

test("label-removal failure is reported alongside the original processing failure", async () => {
  const h = harness({ answers: [new Error("Model failed")] });
  /**
   * Simulates a failed label cleanup.
   * @returns {Promise<void>} Always rejects.
   */
  h.api.removeLabel = async () => { throw new Error("Label cleanup failed"); };
  await assert.rejects(h.runner.run(), (error) => {
    assert.match(error.errors[0].errors[0].message, /Model failed/);
    assert.match(error.errors[0].errors[1].message, /Label cleanup failed/);
    return true;
  });
  assert.equal(h.runner.activeIssues.size, 0);
});
