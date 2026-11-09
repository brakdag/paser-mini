import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRole, normalizeContent, countTokensHeuristic } from "../src/infrastructure/historyNormalizer.js";

test("history roles map identities and preserve API roles", () => {
  assert.equal(normalizeRole("Ana", "Ana", "Bot"), "user");
  assert.equal(normalizeRole("Bot", "Ana", "Bot"), "assistant");
  assert.equal(normalizeRole("model", "Ana", "Bot"), "assistant");
  assert.equal(normalizeRole("server", "Ana", "Bot"), "user");
  assert.equal(normalizeRole("system", "Ana", "Bot"), "system");
});

test("thought filtering removes assistant thoughts while preserving user source", () => {
  const source = "<thought>private reasoning</thought> Answer <THOUGHT>second</THOUGHT>";
  assert.equal(normalizeContent(source, "assistant"), "Answer");
  assert.equal(normalizeContent(source, "user"), source);
  assert.equal(normalizeContent("ordinary text", "assistant"), "ordinary text");
});

test("image normalization preserves MIME type, base64 data and resolution", () => {
  assert.deepEqual(normalizeContent({ mime_type: "image/png", data: "YWJj", resolution: "640x480" }, "user"), [
    { type: "text", text: "Image resolution: 640x480" },
    { type: "image_url", image_url: { url: "data:image/png;base64,YWJj" } },
  ]);
});

test("token estimate includes system text and supported message shapes", () => {
  assert.equal(countTokensHeuristic("abcd", [{ content: "efgh" }, { text: "ijkl" }], 4), 3);
  assert.equal(countTokensHeuristic("", [], 4), 0);
  assert.equal(countTokensHeuristic("a", [], 4), 1);
});
