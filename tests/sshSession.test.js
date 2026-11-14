import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn as spawnPty } from "node-pty";
import SshSession from "../src/core/sshSession.js";

/**
 * Runs the exact SSH shell protocol in a real local PTY, without network or credentials.
 * @param {object} t - Test context owning terminal cleanup.
 * @returns {object} Session and recorded SSH invocation.
 */
function localShell(t) {
  const calls = [];
  const session = new SshSession({
    spawn(file, args, options) {
      calls.push({ file, args });
      return spawnPty("/bin/sh", ["-c", args.at(-1)], options);
    },
  });
  t.after(() => session.disconnect());
  return { session, calls };
}

test("SSH keeps shell directory, variables and failure status across commands", { timeout: 15000 }, async t => {
  const { session, calls } = localShell(t);
  const connected = await session.connect("user@home", () => {});
  assert.equal(connected.code, 0);
  assert.equal(calls[0].file, "ssh");
  assert.ok(calls[0].args.includes("-tt"));
  assert.deepEqual(calls[0].args.slice(-3, -1), ["--", "user@home"]);
  const setup = await session.run("cd /tmp; export PASER_SSH_TEST='a quoted value'", () => {});
  assert.equal(setup.code, 0);
  const result = await session.run('pwd; printf "%s\\n" "$PASER_SSH_TEST"; false', () => {});
  assert.equal(result.code, 1);
  assert.match(result.output, /\/tmp/);
  assert.match(result.output, /a quoted value/);
  assert.doesNotMatch(result.output, /eval |command printf/);
  assert.equal(result.output.includes("\x1e"), false);
  assert.equal(result.output.includes("\x1f"), false);
  assert.equal(calls.length, 1);
  const syntax = await session.run("this is (invalid", () => {});
  assert.notEqual(syntax.code, 0);
  assert.equal((await session.run("printf recovered", () => {})).code, 0);
});

test("SSH supports interactive prompts and direct terminal replies", { timeout: 15000 }, async t => {
  const { session } = localShell(t);
  await session.connect("home", () => {});
  let replied = false;
  const result = await session.run('printf "Reply: "; read answer; printf "Received %s\\n" "$answer"', text => {
    if (!replied && text.includes("Reply:")) {
      replied = true;
      session.write("interactive answer\r");
    }
  });
  assert.equal(result.code, 0);
  assert.match(result.output, /Received interactive answer/);
  assert.equal(result.output.match(/interactive answer/g).length, 1, "terminal input must not echo into history");
});

test("Ctrl+] terminates an active command and disconnect is idempotent", { timeout: 15000 }, async t => {
  const { session } = localShell(t);
  await session.connect("home", () => {});
  const result = session.run('printf "waiting"; read answer', text => {
    if (text.includes("waiting")) setImmediate(() => session.write("\x1d"));
  });
  assert.match((await result).error, /disconnected by user/);
  assert.equal(session.terminal, null);
  session.disconnect();
  await assert.rejects(session.run("pwd", () => {}), /No SSH session/);
});

test("Ctrl+C interrupts the remote command and restores a usable shell", { timeout: 15000 }, async t => {
  const { session } = localShell(t);
  await session.connect("home", () => {});
  const result = await session.run('printf "waiting"; sleep 30', text => {
    if (text.includes("waiting")) setTimeout(() => session.write("\x03"), 100);
  });
  assert.notEqual(result.code, 0);
  const next = await session.run("printf recovered", () => {});
  assert.match(next.output, /recovered/);
});

test("SSH reports remote exit and can reconnect", { timeout: 15000 }, async t => {
  const { session } = localShell(t);
  await session.connect("home", () => {});
  const result = await session.run("printf goodbye; exit 7", () => {});
  assert.match(result.output, /goodbye/);
  assert.match(result.error, /exit 7/);
  assert.equal(session.terminal, null);
  assert.equal((await session.connect("other-host", () => {})).code, 0);
  await assert.rejects(session.connect("third-host", () => {}), /Already connected/);
});

test("SSH rejects option and shell injection in destinations", async () => {
  const session = new SshSession({ spawn() { throw new Error("Must not spawn"); } });
  await Promise.all(["-oProxyCommand=oops", "home;touch /tmp/oops", "home id", "user@host\nls", ""].map(
    target => assert.rejects(session.connect(target, () => {}), /Usage/),
  ));
});

test("SSH parses split completion markers and bounds captured output", async () => {
  const session = new SshSession();
  session.limit = 8;
  let visible = "";
  /**
   * @param {string} text - Visible terminal output.
   * @returns {void} Output recorded.
   */
  session.output = text => { visible += text; };
  const result = session.wait("token");
  session.receive("123456789\x1e");
  session.receive("tok");
  session.receive("en:1");
  session.receive("\x1f");
  const capture = await result;
  assert.equal(capture.output, "12345678");
  assert.equal(capture.code, 1);
  assert.equal(capture.truncated, true);
  assert.equal(visible, "123456789");
});

test("SSH connection deadline releases a pending handshake", async () => {
  const session = new SshSession();
  const result = await session.wait("token", 1);
  assert.match(result.error, /connection timed out/);
  assert.equal(session.pending, null);
});

test("terminal handoff keeps raw replies out of readline and restores chat input", { timeout: 15000 }, async t => {
  const moduleUrl = new URL("../src/core/TerminalInput.js", import.meta.url).href;
  const program = `
    import { TerminalInput } from ${JSON.stringify(moduleUrl)};
    const input = new TerminalInput();
    input.init();
    let received;
    const reply = new Promise(resolve => { received = resolve; });
    const session = { write(data) { received(data); }, resize() {} };
    const result = await input.withTerminal(session, async output => {
      output('SSH_READY');
      return reply;
    });
    process.stdout.write('SSH_DONE ' + JSON.stringify({
      received: result.includes('private-password'), queued: input.inputQueue.length
    }) + '\\n');
    const next = await input.requestInput('CHAT_READY');
    process.stdout.write('CHAT_RESULT ' + next + '\\n');
    input.close();
  `;
  const terminal = spawnPty(process.execPath, ["--input-type=module", "-e", program], {
    name: "xterm", cols: 80, rows: 24, cwd: process.cwd(), env: { ...process.env },
  });
  t.after(() => { try { terminal.kill(); } catch { /* Already exited. */ } });
  let output = "";
  let replied = false;
  let chatted = false;
  const closed = new Promise(resolve => { terminal.onExit(resolve); });
  terminal.onData(data => {
    output += data;
    if (!replied && output.includes("SSH_READY")) {
      replied = true;
      terminal.write("private-password\r");
    }
    if (!chatted && output.includes("CHAT_READY")) {
      chatted = true;
      terminal.write("back in chat\r");
    }
  });
  await closed;
  assert.match(output, /"received":true,"queued":0/);
  assert.doesNotMatch(output, /private-password/);
  assert.match(output, /CHAT_RESULT back in chat/);
});
