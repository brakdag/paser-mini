import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectDiagnostics, compareBaseline } from "../scripts/typecheck.js";

test("type control detects real regressions, multiplicity, changed expressions and resolved debt", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paser-types-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "jsconfig.json"), JSON.stringify({
    compilerOptions: { checkJs: true, noEmit: true, skipLibCheck: true, types: [], lib: ["es5"] },
    include: ["code.js"],
  }));
  const file = path.join(root, "code.js");
  const invalid = 'const value = "text"; value.toFixed();';
  fs.writeFileSync(file, invalid);
  const original = collectDiagnostics(root);
  assert.equal(original.length, 1);
  assert.equal(original[0].code, 2339);
  assert.deepEqual(compareBaseline(original, original), { added: [], removed: [] });
  fs.writeFileSync(file, `\n// moving lines keeps the reviewed expression\n${invalid}`);
  assert.deepEqual(collectDiagnostics(root), original);
  fs.writeFileSync(file, `${invalid}\nvalue.toFixed();`);
  assert.equal(compareBaseline(collectDiagnostics(root), original).added[0].count, 2);
  fs.writeFileSync(file, 'const value = "text"; value.otherMissingMethod();');
  const changed = compareBaseline(collectDiagnostics(root), original);
  assert.equal(changed.added.length, 1);
  assert.equal(changed.removed.length, 1);
  fs.writeFileSync(file, 'const value = "text"; value.toUpperCase();');
  assert.deepEqual(compareBaseline(collectDiagnostics(root), original), { added: [], removed: original });
});

test("type control never baselines syntax, configuration or missing module errors", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paser-types-invalid-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = path.join(root, "jsconfig.json");
  const file = path.join(root, "code.js");
  fs.writeFileSync(config, JSON.stringify({ compilerOptions: { checkJs: true, noEmit: true, types: [], lib: ["es5"] }, include: ["code.js"] }));
  fs.writeFileSync(file, "const incomplete =");
  assert.throws(() => collectDiagnostics(root), /TS\d+/);
  fs.writeFileSync(file, 'import missing from "./missing.js"; console.log(missing);');
  assert.throws(() => collectDiagnostics(root), /TS2307/);
  fs.writeFileSync(config, "{invalid");
  assert.throws(() => collectDiagnostics(root));
});
