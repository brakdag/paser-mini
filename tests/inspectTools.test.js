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

it("close resolves pending prompt polling and handles asynchronous spawn failure", async () => {
  const { EventEmitter } = await import("node:events");
  const { PassThrough } = await import("node:stream");
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(),
    kill() { return true; },
  });
  const inspector = new InspectTools({ spawnProcess() { return child; } });
  const pending = inspector.inspect("src/main.js");
  await new Promise(resolve => { setImmediate(resolve); });
  child.emit("error", new Error("spawn fixture"));
  assert.match(await pending, /Process exited during startup.*spawn fixture/s);
  await inspector.close();
  await inspector.close();
});
