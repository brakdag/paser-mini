import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ApplicationLifecycle from "../src/core/applicationLifecycle.js";
import { TerminalInput } from "../src/core/TerminalInput.js";

const mainUrl = new URL("../src/main.js", import.meta.url);
const lifecycleUrl = new URL("../src/core/applicationLifecycle.js", import.meta.url).href;
const loggerUrl = new URL("../src/core/logger.js", import.meta.url).href;

/**
 * Creates an empty project and HOME without inherited credentials.
 * @param {object} t - Test context.
 * @returns {Promise<object>} Isolated subprocess options.
 */
async function fixture(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paser-lifecycle-"));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const env = { PATH: process.env.PATH, HOME: cwd, PASER_MINI_LOG_LEVEL: "off" };
  return { cwd, env, encoding: "utf8", timeout: 10000 };
}

test("close is idempotent, runs all cleanups after failure and flushes last", async () => {
  const events = [];
  const owner = new ApplicationLifecycle({ flush() { events.push("flush"); } });
  owner.own(() => { events.push("first"); throw new Error("cleanup failure"); });
  let completion;
  owner.own(() => { events.push("second"); assert.equal(owner.close(), completion); });
  completion = owner.close();
  assert.equal(owner.close(), completion);
  await assert.rejects(completion, /cleanup failed/);
  assert.deepEqual(events, ["first", "second", "flush"]);
  assert.throws(() => owner.own(() => {}), /shutting down/);
});

test("a stuck resource cannot prevent log flushing or exceed the deadline", async () => {
  let flushed = false;
  const owner = new ApplicationLifecycle({ timeoutMs: 60, flush() { flushed = true; } });
  owner.own(() => new Promise(() => {}));
  await assert.rejects(owner.close(), /cleanup failed/);
  assert.equal(flushed, true);
});

test("closing terminal input resolves pending and future reads and confirmations", async () => {
  const input = new TerminalInput();
  const pending = input.requestInput("");
  input.close();
  input.close();
  assert.equal(await pending, null);
  assert.equal(await input.requestInput(""), null);
  assert.equal(await input.getConfirmation("Confirm"), false);
});

test("importing domain modules and the entry point creates no session files or handlers", async t => {
  const options = await fixture(t);
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    const before = process.eventNames().map(name => [name, process.listenerCount(name)]);
    await import(${JSON.stringify(mainUrl.href)});
    const after = process.eventNames().map(name => [name, process.listenerCount(name)]);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('installed process handlers');
  `], options);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readdir(options.cwd), []);
});

["", "/exit\n", "/quit\n", "/q\n", ":q\n"].forEach(input => {
  test(`real CLI drains and exits on ${input.trim() || "EOF"}`, async t => {
    const options = await fixture(t);
    let entry = mainUrl.pathname;
    if (input === "/q\n") {
      entry = path.join(options.cwd, "paser-mini");
      await fs.symlink(mainUrl.pathname, entry);
    }
    const result = spawnSync(process.execPath, [entry, "--no-system-instruction"], { ...options, input });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const log = await fs.readFile(path.join(options.cwd, ".paser-mini/log/session.log"), "utf8");
    assert.match(log, /Session Started/);
  });
});

["normal", "SIGINT", "SIGTERM", "exception", "rejection", "startup"].forEach(mode => {
  test(`process ${mode} closes owned resources once and flushes the final log`, async t => {
    const options = await fixture(t);
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import Lifecycle, { runProcess } from ${JSON.stringify(lifecycleUrl)};
      import logger from ${JSON.stringify(loggerUrl)};
      const owner = new Lifecycle({flush: () => logger.shutdownStreams()});
      let count = 0;
      const activeResource = setInterval(() => {}, 1000);
      owner.own(() => clearInterval(activeResource));
      owner.own(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        logger.writeRawToSession('last cleanup ' + (++count));
      });
      const mode = ${JSON.stringify(mode)};
      const code = await runProcess(async () => {
        logger.start();
        if (mode === 'normal') return;
        if (mode === 'startup') throw Error('startup fixture');
        setTimeout(() => {
          if (mode === 'exception') throw Error('fatal fixture');
          if (mode === 'rejection') { Promise.reject(Error('fatal fixture')); return; }
          process.kill(process.pid, mode);
        }, 10);
        await new Promise(() => {});
      }, owner);
      process.exit(code);
    `], options);
    assert.ifError(result.error);
    assert.equal(result.status, ["exception", "rejection", "startup"].includes(mode) ? 1 : 0, result.stderr);
    const log = await fs.readFile(path.join(options.cwd, ".paser-mini/log/session.log"), "utf8");
    assert.match(log, /last cleanup 1\n$/);
    assert.doesNotMatch(log, /last cleanup 2/);
  });
});

