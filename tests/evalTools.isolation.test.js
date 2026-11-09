import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import EvalTools from "../src/tools/evalTools.js";
import PathValidator from "../src/utils/pathValidator.js";

const escape = 'const p = console.log.constructor("return process")(); const fs = p.getBuiltinModule("node:fs");';

/**
 * Builds a disposable project with a separate host-only sentinel.
 * @param {import('node:test').TestContext} t - Cleanup owner.
 * @returns {Promise<object>} Project, external paths and runner.
 */
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "paser-run-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, "project");
  await fs.mkdir(root);
  const secret = path.join(base, "host-secret");
  await fs.writeFile(secret, "host only");
  await fs.mkdir(path.join(root, ".git"));
  await fs.writeFile(path.join(root, ".git", "sentinel"), "keep");
  const tools = new EvalTools({ pathValidator: new PathValidator({ root }), timeoutMs: 1500 });
  return { root, secret, tools };
}

/**
 * Finds every host-visible process still belonging to a run's PID namespace.
 * @param {string} namespace - Kernel namespace identifier written by the child.
 * @returns {Promise<string[]>} Live process IDs in that namespace.
 */
async function processesIn(namespace) {
  const entries = (await fs.readdir("/proc")).filter(name => /^\d+$/u.test(name));
  const matches = await Promise.all(entries.map(async name => {
    try { return await fs.readlink(`/proc/${name}/ns/pid`) === namespace ? name : null; }
    catch (error) {
      if (["ENOENT", "EACCES", "EPERM"].includes(error.code)) return null;
      throw error;
    }
  }));
  return matches.filter(Boolean);
}

