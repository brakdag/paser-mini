import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import PathValidator from "../src/utils/pathValidator.js";
import BinaryTools from "../src/tools/binaryTools.js";
import JsonTools from "../src/tools/jsonTools.js";
import PerfTools from "../src/tools/perfTools.js";
import { SystemTools } from "../src/tools/systemTools.js";
import EvalTools from "../src/tools/evalTools.js";
import LoadTools from "../src/tools/loadTools.js";

const execFileAsync = promisify(execFile);

/**
 * Creates a policy fixture and redirects default policy calls for this test.
 * @param {import('node:test').TestContext} t - Cleanup and mock owner.
 * @returns {Promise<object>} Isolated paths and policy.
 */
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "paser-consumers-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = path.join(base, "project");
  const outside = path.join(base, "outside");
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
  await fs.mkdir(outside);
  await fs.mkdir(path.join(outside, "deep"));
  await fs.writeFile(path.join(root, "source.txt"), "source");
  await fs.writeFile(path.join(outside, "secret.txt"), "external");
  await fs.writeFile(path.join(root, ".git", "config.json"), '{"value":"keep"}');
  await fs.symlink(outside, path.join(root, "escape"), "dir");
  await fs.symlink(path.join(outside, "deep"), path.join(root, "bridge"), "dir");
  await fs.symlink(".git", path.join(root, "metadata-alias"), "dir");
  const policy = new PathValidator({ root });
  t.mock.method(PathValidator, "getSafePath", policy.getSafePath.bind(policy));
  t.mock.method(PathValidator, "getSafeMutationPath", policy.getSafeMutationPath.bind(policy));
  t.mock.method(PathValidator, "getRoot", policy.getRoot.bind(policy));
  return { base, root, outside, policy };
}

describe("all file output tools use the mutation policy", () => {
  const outputs = [
    {
      name: "binary extraction",
      run(input) { return new BinaryTools().handleHexCommand("extract", "source.txt", 0, 3, undefined, "LE", { outputFile: input }); },
    },
    { name: "JSON update", run(input) { return new JsonTools().updateJsonNode(input, "value", "changed"); } },
    { name: "heap snapshot", run(input) { return new PerfTools().snapshot(input); } },
  ];

  outputs.forEach(({ name, run }) => {
    it(`${name} refuses protected destinations and aliases`, async (t) => {
      const { root } = await fixture(t);
      await assert.rejects(run(".git/config.json"), /protected metadata/);
      await assert.rejects(run("metadata-alias/config.json"), /protected metadata/);
      assert.equal(await fs.readFile(path.join(root, ".git", "config.json"), "utf8"), '{"value":"keep"}');
    });
  });

  it("documentation refuses protected output before mkdir or external execution", async (t) => {
    await fixture(t);
    t.mock.method(fs, "mkdir", async () => { throw new Error("must reject before creating output"); });
    const tools = new SystemTools();
    await assert.rejects(tools.generateDocs("source.txt", ".git"), /protected metadata/);
    await assert.rejects(tools.generateDocs("source.txt", "metadata-alias"), /protected metadata/);
  });
});

describe("index and BrowserFS share project containment", () => {
  it("BrowserFS rejects external symlinks and protects metadata while ordinary helpers work", async (t) => {
    const { root, outside, policy } = await fixture(t);
    const tools = new EvalTools({ pathValidator: policy });
    const inputs = [path.join(outside, "secret.txt"), "escape/secret.txt", "bridge/../secret.txt"];
    for (let i = 0; i < inputs.length; i += 1) {
      await assert.rejects(tools.executeJS(`return await BrowserFS.read(${JSON.stringify(inputs[i])});`), /SECURITY_ERR/);
    }
    await assert.rejects(tools.executeJS('await BrowserFS.write(".git/config.json", "changed");'), /protected metadata/);
    await assert.rejects(tools.executeJS('await BrowserFS.delete("metadata-alias/config.json");'), /protected metadata/);
    await tools.executeJS('await BrowserFS.write("ordinary.txt", "valid");');
    const result = JSON.parse(await tools.executeJS('return await BrowserFS.read("ordinary.txt");'));
    assert.equal(result.result, "valid");
    await tools.executeJS('await BrowserFS.delete("ordinary.txt");');
    await assert.rejects(fs.access(path.join(root, "ordinary.txt")), { code: "ENOENT" });
    assert.equal(await fs.readFile(path.join(outside, "secret.txt"), "utf8"), "external");
  });

  it("index refuses an external .gitignore symlink", async (t) => {
    const { root, outside, policy } = await fixture(t);
    await fs.symlink(path.join(outside, "secret.txt"), path.join(root, ".gitignore"));
    await assert.rejects(new LoadTools({ pathValidator: policy }).index(), /outside of project root/);
  });

  it("index preserves symlink/parent semantics and supports a symlinked root", async (t) => {
    const { base, root, policy } = await fixture(t);
    await fs.mkdir(path.join(root, "parent", "deep"), { recursive: true });
    await fs.writeFile(path.join(root, "parent", "value.txt"), "actual");
    await fs.symlink("parent/deep", path.join(root, "internal-bridge"), "dir");
    const tools = new LoadTools({ pathValidator: policy });
    const result = JSON.parse(await tools.index("internal-bridge/..", "txt"));
    assert.equal(result.total, 1);
    assert.equal(result.files[0].path, "parent/value.txt");
    assert.match(await tools.load(String(result.files[0].id)), /actual/);
    const alias = path.join(base, "alias");
    await fs.symlink(root, alias, "dir");
    const aliasTools = new LoadTools({ pathValidator: new PathValidator({ root: alias }) });
    const aliasResult = JSON.parse(await aliasTools.index("parent", "txt"));
    assert.equal(aliasResult.files[0].path, "parent/value.txt");
    assert.match(await aliasTools.load(String(aliasResult.files[0].id)), /actual/);
  });

  it("default roots stay fixed after chdir, and grep exits without a residual timer", async (t) => {
    const { root, outside } = await fixture(t);
    const searchUrl = new URL("../src/tools/searchTools.js", import.meta.url).href;
    const loadUrl = new URL("../src/tools/loadTools.js", import.meta.url).href;
    const evalUrl = new URL("../src/tools/evalTools.js", import.meta.url).href;
    const script = `
      import assert from "node:assert/strict";
      import { writeSync } from "node:fs";
      import SearchTools from ${JSON.stringify(searchUrl)};
      import LoadTools from ${JSON.stringify(loadUrl)};
      import EvalTools from ${JSON.stringify(evalUrl)};
      process.chdir(${JSON.stringify(outside)});
      const search = new SearchTools();
      assert.deepEqual(JSON.parse(await search.searchFilesPatternFixed("*.txt")).sort(), ["source.txt"]);
      const grep = JSON.parse(await search.searchText("source"));
      assert.deepEqual(grep, [{file:"source.txt",line:1,content:"source"}]);
      const load = new LoadTools();
      const index = JSON.parse(await load.index(".", "txt"));
      assert.deepEqual(index.files.map(f => f.path), ["source.txt"]);
      assert.match(await load.load(String(index.files[0].id)), /source/);
      const result = JSON.parse(await new EvalTools().executeJS('return await BrowserFS.read("source.txt");'));
      assert.equal(result.result, "source");
      writeSync(1, "stable-root-ok\\n");
    `;
    const { stdout } = await execFileAsync(process.execPath, ["--input-type=module", "-e", script], { cwd: root, timeout: 5000 });
    assert.equal(stdout.trim(), "stable-root-ok");
  });
});
