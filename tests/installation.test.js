import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

["24", "26", "25"].forEach(major => {
  test(`installer checks Node ${major} and uses locked dependencies with a portable launcher`, async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paser-install-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const project = path.join(root, "project with spaces");
    const home = path.join(root, "home");
    const fakeBin = path.join(root, "fake-bin");
    await Promise.all([project, home, fakeBin].map(dir => fs.mkdir(dir)));
    await fs.copyFile(new URL("../install.sh", import.meta.url), path.join(project, "install.sh"));
    await fs.writeFile(path.join(project, "package.json"), "{}");
    const calls = path.join(root, "calls.txt");
    await fs.writeFile(path.join(fakeBin, "npm"), '#!/bin/sh\nprintf "npm:%s\\n" "$*" >> "$PASER_TEST_CALLS"\n', { mode: 0o700 });
    await fs.writeFile(path.join(fakeBin, "node"), `#!/bin/sh
if [ "$1" = "-p" ]; then
  printf '%s\\n' "$PASER_TEST_MAJOR"
else
  printf 'cwd:%s\\n' "$PWD" >> "$PASER_TEST_CALLS"
  printf 'arg:%s\\n' "$@" >> "$PASER_TEST_CALLS"
fi
`, { mode: 0o700 });
    const env = {
      PATH: `${fakeBin}:${process.env.PATH}`, HOME: home,
      PASER_TEST_CALLS: calls, PASER_TEST_MAJOR: major,
    };
    if (major === "25") {
      await assert.rejects(run("bash", ["install.sh"], { cwd: project, env }), {
        code: 1, stdout: /Node 24.x or 26.x is required/,
      });
      await assert.rejects(fs.access(calls));
      return;
    }
    await run("bash", ["install.sh"], { cwd: project, env });
    assert.equal(await fs.readFile(calls, "utf8"), "npm:ci --ignore-scripts\n");
    const launcher = path.join(home, ".local/bin/paser-mini");
    assert.equal(await fs.realpath(launcher), path.join(project, "bin/paser-mini"));
    await run(launcher, ["--message", "a message with spaces"], { cwd: root, env });
    const output = await fs.readFile(calls, "utf8");
    assert.ok(output.includes(`cwd:${root}\n`));
    assert.ok(output.includes(`arg:${project}/src/main.js\narg:--message\narg:a message with spaces\n`));
  });
});

test("npm exposes the canonical command and the established underscore alias", async () => {
  const manifest = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.bin["paser-mini"], "src/main.js");
  assert.equal(manifest.bin.paser_mini, manifest.bin["paser-mini"]);
});