test("real CLI closes a local MCP server and flushes the session on EOF", async t => {
  const options = await fixture(t);
  const directory = path.join(options.cwd, ".paser-mini/config");
  await fs.mkdir(directory, { recursive: true });
  const server = `
    const fs = require('node:fs');
    fs.writeFileSync('server.pid', String(process.pid));
    require('node:readline').createInterface({input: process.stdin}).on('line', line => {
      const request = JSON.parse(line);
      if (request.id === undefined) return;
      const result = request.method === 'initialize'
        ? {protocolVersion: '2024-11-05', capabilities: {tools: {}}, serverInfo: {name: 'fixture', version: '1'}}
        : {tools: []};
      process.stdout.write(JSON.stringify({jsonrpc: '2.0', id: request.id, result}) + '\\n');
    });
    setInterval(() => {}, 1000);
  `;
  await fs.writeFile(path.join(directory, "mcp.json"), JSON.stringify({
    mcpServers: { fixture: { command: process.execPath, args: ["-e", server] } },
  }));
  const result = spawnSync(process.execPath, [mainUrl.pathname], { ...options, input: "" });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const pid = Number(await fs.readFile(path.join(options.cwd, "server.pid"), "utf8"));
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  assert.match(await fs.readFile(path.join(options.cwd, ".paser-mini/log/session.log"), "utf8"), /Session Started/);
});

