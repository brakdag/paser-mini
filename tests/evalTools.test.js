import { describe, it } from "node:test";
import assert from "node:assert";
import path from "node:path";
import EvalTools from "../src/tools/evalTools.js";

describe("evalTools", () => {
  it("should execute simple JS", async () => {
    const evalTools = new EvalTools();
    const result = await evalTools.executeJS("1 + 1");
    const output = JSON.parse(result);
    assert.strictEqual(output.result, 2);
  });

  it("should handle top-level await", async () => {
    const evalTools = new EvalTools();
    const code = "const res = await Promise.resolve(42); return res;";
    const result = await evalTools.executeJS(code);
    const output = JSON.parse(result);
    assert.strictEqual(output.result, 42);
  });

  it("rejects a sibling directory whose name prefixes the root", async () => {
    const evalTools = new EvalTools();
    const sibling = path.resolve(`${process.cwd()}-evil`, "x.txt");
    await assert.rejects(
      () => evalTools.executeJS(`await BrowserFS.read(${JSON.stringify(sibling)});`),
      /SECURITY_ERR/,
    );
  });

  it("rejects traversal above the root", async () => {
    const evalTools = new EvalTools();
    await assert.rejects(
      () => evalTools.executeJS('await BrowserFS.read("../../etc/passwd");'),
      /SECURITY_ERR/,
    );
  });

  it("terminates an await that never settles", async () => {
    const evalTools = new EvalTools();
    const started = Date.now();
    await assert.rejects(
      () => evalTools.executeJS("await new Promise(() => {});"),
      /ASYNC_TIMEOUT/,
    );
    // The deadline is 5s; the point is that it returns at all.
    assert.ok(Date.now() - started < 15000);
  });

  it("bounds synchronously blocking code", async () => {
    const evalTools = new EvalTools();
    await assert.rejects(
      () => evalTools.executeJS("while (true) {}"),
      /timed out|Script execution/i,
    );
  });
});
