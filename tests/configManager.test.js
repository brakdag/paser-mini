import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import ConfigManager from "../src/core/configManager.js";

/**
 * Creates isolated global and project configuration directories.
 * @param {object} t Test context used for cleanup.
 * @returns {object} Paths and construction options.
 */
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paser-config-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { globalDir: path.join(root, "global"), localDir: path.join(root, "local") };
  fs.mkdirSync(options.globalDir);
  fs.mkdirSync(options.localDir);
  return {
    ...options,
    globalPath: path.join(options.globalDir, "config.json"),
    localPath: path.join(options.localDir, "config.json"),
  };
}

test("config reads and saves the correct layer, preserving temporary values", (t) => {
  const options = fixture(t);
  fs.writeFileSync(options.globalPath, JSON.stringify({ fallback: "global" }));
  const manager = new ConfigManager(options);
  assert.equal(manager.get("missing", "default"), "default");
  assert.equal(manager.get("fallback"), "global");
  assert.equal(fs.existsSync(options.localPath), false);
  manager.setTemporary("execute_enabled", false);
  assert.equal(fs.existsSync(options.localPath), false);
  manager.save("model_name", "local-model");
  manager.save("favorites", [{ model: "favorite" }]);
  assert.deepEqual(JSON.parse(fs.readFileSync(options.localPath)), {
    execute_enabled: false, model_name: "local-model",
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(options.globalPath)), {
    fallback: "global", favorites: [{ model: "favorite" }],
  });
  assert.equal(fs.statSync(options.localPath).mode % 0o1000, 0o600);
});

test("config replacement exposes the old complete JSON until rename and keeps permissions", (t) => {
  const options = fixture(t);
  const original = '{"model_name":"old"}\n';
  fs.writeFileSync(options.localPath, original, { mode: 0o640 });
  let replacements = 0;
  const fileSystem = {
    ...fs,
    renameSync(source, target) {
      assert.equal(fs.readFileSync(target, "utf8"), original);
      assert.equal(JSON.parse(fs.readFileSync(source)).model_name, "new");
      assert.equal(path.dirname(source), path.dirname(target));
      replacements += 1;
      fs.renameSync(source, target);
    },
  };
  const manager = new ConfigManager({ ...options, fileSystem });
  manager.save("model_name", "new");
  assert.equal(replacements, 1);
  assert.equal(manager.get("model_name"), "new");
  assert.equal(fs.statSync(options.localPath).mode % 0o1000, 0o640);
  assert.deepEqual(fs.readdirSync(options.localDir), ["config.json"]);
});

["writeFileSync", "fsyncSync", "renameSync"].forEach((method) => {
  test(`config preserves disk and memory and removes temporary files after ${method} fails`, (t) => {
    const options = fixture(t);
    const original = '{"model_name":"old"}\n';
    fs.writeFileSync(options.localPath, original);
    let fail = true;
    const failure = Object.assign(new Error("simulated disk failure"), { code: "ENOSPC" });
    const fileSystem = {
      ...fs,
      [method](...args) {
        if (fail) {
          if (method === "writeFileSync") fs.writeFileSync(args[0], "{partial");
          throw failure;
        }
        return fs[method](...args);
      },
    };
    const manager = new ConfigManager({ ...options, fileSystem });
    assert.throws(() => manager.save("model_name", "new"), (error) => error === failure);
    assert.equal(fs.readFileSync(options.localPath, "utf8"), original);
    assert.equal(manager.get("model_name"), "old");
    assert.deepEqual(fs.readdirSync(options.localDir), ["config.json"]);
    fail = false;
    manager.save("model_name", "recovered");
    assert.equal(JSON.parse(fs.readFileSync(options.localPath)).model_name, "recovered");
  });
});

test("config rejects unserializable values without changing disk or memory", (t) => {
  const options = fixture(t);
  const manager = new ConfigManager(options);
  assert.throws(() => manager.save("bad", 1n), TypeError);
  assert.equal(manager.get("bad"), null);
  assert.deepEqual(fs.readdirSync(options.localDir), []);
});

test("invalid JSON and non-object roots are rejected in either layer without migration", (t) => {
  ["{broken", "null", "[]", "42", '"text"'].forEach((invalid) => {
    ["globalPath", "localPath"].forEach((layer) => {
      const options = fixture(t);
      fs.writeFileSync(options.globalPath, '{"keep":"global"}');
      fs.writeFileSync(options.localPath, '{"favorites":["legacy"],"keep":"local"}');
      fs.writeFileSync(options[layer], invalid);
      const before = [fs.readFileSync(options.globalPath), fs.readFileSync(options.localPath)];
      assert.throws(() => new ConfigManager(options), (error) => error.message.includes(options[layer]));
      assert.deepEqual(fs.readFileSync(options.globalPath), before[0]);
      assert.deepEqual(fs.readFileSync(options.localPath), before[1]);
    });
  });
});

