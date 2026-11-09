import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const source = fileURLToPath(new URL("../", import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "paser-tests-"));
const project = path.join(temporary, "project");
const home = path.join(temporary, "home");
fs.mkdirSync(project);
fs.mkdirSync(home);

try {
  const excluded = new Set([".paser-mini", ".git", ".codex", ".agents", ".aws", ".env"]);
  /**
   * Excludes application state and leftover test fixtures from the disposable copy.
   * @param {string} entry - Source file or directory.
   * @returns {boolean} Whether the entry belongs in the test project.
   */
  const filter = entry => !excluded.has(path.basename(entry)) && !path.basename(entry).startsWith("tmp-");
  ["src", "tests", "scripts", "package.json", "install.sh", "jsconfig.json", "eslint.config.js", "typecheck-baseline.json"].forEach((name) => {
    fs.cpSync(path.join(source, name), path.join(project, name), {
      recursive: true,
      filter,
    });
  });
  fs.symlinkSync(path.join(source, "node_modules"), path.join(project, "node_modules"), "dir");
  /** @type {Record<string, string|undefined>} */
  const env = { HOME: home, PASER_MINI_LOG_LEVEL: "off" };
  ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "TERM", "CI", "NO_COLOR", "FORCE_COLOR"].forEach((name) => {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  });
  console.log(`Isolated test project: ${project}`);
  const child = spawn(process.execPath, ["--test", "--test-isolation=none", "--test-timeout=60000", "tests/**/*.test.js"], {
    cwd: project, env, stdio: "inherit", timeout: 180000, killSignal: "SIGKILL",
  });
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  if (result.signal) console.error(`Test process terminated by ${result.signal}.`);
  process.exitCode = result.code ?? 1;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
