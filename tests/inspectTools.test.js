import { describe, it } from "node:test";
import assert from "node:assert";
import InspectTools from "../src/tools/inspectTools.js";

describe("inspectTools", () => {
  it("should throw if no session is active and no path provided", async () => {
    const inspectTools = new InspectTools();
    await assert.rejects(
      async () => inspectTools.inspect(),
      /Either 'path' to start or 'command' to interact must be provided/,
    );
  });
});
