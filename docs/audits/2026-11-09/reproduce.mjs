// Characterization probes: exit 0 confirms the audited defects, NOT their fixes.
// Run from any cwd: node docs/audits/2026-11-09/reproduce.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const self = fileURLToPath(import.meta.url);
const source = relative => new URL(`../../../src/${relative}`, import.meta.url);

if (process.argv[2] !== "--fixture") {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "paser-audit-"));
  try {
    const env = { PASER_MINI_LOG_LEVEL: "off" };
    for (const key of ["PATH", "LANG", "LC_ALL", "TMPDIR"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    const child = spawn(process.execPath, [self, "--fixture"], {
      cwd: fixture, env, stdio: "inherit", timeout: 30000, killSignal: "SIGKILL",
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    process.exitCode = code ?? 1;
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
} else {
  await reproduce();
}

async function reproduce() {
  const { default: ChatManager } = await import(source("core/chatManager.js"));
  const { default: GeminiAdapter } = await import(source("infrastructure/gemini/adapter.js"));
  const { default: CerebrasAdapter } = await import(source("infrastructure/cerebras/adapter.js"));
  const { default: FileTools } = await import(source("tools/fileTools.js"));
  const { default: SystemTools } = await import(source("tools/systemTools.js"));
  const { default: GitHubModeOrchestrator } = await import(source("core/githubModeOrchestrator.js"));
  const { McpManager } = await import(source("infrastructure/McpManager.js"));
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { PassThrough } = await import("node:stream");

  const configManager = {
    get(key, fallback) { return key === "rpm_limit" ? 60000000 : fallback; },
    save() {}, setTemporary() {},
  };
  const report = (id, evidence) => console.log(JSON.stringify({ id, ...evidence }));
  function harness(Adapter = GeminiAdapter, overrides = {}) {
    const errors = [];
    const ui = overrides.ui || {
      inputQueue: [],
      setBashEnabled(value) { this.bashEnabled = value; },
      setCommandHandler() {}, setRenderingMode() {},
      setIdentities(user, model) { this.user = user; this.model = model; },
      displayError(message) { errors.push(message); },
      displayInfo() {}, displayChatMessage() {},
      startToolMonitoring() {}, endToolMonitoring() {},
    };
    const assistant = new Adapter({ ui, configManager });
    assistant.retryHandler.maxRetries = 1;
    // Every transport is replaced before initialization; no provider is contacted.
    assistant.client.get = async () => ({ data: {} });
    assistant.client.post = async () => { throw new Error("Unexpected offline request"); };
    const manager = new ChatManager({
      assistant, ui, configManager, tools: overrides.tools || {},
      systemInstruction: "AUDIT_SYSTEM_SENTINEL",
      user: { nickname: "user" },
      model: { nickname: "agent", name: "fixture-model", temperature: 0.7 },
    });
    return { manager, assistant, ui, errors };
  }
  const reply = text => ({ data: { candidates: [{ content: { parts: [{ text }] } }] } });

  // A01: startChat pauses at metadata; runOnce sends before the system entry exists.
  {
    const h = harness(CerebrasAdapter);
    const metadata = Promise.withResolvers();
    h.assistant.client.get = () => metadata.promise;
    let payload;
    h.assistant.client.post = async (_url, request) => {
      payload = structuredClone(request);
      return { data: { choices: [{ message: { content: "answer" } }] } };
    };
    await h.manager.runOnce("first question");
    assert.equal(payload.messages.some(message => message.role === "system"), false);
    metadata.resolve({ data: { context_length: 8192 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.assistant.getHistory()[0].role, "system");
    report("A01", { firstPayloadRoles: payload.messages.map(message => message.role), systemAppearsAfterMetadata: true });
  }

  // A02: a scheduling limit is swallowed, losing /rewrite rollback and batch failure.
  {
    const h = harness(GeminiAdapter, { tools: { read: async () => "fixture" } });
    h.manager.initializeSession();
    h.assistant.client.post = async () => reply("original answer");
    await h.manager.processTurn("original question");
    const before = structuredClone(h.assistant.getHistory());
    h.manager.turnProcessor.limits = { maxRequests: 1 };
    h.assistant.client.post = async () => reply('Əread("fixture.txt")');
    const rewritten = await h.manager.rewriteLastTurn("replacement question");
    assert.equal(rewritten, true);
    assert.notDeepEqual(h.assistant.getHistory(), before);
    assert.match(h.errors.at(-1), /request limit/);

    const comments = [];
    let runs = 0;
    const githubApi = {
      getAuthenticatedUser: async () => ({ login: "fixture-bot" }),
      getIssueComments: async () => comments,
      addLabel: async () => {}, removeLabel: async () => {},
      postComment: async (_number, body) => { comments.push({ body, user: { login: "fixture-bot" } }); },
    };
    const runner = new GitHubModeOrchestrator("fixture", {}, false, {
      githubApi, configManager, repo: "fixture/offline",
      sessionFactory: async ({ ui }) => {
        runs += 1;
        const session = harness(GeminiAdapter, { ui });
        session.manager.turnProcessor.limits = { maxErrors: 1 };
        session.assistant.client.post = async () => reply('Əread("fixture.txt")');
        return session.manager;
      },
    });
    const issue = { number: 1, title: "fixture", body: "#ai-assistance" };
    await runner.processIssue(issue);
    await runner.processIssue(issue);
    assert.equal(runs, 1);
    assert.ok(comments.some(comment => comment.body.includes("paser-mini:completed:")));
    report("A02", { rewriteReportedSuccess: rewritten, oldHistoryRestored: false, githubCompletionReceipt: true, runsForTwoAttempts: runs });
  }

  // A03: String.replace interprets dollar substitutions in supposedly literal text.
  {
    const files = new FileTools();
    await files.write("replace.txt", "before TOKEN after");
    const replacement = "cost=$$; matched=$&";
    await files.replace("replace.txt", "TOKEN", replacement);
    const actual = await files.read("replace.txt");
    const expected = `before ${replacement} after`;
    assert.equal(actual, "before cost=$; matched=TOKEN after");
    assert.notEqual(actual, expected);
    report("A03", { expected, actual });
  }

  // A04: only a harmless local shell exits 7; it writes no files.
  {
    const system = new SystemTools();
    const h = harness(GeminiAdapter, { tools: { execute: command => system.execute(command) } });
    h.ui.bashEnabled = true;
    const result = await h.manager.engine.executeToolCall("execute", { command: "printf partial; exit 7" });
    assert.equal(result.success, true);
    assert.equal(result.outcome.isError, false);
    assert.match(result.result, /Exit Code 7/);
    report("A04", { success: result.success, isError: result.outcome.isError, output: result.result });
  }

  // A05: the real manager receives two advertised pages, but asks only for page one.
  {
    const originals = Object.fromEntries(["connect", "listTools", "close"].map(key => [key, Client.prototype[key]]));
    const cursors = [];
    const manager = new McpManager({ createStdioTransport: () => ({ stderr: new PassThrough() }) });
    try {
      Client.prototype.connect = async () => {};
      Client.prototype.close = async () => {};
      Client.prototype.listTools = async params => {
        cursors.push(params?.cursor ?? null);
        return params?.cursor === "page-2"
          ? { tools: [{ name: "second", inputSchema: { type: "object" } }] }
          : { tools: [{ name: "first", inputSchema: { type: "object" } }], nextCursor: "page-2" };
      };
      await manager.connectServer("fixture", { command: "never-spawned" });
      assert.deepEqual(Object.keys(manager.getTools()), ["mcp_fixture_first"]);
      assert.deepEqual(cursors, [null]);
      report("A05", { cursorsRequested: cursors, discovered: Object.keys(manager.getTools()), missing: "mcp_fixture_second" });
    } finally {
      await manager.shutdown();
      Object.assign(Client.prototype, originals);
    }
  }

  // A06: rejection of an overlapping turn releases the flag owned by the first turn.
  {
    const h = harness();
    h.manager.initializeSession();
    const response = Promise.withResolvers();
    const entered = Promise.withResolvers();
    h.assistant.client.post = async () => { entered.resolve(); return response.promise; };
    const first = h.manager.processTurn("pending question");
    await entered.promise;
    await assert.rejects(h.manager.processTurn("overlap"), /already active/);
    assert.equal(h.manager._turnInProgress, false);
    assert.ok(h.manager.turnProcessor.control);
    await h.manager.updateSystemContext("changed during active turn", {});
    assert.equal(h.assistant.systemInstruction, "changed during active turn");
    report("A06", { managerReportsIdle: true, processorStillActive: true, promptChangedDuringRequest: true });
    response.resolve(reply("answer"));
    await first;
  }
}