test("config propagates read errors instead of treating the file as empty", (t) => {
  const options = fixture(t);
  const failure = Object.assign(new Error("simulated read failure"), { code: "EACCES" });
  const fileSystem = { ...fs, readFileSync() { throw failure; } };
  assert.throws(() => new ConfigManager({ ...options, fileSystem }),
    (error) => error.cause === failure && error.message.includes(options.globalPath));
  assert.deepEqual(fs.readdirSync(options.globalDir), []);
});

["globalPath", "localPath"].forEach((failedLayer) => {
  test(`legacy migration preserves its source when replacing ${failedLayer} fails and can resume`, (t) => {
    const options = fixture(t);
    fs.writeFileSync(options.globalPath, '{"user_nickname":"global-name"}');
    const original = '{"favorites":["legacy"],"user_nickname":"local-name","model_name":"local"}';
    fs.writeFileSync(options.localPath, original);
    const failure = new Error("simulated rename failure");
    const fileSystem = {
      ...fs,
      renameSync(source, target) {
        if (target === options[failedLayer]) throw failure;
        fs.renameSync(source, target);
      },
    };
    const failed = new ConfigManager({ ...options, fileSystem });
    assert.throws(() => failed.migrateGlobalKeys(), (error) => error === failure);
    assert.equal(fs.readFileSync(options.localPath, "utf8"), original);
    const manager = new ConfigManager(options);
    assert.equal(manager.migrateGlobalKeys(), true);
    assert.deepEqual(manager.get("favorites"), ["legacy"]);
    assert.equal(manager.get("user_nickname"), "global-name");
    assert.deepEqual(JSON.parse(fs.readFileSync(options.localPath)), { model_name: "local" });
    assert.deepEqual(fs.readdirSync(options.localDir), ["config.json"]);
    assert.deepEqual(fs.readdirSync(options.globalDir), ["config.json"]);
    assert.equal(manager.migrateGlobalKeys(), false);
  });
});

test("saving through an existing config symlink preserves the link and updates its target", (t) => {
  const options = fixture(t);
  const target = path.join(options.globalDir, "linked.json");
  fs.writeFileSync(target, '{"model_name":"old"}', { mode: 0o600 });
  fs.symlinkSync(target, options.localPath);
  new ConfigManager(options).save("model_name", "new");
  assert.equal(fs.lstatSync(options.localPath).isSymbolicLink(), true);
  assert.equal(JSON.parse(fs.readFileSync(target)).model_name, "new");
  assert.equal(fs.statSync(target).mode % 0o1000, 0o600);
});

test("construction only reads legacy settings and migration is explicit and idempotent", (t) => {
  const options = fixture(t);
  const original = '{"favorites":["legacy"],"user_nickname":"local"}';
  fs.writeFileSync(options.localPath, original);
  const manager = new ConfigManager(options);
  assert.equal(fs.existsSync(options.globalPath), false);
  assert.equal(fs.readFileSync(options.localPath, "utf8"), original);
  assert.deepEqual(manager.get("favorites"), ["legacy"]);
  assert.equal(manager.get("user_nickname"), "local");
  assert.equal(manager.migrateGlobalKeys(), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(options.globalPath)), {
    favorites: ["legacy"], user_nickname: "local",
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(options.localPath)), {});
  assert.equal(manager.migrateGlobalKeys(), false);
});

test("construction does not create missing state directories", (t) => {
  const options = fixture(t);
  fs.rmdirSync(options.globalDir);
  fs.rmdirSync(options.localDir);
  const manager = new ConfigManager(options);
  assert.equal(manager.migrateGlobalKeys(), false);
  assert.equal(fs.existsSync(options.globalDir), false);
  assert.equal(fs.existsSync(options.localDir), false);
  manager.save("model_name", "new");
  assert.equal(JSON.parse(fs.readFileSync(options.localPath)).model_name, "new");
  assert.equal(fs.existsSync(options.globalDir), false);
});

test("CLI reports invalid configuration even when diagnostics are off", async (t) => {
  const options = fixture(t);
  const configDir = path.join(options.globalDir, ".paser-mini");
  fs.mkdirSync(configDir);
  const configPath = path.join(configDir, "config.json");
  const original = '{"private-value":"do-not-print",broken';
  fs.writeFileSync(configPath, original);
  const env = { ...process.env, HOME: options.globalDir, PASER_MINI_LOG_LEVEL: "off" };
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [fileURLToPath(new URL("../src/main.js", import.meta.url)), "-nsi"], {
    cwd: options.localDir,
    env,
    timeout: 10000,
  });
  let stderr = "";
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  assert.deepEqual(result, { code: 1, signal: null }, JSON.stringify({ stderr, stdout }));
  assert.ok(stderr.includes(`Invalid JSON configuration: ${configPath}`), JSON.stringify({ stderr, stdout }));
  assert.equal(stderr.includes("do-not-print"), false);
  assert.equal(fs.readFileSync(configPath, "utf8"), original);
});
