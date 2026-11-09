import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import JsonTools from "../src/tools/jsonTools.js";

test("JSON tools read nested nodes and describe objects and arrays", async (t) => {
  const dir = await fs.mkdtemp(path.join(process.cwd(), "tests/tmp-json-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "data.json");
  const data = { users: [{ name: "Ana", active: false }], empty: [] };
  await fs.writeFile(file, JSON.stringify(data));
  const tools = new JsonTools();
  assert.deepEqual(JSON.parse(await tools.getJsonNode(file, "")), data);
  assert.equal(JSON.parse(await tools.getJsonNode(file, "users(0).name")), "Ana");
  assert.equal(JSON.parse(await tools.getJsonNode(file, "users.0.active")), false);
  assert.deepEqual(JSON.parse(await tools.getJsonStructure(file, "users.0")), {
    type: "object", keys: ["name", "active"],
  });
  assert.deepEqual(JSON.parse(await tools.getJsonArrayInfo(file, "users")), {
    length: 1, itemType: "object",
  });
  assert.deepEqual(JSON.parse(await tools.getJsonStructure(file, "empty")), {
    type: "array", length: 0, itemType: "unknown",
  });
});

test("JSON updates persist nested values and reject missing intermediate paths", async (t) => {
  const dir = await fs.mkdtemp(path.join(process.cwd(), "tests/tmp-json-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "data.json");
  await fs.writeFile(file, JSON.stringify({ users: [{ name: "Ana" }] }));
  const tools = new JsonTools();
  await tools.updateJsonNode(file, "users(0).name", "José");
  await tools.updateJsonNode(file, "users.0.active", false);
  assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), {
    users: [{ name: "José", active: false }],
  });
  const before = await fs.readFile(file, "utf8");
  await assert.rejects(tools.updateJsonNode(file, "missing.child", 1), /not found/);
  assert.equal(await fs.readFile(file, "utf8"), before);
  await assert.rejects(tools.getJsonNode(file, "users.9"), /not found/);
  await assert.rejects(tools.getJsonArrayInfo(file, "users.0"), /not point to an array/);
  await tools.updateJsonNode(file, "", [1, null]);
  assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), [1, null]);
});

test("JSON tools propagate malformed JSON and missing file errors", async (t) => {
  const dir = await fs.mkdtemp(path.join(process.cwd(), "tests/tmp-json-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "invalid.json");
  await fs.writeFile(file, "{invalid");
  const tools = new JsonTools();
  await assert.rejects(tools.getJsonNode(file, ""), SyntaxError);
  await assert.rejects(tools.updateJsonNode(file, "key", 1), SyntaxError);
  assert.equal(await fs.readFile(file, "utf8"), "{invalid");
  await assert.rejects(tools.getJsonNode(path.join(dir, "missing.json"), ""), { code: "ENOENT" });
});
