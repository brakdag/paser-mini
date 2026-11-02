import { describe, it } from "node:test";
import assert from "node:assert";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
  path.resolve(here, "..", "src", "tools", "evalTools.js"),
).href;

/**
 * Runs a snippet in a fresh Node process with no other active handles.
 * @param {string} source - Module source executed as an ES module.
 * @returns {Promise<{code: number, stdout: string, stderr: string}>} Outcome.
 */
async function runIsolated(source) {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  // Unique directory per call: Date.now() alone can collide between
  // concurrent runs that start in the same millisecond.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paser-deadline-"));
  const script = path.join(dir, "probe.mjs");
  await fs.writeFile(script, source, "utf8");
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [script], {
      timeout: 30000,
    });
    // Normalize the success shape: promisified execFile resolves with
    // { stdout, stderr } only, so a caller checking `code` would compare
    // undefined against 0 and fail even though the child exited cleanly.
    return { code: 0, stdout, stderr };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout,
      stderr: error.stderr,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("evalTools async deadline in an isolated process", () => {
  it("reaches the timeout handler with no unrelated active handles", async () => {
    // No servers, no intervals, nothing else referenced: an unref'd timer
    // would let the process exit before the deadline without settling.
    // Synchronous output keeps the observation independent of async pipe writes.
    const source = `
import { writeSync } from "node:fs";
import EvalTools from ${JSON.stringify(moduleUrl)};

const started = Date.now();
try {
  await new EvalTools().executeJS("await new Promise(() => {});");
  writeSync(1, "UNEXPECTED_SUCCESS\\n");
} catch (error) {
  writeSync(1, "CAUGHT:" + error.message.split(":")[0] + "\\n");
  writeSync(1, "ELAPSED_OK:" + (Date.now() - started >= 4000) + "\\n");
}
`;
    const result = await runIsolated(source);

    assert.strictEqual(result.code, 0, `process exits normally: ${result.stderr}`);
    assert.match(result.stdout, /CAUGHT:ASYNC_TIMEOUT/);
    assert.match(result.stdout, /ELAPSED_OK:true/);
    assert.doesNotMatch(result.stdout, /UNEXPECTED_SUCCESS/);
  });
});