test("inspector cleanup terminates its process group including a debuggee", async t => {
  const options = await fixture(t);
  const inspectorUrl = new URL("../src/tools/inspectTools.js", import.meta.url).href;
  const target = path.join(options.cwd, "target.js");
  await fs.writeFile(target, "// fixture");
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { spawn } from 'node:child_process';
    import fs from 'node:fs';
    import assert from 'node:assert/strict';
    import InspectTools from ${JSON.stringify(inspectorUrl)};
    let child;
    const inspector = new InspectTools({spawnProcess(_executable, _args, options) {
      child = spawn(process.execPath, ['-e', ${JSON.stringify(`
        const {spawn} = require('node:child_process');
        const fs = require('node:fs');
        process.on('SIGTERM', () => {});
        const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
        fs.writeFileSync('debuggee.pid', String(descendant.pid));
        process.stdout.write('debug> ');
        setInterval(() => {}, 1000);
      `)}], options);
      return child;
    }});
    try {
      await inspector.inspect(${JSON.stringify(target)});
      const descendant = Number(fs.readFileSync('debuggee.pid', 'utf8'));
      const closing = inspector.close();
      assert.equal(inspector.close(), closing);
      await closing;
      assert.throws(() => process.kill(child.pid, 0), {code: 'ESRCH'});
      // A reaped parent may briefly leave a zombie awaiting the container's init.
      const state = '/proc/' + descendant + '/stat';
      assert.ok(!fs.existsSync(state) || /\\) Z /.test(fs.readFileSync(state, 'utf8')));
    } finally { await inspector.close(); }
  `], options);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

/** @type {Array<"SIGINT"|"SIGTERM"|"fatal">} */
const cliStops = ["SIGINT", "SIGTERM", "fatal"];
cliStops.forEach(mode => {
  test(`real CLI closes pending input on ${mode}`, async t => {
    const { spawn } = await import("node:child_process");
    const options = await fixture(t);
    const args = [mainUrl.pathname, "--no-system-instruction"];
    if (mode === "fatal") {
      const preload = path.join(options.cwd, "fatal.mjs");
      await fs.writeFile(preload, `
        const write = process.stdout.write.bind(process.stdout);
        let scheduled = false;
        process.stdout.write = (...args) => {
          if (!scheduled && String(args[0]) === '> ') {
            scheduled = true;
            setImmediate(() => { throw Error('fatal CLI fixture'); });
          }
          return write(...args);
        };
      `);
      args.unshift("--import", preload);
    }
    const child = spawn(process.execPath, args, options);
    t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
    let stderr = "";
    child.stderr.on("data", data => { stderr += data; });
    let signaled = false;
    child.stdout.on("data", data => {
      if (mode !== "fatal" && !signaled && data.toString().includes("> ")) {
        signaled = true;
        child.kill(mode);
      }
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    assert.equal(code, mode === "fatal" ? 1 : 0, stderr);
    if (mode === "fatal") assert.match(stderr, /fatal CLI fixture/);
    else assert.equal(signaled, true);
    assert.match(await fs.readFile(path.join(options.cwd, ".paser-mini/log/session.log"), "utf8"), /Session Started/);
  });
});

test("/exit cancels an active model transport and drains the real CLI", async t => {
  const { spawn } = await import("node:child_process");
  const options = await fixture(t);
  const preload = path.join(options.cwd, "offline.mjs");
  const axiosUrl = new URL("../node_modules/axios/index.js", import.meta.url).href;
  await fs.writeFile(preload, `
    import axios from ${JSON.stringify(axiosUrl)};
    axios.defaults.adapter = config => new Promise((resolve, reject) => {
      config.signal.addEventListener('abort', () => reject(config.signal.reason), {once: true});
      process.stdout.write('request-started\\n');
    });
  `);
  const child = spawn(process.execPath, ["--import", preload, mainUrl.pathname, "--no-system-instruction", "--message", "go"], options);
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  let stderr = "";
  let exiting = false;
  child.stderr.on("data", data => { stderr += data; });
  child.stdout.on("data", data => {
    if (!exiting && data.toString().includes("request-started")) {
      exiting = true;
      child.stdin.write("/exit\n");
    }
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  assert.equal(code, 0, stderr);
  assert.equal(exiting, true);
});

test("tool reload and permanent shutdown share cleanup and reject late acquisitions", async t => {
  const options = await fixture(t);
  const registryUrl = new URL("../src/infrastructure/registry.js", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { getToolInstance, shutdownTools } from ${JSON.stringify(registryUrl)};
    const [first, second] = await Promise.all([getToolInstance('inspectTools'), getToolInstance('inspectTools')]);
    assert.equal(first, second);
    let closed = 0;
    first.close = async () => { closed += 1; };
    const acquiring = assert.rejects(getToolInstance('loadTools'), /shutting down/);
    const reload = shutdownTools();
    assert.equal(shutdownTools(true), reload);
    await acquiring;
    await reload;
    assert.equal(closed, 1);
    assert.equal(shutdownTools(), reload);
    await assert.rejects(getToolInstance('inspectTools'), /shutting down/);
  `], options);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readdir(options.cwd), []);
});

test("tool cleanup continues after synchronous and asynchronous close failures", async t => {
  const options = await fixture(t);
  const registryUrl = new URL("../src/infrastructure/registry.js", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { getToolInstance, shutdownTools } from ${JSON.stringify(registryUrl)};
    const events = [];
    const first = await getToolInstance('inspectTools');
    const second = await getToolInstance('systemTools');
    const third = await getToolInstance('utilTools');
    first.close = () => { events.push('first'); throw Error('sync failure'); };
    second.close = async () => { events.push('second'); throw Error('async failure'); };
    third.close = () => { events.push('third'); };
    await assert.rejects(shutdownTools(), error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors.map(item => item.message), ['sync failure', 'async failure']);
      return true;
    });
    assert.deepEqual(events, ['first', 'second', 'third']);
    assert.notEqual(await getToolInstance('inspectTools'), first);
    await shutdownTools(true);
  `], options);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
