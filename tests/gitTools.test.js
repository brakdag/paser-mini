import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import { GitTools } from "../src/tools/gitTools.js";

const gitTools = new GitTools();

describe("gitTools", () => {
  it("should run git diff", async () => {
    const result = await gitTools.gitDiffAll();
    assert.ok(typeof result === "string");
  });

  it("should apply a git patch to create a new file", async () => {
    const patchContent = `diff --git a/tests/patch_test_new_file.txt b/tests/patch_test_new_file.txt
new file mode 100644
index 0000000..f7db191
--- /dev/null
+++ b/tests/patch_test_new_file.txt
@@ -0,0 +1 @@
+Patch applied successfully!
`;
    
    const testFilePath = "./tests/patch_test_new_file.txt";
    try {
      await fs.unlink(testFilePath);
    } catch (e) {}

    try {
      const result = await gitTools.applyPatch({ patch: patchContent });
      assert.ok(result);
      
      const fileContent = await fs.readFile(testFilePath, "utf8");
      assert.strictEqual(fileContent.trim(), "Patch applied successfully!");
    } finally {
      try {
        await fs.unlink(testFilePath);
      } catch (e) {}
    }
  });
});
