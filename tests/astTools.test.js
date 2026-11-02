import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { AstTools } from "../src/tools/astTools.js";

describe("astTools", () => {
  let testDir;
  let testFile;

  before(async () => {
    // Unique directory per run: a fixed name would collide under parallel runs.
    testDir = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-ast-"));
    testFile = path.join(testDir, "test.js");
    await fs.writeFile(testFile, "const x = 1; function foo() {}");
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should throw on missing query", async () => {
    const astTools = new AstTools();
    await assert.rejects(
      async () => astTools.analyze(testFile),
      /Query parameter is required/,
    );
  });

  it("should find identifiers using tokenizer fast path", async () => {
    const astTools = new AstTools();
    const result = JSON.parse(await astTools.analyze(testFile, "Identifier"));
    assert.strictEqual(result.strategy, "tokenizer_fast_path");
    assert.ok(result.results.some((r) => r.name === "x"));
    assert.ok(result.results.some((r) => r.name === "foo"));
  });

  it("should find literals using tokenizer fast path", async () => {
    const astTools = new AstTools();
    const result = JSON.parse(await astTools.analyze(testFile, "Literal"));
    assert.strictEqual(result.strategy, "tokenizer_fast_path");
    assert.ok(result.count >= 1);
    assert.ok(result.results.some((r) => r.value === 1));
  });

  it("should use AST slow path for complex queries", async () => {
    const astTools = new AstTools();
    const result = JSON.parse(await astTools.analyze(testFile, "FunctionDeclaration"));
    assert.strictEqual(result.strategy, "ast_slow_path");
    assert.ok(result.count >= 1);
  });
});
