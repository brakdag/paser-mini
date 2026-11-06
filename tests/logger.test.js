import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const loggerUrl = new URL("../src/core/logger.js", import.meta.url).href;

/**
 * Runs the real singleton in an isolated project and waits for stream flushing.
 * @param {string} cwd - Temporary project directory.
 * @param {string} level - Diagnostic level.
 * @param {string} code - Actions after import.
 * @returns {object} Child process result.
 */
function run(cwd, level, code = "") {
  const env = { ...process.env, PASER_MINI_LOG_LEVEL: level };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import logger from ${JSON.stringify(loggerUrl)}; ${code}; logger.shutdownStreams();`],
  { cwd, env, encoding: "utf8", timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

/**
 * Creates a temporary project with automatic cleanup.
 * @param {object} t - Test context.
 * @returns {Promise<string>} Project directory.
 */
async function project(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paser-logger-"));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await fs.mkdir(path.join(cwd, ".paser-mini/log"), { recursive: true });
  return cwd;
}

test("default off preserves session events and does not create diagnostics", async (t) => {
  const cwd = await project(t);
  run(cwd, "", `logger.info(() => { throw Error('must not evaluate'); });
    logger.writeRawToSession('tool event'); logger.setAgentNickname('model'); logger.sessionLog('thought');`);
  const dir = path.join(cwd, ".paser-mini/log");
  assert.deepEqual(await fs.readdir(dir), ["session.log"]);
  const session = await fs.readFile(path.join(dir, "session.log"), "utf8");
  assert.match(session, /--- Session Started: .* ---\n/);
  assert.match(session, /tool event\n/);
  assert.match(session, /\[\d\d:\d\d\] <model> \* thought: thought\n/);
});

test("off and invalid levels leave existing technical and context files intact", async (t) => {
  const cwd = await project(t);
  const dir = path.join(cwd, ".paser-mini/log");
  await fs.writeFile(path.join(dir, "paser_mini.log"), "old diagnostics");
  await fs.writeFile(path.join(dir, "session.log"), "previous context\n");
  await fs.writeFile(path.join(dir, "memento.log"), "memory");
  ["off", "invalid"].forEach((level) => run(cwd, level, "logger.error('ignored'); logger.writeRawToSession('new event')"));
  assert.equal(await fs.readFile(path.join(dir, "paser_mini.log"), "utf8"), "old diagnostics");
  assert.equal(await fs.readFile(path.join(dir, "memento.log"), "utf8"), "memory");
  assert.match(await fs.readFile(path.join(dir, "session.log"), "utf8"), /^previous context\n/);
});

test("explicit levels filter before serialization and debug remains available", async (t) => {
  const cwd = await project(t);
  run(cwd, "warn", `logger.info('hidden', {toJSON() {throw Error('filtered');}});
    logger.warn('warning'); logger.error('failure'); logger.debug('hidden debug');`);
  run(cwd, "debug", "logger.debug('debug enabled')");
  const content = await fs.readFile(path.join(cwd, ".paser-mini/log/paser_mini.log"), "utf8");
  assert.match(content, /warning/);
  assert.match(content, /failure/);
  assert.match(content, /debug enabled/);
  assert.doesNotMatch(content, /hidden/);
});

test("rotation bounds files and entries and reclaims oversized legacy diagnostics", async (t) => {
  const cwd = await project(t);
  const dir = path.join(cwd, ".paser-mini/log");
  await fs.writeFile(path.join(dir, "paser_mini.log"), "x".repeat(2 * 1024 * 1024));
  await fs.writeFile(path.join(dir, "paser_mini.log.1"), "x".repeat(2 * 1024 * 1024));
  await fs.writeFile(path.join(dir, "session.log"), "context sentinel\n");
  run(cwd, "debug", `for (let i = 0; i < 300; i += 1) logger.debug('á'.repeat(20000));`);
  const files = (await fs.readdir(dir)).filter((name) => name.startsWith("paser_mini.log"));
  assert.equal(files.length, 3);
  const sizes = await Promise.all(files.map(async (name) => (await fs.stat(path.join(dir, name))).size));
  assert.ok(sizes.every((size) => size <= 1024 * 1024));
  const content = await fs.readFile(path.join(dir, "paser_mini.log"), "utf8");
  assert.match(content, /\[truncated\]/);
  assert.doesNotMatch(content, /\uFFFD/);
  assert.ok(content.split("\n").every((line) => Buffer.byteLength(line) < 16 * 1024));
  assert.match(await fs.readFile(path.join(dir, "session.log"), "utf8"), /^context sentinel\n/);
  run(cwd, "info", "logger.info('after restart')");
  assert.match(await fs.readFile(path.join(dir, "paser_mini.log"), "utf8"), /after restart/);
});

test("technical I/O failure warns once and session continues", async (t) => {
  const cwd = await project(t);
  const dir = path.join(cwd, ".paser-mini/log");
  await fs.mkdir(path.join(dir, "paser_mini.log"));
  const result = run(cwd, "debug", "logger.error('one'); logger.error('two'); logger.writeRawToSession('saved')");
  assert.equal(result.stderr.match(/Technical logging disabled/g)?.length, 1);
  assert.match(await fs.readFile(path.join(dir, "session.log"), "utf8"), /saved\n/);
  assert.ok(!(await fs.readdir(dir)).includes("paser_mini.log.lock"));
});

test("rotation lock contention drops diagnostics without affecting session", async (t) => {
  const cwd = await project(t);
  const dir = path.join(cwd, ".paser-mini/log");
  await fs.writeFile(path.join(dir, "paser_mini.log.lock"), "");
  run(cwd, "debug", "logger.debug('contended'); logger.writeRawToSession('saved')");
  assert.ok(!(await fs.readdir(dir)).includes("paser_mini.log"));
  assert.match(await fs.readFile(path.join(dir, "session.log"), "utf8"), /saved\n/);
});
