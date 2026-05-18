import { describe, it } from "node:test";
import assert from "node:assert";
import { GitTools } from "../src/tools/gitTools.js";

const gitTools = new GitTools();

describe("gitTools", () => {
  it("should run git diff", async () => {
    const result = await gitTools.gitDiffAll();
    assert.ok(typeof result === "string");
  });
});
