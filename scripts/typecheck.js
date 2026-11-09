import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Checks every configured JS file and groups diagnostics independently of line numbers.
 * @param {string} root - Project containing jsconfig.json.
 * @returns {Array<{file: string, code: number, message: string, source: string, count: number}>} Diagnostic inventory.
 */
export function collectDiagnostics(root) {
  const configPath = path.join(root, "jsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const fatal = [...parsed.errors, ...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics(), ...program.getSyntacticDiagnostics()];
  if (fatal.length) throw new Error(ts.formatDiagnostics(fatal, ts.createCompilerHost(parsed.options)));
  const diagnostics = program.getSemanticDiagnostics();
  const groups = new Map();
  diagnostics.forEach((diagnostic) => {
    const file = diagnostic.file ? path.relative(root, diagnostic.file.fileName).replaceAll(path.sep, "/") : "<config>";
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n").replaceAll(root, "<root>");
    // Configuration, syntax and missing dependencies are never accepted as debt.
    if (!diagnostic.file || diagnostic.code === 2307 || file.startsWith("../")) {
      throw new Error(`${file}: TS${diagnostic.code}: ${message}`);
    }
    const entry = {
      file, code: diagnostic.code, message,
      source: diagnostic.file.text.slice(diagnostic.start, diagnostic.start + diagnostic.length),
    };
    const key = JSON.stringify(entry);
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { ...entry, count: 1 });
  });
  return [...groups.keys()].sort().map(key => groups.get(key));
}

/**
 * Compares the exact reviewed inventory, including multiplicity and source expression.
 * @param {object[]} actual - Current diagnostics.
 * @param {object[]} expected - Reviewed diagnostics.
 * @returns {{added: object[], removed: object[]}} Changes requiring review.
 */
export function compareBaseline(actual, expected) {
  const actualKeys = new Set(actual.map(entry => JSON.stringify(entry)));
  const expectedKeys = new Set(expected.map(entry => JSON.stringify(entry)));
  return {
    added: actual.filter(entry => !expectedKeys.has(JSON.stringify(entry))),
    removed: expected.filter(entry => !actualKeys.has(JSON.stringify(entry))),
  };
}

/**
 * Runs the ratchet; baseline updates are explicit and require diff review.
 */
function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== "--write-baseline")) throw new Error("Usage: node scripts/typecheck.js [--write-baseline]");
  const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/u, "");
  const baselinePath = path.join(root, "typecheck-baseline.json");
  const diagnostics = collectDiagnostics(root);
  if (args.includes("--write-baseline")) {
    fs.writeFileSync(baselinePath, `${JSON.stringify({ typescript: ts.version, diagnostics }, null, 2)}\n`);
    console.log("Baseline written. Review every change before committing.");
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  if (baseline.typescript !== ts.version) throw new Error("TypeScript version changed; review the baseline with the new compiler.");
  const { added, removed } = compareBaseline(diagnostics, baseline.diagnostics);
  if (added.length || removed.length) {
    added.forEach(entry => console.error(`NEW ${entry.file} TS${entry.code} (${entry.count}): ${entry.message}`));
    removed.forEach(entry => console.error(`RESOLVED/CHANGED ${entry.file} TS${entry.code} (${entry.count}): ${entry.message}`));
    process.exitCode = 1;
  } else {
    console.log(`Types: no new diagnostics; ${diagnostics.reduce((sum, entry) => sum + entry.count, 0)} reviewed existing diagnostics. See docs/typechecking.md.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
