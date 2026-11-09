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
      async () => Reflect.apply(astTools.analyze, astTools, [testFile]),
      /Query parameter is required/,
    );
  });

  it("finds identifier nodes in the parsed module", async () => {
    const astTools = new AstTools();
    const result = JSON.parse(await astTools.analyze(testFile, "Identifier"));
    assert.strictEqual(result.strategy, "ast_slow_path");
    assert.deepStrictEqual(result.results, [{ type: "Identifier", name: "x" }, { type: "Identifier", name: "foo" }]);
    assert.strictEqual(result.count, 2);
  });

  it("finds literal nodes in the parsed module", async () => {
    const astTools = new AstTools();
    const result = JSON.parse(await astTools.analyze(testFile, "Literal"));
    assert.strictEqual(result.strategy, "ast_slow_path");
    assert.deepStrictEqual(result.results, [{ type: "Literal", value: 1 }]);
    assert.strictEqual(result.count, 1);
  });

  it("should use AST slow path for complex queries", async () => {
    const astTools = new AstTools();
    const result = JSON.parse(await astTools.analyze(testFile, "FunctionDeclaration"));
    assert.strictEqual(result.strategy, "ast_slow_path");
    assert.deepStrictEqual(result.results, [{ type: "FunctionDeclaration", id: "foo" }]);
    assert.strictEqual(result.count, 1);
  });

  it("preserves boolean/null types and serializes regex and bigint literals", async () => {
    const file = path.join(testDir, "literals.js");
    await fs.writeFile(file, 'const values = [true, false, null, 3, "text", /a+/gi, 123n];');
    const result = JSON.parse(await new AstTools().analyze(file, "Literal"));
    assert.deepStrictEqual(result.results.map(r => r.value), [true, false, null, 3, "text", { pattern: "a+", flags: "gi" }, "123"]);
    assert.strictEqual(result.count, 7);
  });

  it("finds reserved property names as AST identifiers and excludes comment/string contents", async () => {
    const file = path.join(testDir, "identifiers.js");
    await fs.writeFile(file, 'const obj = {default: "fakeName"}; obj.default; // anotherFakeName');
    const result = JSON.parse(await new AstTools().analyze(file, "Identifier"));
    assert.deepStrictEqual(result.results.map(r => r.name), ["obj", "default", "obj", "default"]);
  });

  it("rejects incomplete syntax for every query even after the result limit is met", async () => {
    const file = path.join(testDir, "invalid.js");
    await fs.writeFile(file, "const first = true; const incomplete =");
    await Promise.all(["Identifier", "Literal", "VariableDeclaration"].map(async (query) => {
      await assert.rejects(new AstTools().analyze(file, query, 1), SyntaxError);
    }));
  });

  it("enforces the result limit and returns an empty result for unknown node types", async () => {
    const tools = new AstTools();
    const result = JSON.parse(await tools.analyze(testFile, "Identifier", 1));
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.limit, 1);
    assert.deepStrictEqual(result.results, [{ type: "Identifier", name: "x" }]);
    assert.deepStrictEqual(JSON.parse(await tools.analyze(testFile, "UnknownNode")).results, []);
    await Promise.all([0, -1, 1.5, NaN, Infinity, 10001].map(async (limit) => {
      await assert.rejects(tools.analyze(testFile, "Identifier", limit), /Limit must be/);
    }));
  });
});
