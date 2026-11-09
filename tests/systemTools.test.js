import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { SystemTools } from "../src/tools/systemTools.js";

const systemTools = new SystemTools();
const require = createRequire(import.meta.url);

/**
 * Creates a unique source fixture inside the test project's path policy.
 * @param {import('node:test').TestContext} t - Cleanup owner.
 * @returns {Promise<{root: string, file: string}>} Source paths.
 */
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(process.cwd(), "tests", "tmp-system-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "code.js");
  await fs.writeFile(file, "/** Returns a number.\n * @returns {number} A constant.\n */\nexport function value() { return 1; }\n");
  return { root, file };
}

describe("systemTools", () => {
  it("should execute a simple bash command", async () => {
    const result = await systemTools.execute("echo hello");
    assert.strictEqual(result.trim(), "hello");
  });

  it("runs JS analysis, lint and docs through declared local CLIs without npx", async (t) => {
    const { root, file } = await fixture(t);
    const calls = [];
    /**
     * Captures the subprocess call.
     * @param {...unknown} args - Executable, arguments and options.
     * @returns {Promise<{stdout: string}>} Empty successful output.
     */
    const execFileRunner = async (...args) => { calls.push(args); return { stdout: "" }; };
    const tools = new SystemTools({ execFileRunner });
    assert.strictEqual(await tools.analyzeCode(file), "No type or syntax errors found.");
    assert.strictEqual(await tools.lintCode(file), "No linting issues found.");
    const output = path.join(root, "docs");
    assert.match(await tools.generateDocs({ path: file, outputDir: output }), /successfully generated/);
    ["typescript", "eslint", "jsdoc"].forEach((name, index) => {
      assert.strictEqual(calls[index][0], process.execPath);
      const packageDir = path.dirname(require.resolve(`${name}/package.json`));
      assert.ok(calls[index][1][0].startsWith(`${packageDir}${path.sep}`));
      assert.strictEqual(calls[index][2].timeout, 60000);
      assert.strictEqual(calls[index][2].shell, undefined);
    });
    assert.ok(calls[0][1].includes("--checkJs"));
    assert.ok(calls[0][1].includes("--noEmit"));
    assert.strictEqual(calls[0][1].at(-1), file);
    assert.deepStrictEqual(calls[2][1].slice(1), [file, "-d", output]);
  });

  it("analyzes directories with an explicit local config and refuses directories without one", async (t) => {
    const { root } = await fixture(t);
    const received = [];
    /**
     * Captures compiler arguments.
     * @param {string} _command - Node executable.
     * @param {string[]} args - CLI arguments.
     * @returns {Promise<{stdout: string}>} Empty successful output.
     */
    const execFileRunner = async (_command, args) => { received.push(args); return { stdout: "" }; };
    const tools = new SystemTools({ execFileRunner });
    await assert.rejects(tools.analyzeCode(root), /must contain tsconfig.json or jsconfig.json/);
    await fs.writeFile(path.join(root, "jsconfig.json"), "{}");
    await tools.analyzeCode(root);
    assert.deepStrictEqual(received.at(-1).slice(-2), ["--project", path.join(root, "jsconfig.json")]);
    await fs.writeFile(path.join(root, "tsconfig.json"), "{}");
    await tools.analyzeCode(root);
    assert.strictEqual(received.at(-1).at(-1), path.join(root, "tsconfig.json"));
  });

  it("returns compiler diagnostics while propagating timeouts and tool startup failures", async (t) => {
    const { file } = await fixture(t);
    /** @type {Error & {code: string|number, stdout: string, killed?: boolean}} */
    let failure = Object.assign(new Error("compiler errors"), { code: 2, stdout: "error TS2322: wrong type" });
    /**
     * Simulates a failing subprocess.
     * @returns {Promise<never>} The selected failure.
     */
    const execFileRunner = async () => { throw failure; };
    const tools = new SystemTools({ execFileRunner });
    assert.match(await tools.analyzeCode(file), /TS2322/);
    await assert.rejects(tools.lintCode(file), /Linting error/);
    failure = Object.assign(new Error("lint findings"), { code: 1, stdout: "lint issue" });
    assert.strictEqual(await tools.lintCode(file), "lint issue");
    failure = Object.assign(new Error("deadline"), { code: 1, stdout: "partial", killed: true });
    await assert.rejects(tools.analyzeCode(file), /Analysis error: deadline/);
    await assert.rejects(tools.lintCode(file), /Linting error: deadline/);
    failure = Object.assign(new Error("missing executable"), { code: "ENOENT", stdout: "partial" });
    await assert.rejects(tools.analyzeCode(file), /missing executable/);
  });

  it("checks real JS types and generates HTML using the installed dependencies", async (t) => {
    const { root, file } = await fixture(t);
    assert.strictEqual(await systemTools.analyzeCode(file), "No type or syntax errors found.");
    await fs.writeFile(file, '/** @type {number} */\nconst value = "incorrect";\n');
    assert.match(await systemTools.analyzeCode(file), /TS2322/);
    await fs.writeFile(file, "/** A documented number. */\nconst value = 1;\n");
    const output = path.join(root, "real-docs");
    await systemTools.generateDocs(file, output);
    assert.match(await fs.readFile(path.join(output, "index.html"), "utf8"), /<html/);
    assert.deepStrictEqual((await fs.readdir(root)).sort(), ["code.js", "real-docs"]);
  });
});
