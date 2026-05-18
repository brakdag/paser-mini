import { describe, it } from "node:test";
import assert from "node:assert";
import { DockerTools } from "../src/tools/dockerTools.js";

const dockerTools = new DockerTools();

describe("dockerTools", () => {
  it("should have a sh method", () => {
    assert.strictEqual(typeof dockerTools.sh, "function");
  });
});