describe("run OS isolation", () => {
  it("constructor escape reaches a disposable process without host files or credentials", async (t) => {
    const { tools, secret } = await fixture(t);
    const previous = process.env.PASER_RUN_SENTINEL;
    process.env.PASER_RUN_SENTINEL = "must not inherit";
    t.after(() => {
      if (previous === undefined) delete process.env.PASER_RUN_SENTINEL;
      else process.env.PASER_RUN_SENTINEL = previous;
    });
    const output = JSON.parse(await tools.executeJS(`${escape}
      const hostVisible = fs.existsSync(${JSON.stringify(secret)});
      await Promise.resolve();
      return { pid: p.pid, hostVisible, credential: p.env.PASER_RUN_SENTINEL ?? null };
    `));
    assert.notEqual(output.result.pid, process.pid);
    assert.equal(output.result.hostVisible, false);
    assert.equal(output.result.credential, null);
  });

  it("kernel mounts block arbitrary writes to protected metadata and external symlinks", async (t) => {
    const { root, secret, tools } = await fixture(t);
    await fs.symlink(secret, path.join(root, "escape"));
    await assert.rejects(tools.executeJS(`${escape} fs.writeFileSync(".git/sentinel", "bad");`), /EROFS|EACCES/);
    await assert.rejects(tools.executeJS(`${escape} fs.readFileSync("escape", "utf8");`), /ENOENT|EACCES/);
    assert.equal(await fs.readFile(secret, "utf8"), "host only");
    assert.equal(await fs.readFile(path.join(root, ".git/sentinel"), "utf8"), "keep");
  });

  it("does not mount host directories reached through protected metadata symlinks", async (t) => {
    const { root, secret, tools } = await fixture(t);
    await fs.symlink(path.dirname(secret), path.join(root, ".aws"));
    await assert.rejects(tools.executeJS("1 + 1"), /RUN_ROOT/);
  });

  it("cannot connect to a host loopback listener", async (t) => {
    const { tools } = await fixture(t);
    let connections = 0;
    const server = net.createServer(socket => { connections += 1; socket.destroy(); });
    await new Promise(resolve => { server.listen(0, "127.0.0.1", () => resolve(undefined)); });
    t.after(() => new Promise((resolve, reject) => { server.close(error => { if (error) reject(error); else resolve(undefined); }); }));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const result = JSON.parse(await tools.executeJS(`${escape}
      return await new Promise(resolve => {
        const socket = p.getBuiltinModule("node:net").connect(${address.port}, "127.0.0.1");
        socket.on("connect", () => { socket.destroy(); resolve("connected"); });
        socket.on("error", () => resolve("blocked"));
      });
    `));
    assert.equal(result.result, "blocked");
    assert.equal(connections, 0);
  });

  ["success", "timeout", "error"].forEach(outcome => {
    it(`kills timers and detached descendants after ${outcome}`, async (t) => {
      const { root, tools } = await fixture(t);
      const descendant = `const fs=require("node:fs"); fs.writeFileSync("namespace", fs.readlinkSync("/proc/self/ns/pid")); setInterval(()=>fs.appendFileSync("ticks","x"),20);`;
      const endings = {
        success: "return 42;",
        timeout: "await new Promise(() => {});",
        error: 'throw new Error("deliberate failure");',
      };
      const code = `${escape}
        p.getBuiltinModule("node:child_process").spawn("/runtime/node", ["--jitless", "-e", ${JSON.stringify(descendant)}], {detached:true, stdio:"ignore"});
        const timers = p.getBuiltinModule("node:timers");
        await new Promise(resolve => {
          const timer = timers.setInterval(() => {
            if (fs.existsSync("ticks")) { timers.clearInterval(timer); resolve(); }
          }, 10);
        });
        timers.setInterval(() => fs.appendFileSync("parent-ticks", "x"), 20);
        ${endings[outcome]}
      `;
      if (outcome === "timeout") await assert.rejects(tools.executeJS(code), /ASYNC_TIMEOUT/);
      else if (outcome === "error") await assert.rejects(tools.executeJS(code), /deliberate failure/);
      else assert.equal(JSON.parse(await tools.executeJS(code)).result, 42);
      const namespace = await fs.readFile(path.join(root, "namespace"), "utf8");
      const snapshot = await fs.readFile(path.join(root, "ticks"), "utf8");
      await delay(150);
      assert.equal(await fs.readFile(path.join(root, "ticks"), "utf8"), snapshot);
      assert.deepEqual(await processesIn(namespace), []);
    });
  });

  it("fresh calls do not retain globals or mix concurrent traces", async (t) => {
    const { tools } = await fixture(t);
    await tools.executeJS("globalThis.previousCall = 42;");
    assert.equal(JSON.parse(await tools.executeJS("typeof previousCall")).result, "undefined");
    const results = await Promise.all(["first", "second"].map(value => tools.executeJS(`console.log("${value}"); "${value}";`)));
    results.forEach((result, index) => {
      const output = JSON.parse(result);
      assert.equal(output.result, index === 0 ? "first" : "second");
      assert.equal(output.trace.length, 2);
    });
  });

  it("caps output and rejects impossible input before executing it", async (t) => {
    const { tools } = await fixture(t);
    await assert.rejects(tools.executeJS('"x".repeat(2 * 1024 * 1024)'), /RUN_OUTPUT/);
    await assert.rejects(tools.executeJS("x".repeat(1024 * 1024 + 1)), /RUN_INPUT/);
    assert.throws(() => new EvalTools({ timeoutMs: 0 }), /timeoutMs/);
    assert.throws(() => new EvalTools({ timeoutMs: 5001 }), /timeoutMs/);
  });

  it("enforces hard resource ceilings and preserves Unicode results", async (t) => {
    const { tools } = await fixture(t);
    const output = JSON.parse(await tools.executeJS(`${escape}
      await Promise.resolve();
      return { limits: fs.readFileSync("/proc/self/limits", "utf8"), text: "🦉".repeat(20000) };
    `));
    assert.match(output.result.limits, /Max address space\s+1073741824\s+1073741824/u);
    assert.match(output.result.limits, /Max file size\s+16777216\s+16777216/u);
    assert.match(output.result.limits, /Max processes\s+256\s+256/u);
    assert.equal(output.result.text, "🦉".repeat(20000));
  });

  it("fails closed when sandbox setup fails, without running code on the host", async (t) => {
    const { root, secret, tools } = await fixture(t);
    await fs.rm(root, { recursive: true });
    await assert.rejects(tools.executeJS(`${escape} fs.writeFileSync(${JSON.stringify(secret)}, "bad");`), /RUN_FAILED|ENOENT/);
    assert.equal(await fs.readFile(secret, "utf8"), "host only");
  });
});
