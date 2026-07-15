import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { AstTools } from "../src/tools/astTools.js";

const astTools = new AstTools();
const testDir = path.resolve(process.cwd(), "tests/temp_ast");
const testFile = path.join(testDir, "test.js");

describe("astTools", () => {
  before(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, "const x = 1; function foo() {}");
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should throw on missing query", async () => {
    await assert.rejects(
      async () => astTools.analyze(testFile),
      /Query parameter is required/,
    );
  });

  it("should find identifiers using tokenizer fast path", async () => {
    const result = JSON.parse(await astTools.analyze(testFile, "Identifier"));
    assert.strictEqual(result.strategy, "tokenizer_fast_path");
    assert.ok(result.count >= 2);
    assert.ok(result.results.some((r) => r.name === "x"));
    assert.ok(result.results.some((r) => r.name === "foo"));
  });

  it("should find literals using tokenizer fast path", async () => {
    const result = JSON.parse(await astTools.analyze(testFile, "Literal"));
    assert.strictEqual(result.strategy, "tokenizer_fast_path");
    assert.ok(result.count >= 1);
    assert.ok(result.results.some((r) => r.value === 1));
  });

  it("should use AST slow path for complex queries", async () => {
    const result = JSON.parse(await astTools.analyze(testFile, "FunctionDeclaration"));
    assert.strictEqual(result.strategy, "ast_slow_path");
    assert.ok(result.count >= 1);
  });
});
