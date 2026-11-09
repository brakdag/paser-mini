import { contentBlocks, describeBlock } from "../infrastructure/contentBlocks.js";

/**
 * Normalizes tool returns while keeping remote metadata and local control actions separate.
 * @param {unknown} value - Raw tool return.
 * @param {boolean} [success] - Local execution status.
 * @returns {{kind: string, isError: boolean, content: Array<object>, metadata: object, action: object|null}} Tool result.
 */
export function normalizeToolResult(value, success = true) {
  /** @type {Record<string, unknown>} */
  const object = value && typeof value === "object" ? { ...value } : {};
  const action = typeof object.content === "string" && typeof object.type === "string" && ["FOUNTAIN_INJECTION", "QR_DISPLAY"].includes(object.type)
    ? { type: object.type, content: object.content } : null;
  const { content, isError, ...metadata } = object;
  let payload = value;
  if (value && typeof value === "object" && !Array.isArray(value) && !Array.isArray(content) && !("mime_type" in object)) {
    payload = JSON.stringify(value);
  }
  if (Array.isArray(content)) payload = content;
  if (action) payload = action.content;
  return {
    kind: "tool-result",
    isError: !success || isError === true,
    content: contentBlocks(payload),
    metadata: Array.isArray(content) ? structuredClone(metadata) : {},
    action,
  };
}

/**
 * Formats a terminal-safe textual view, leaving the original blocks intact.
 * @param {object} outcome - Normalized result.
 * @returns {string} Textual result.
 */
export function toolResultText(outcome) {
  return outcome.content.map(block => describeBlock(block, "terminal")).join("\n");
}

/**
 * Builds ordered model input with explicit status and lossless blocks per tool.
 * @param {Array} results - Executed results or parser errors.
 * @returns {string|Array<object>} Model input.
 */
export function toolResultsContent(results) {
  const blocks = results.flatMap(entry => {
    if (typeof entry === "string") return contentBlocks(entry);
    if (!entry.outcome) return contentBlocks(entry.result?.mime_type ? entry.result : entry.response);
    const { outcome } = entry;
    const metadata = Object.keys(outcome.metadata).length
      ? [{ type: "text", text: `[Tool metadata] ${JSON.stringify(outcome.metadata)}` }] : [];
    return [
      { type: "text", text: `[${entry.name || "tool"}] ${outcome.isError ? "✗ ERROR" : "✓ OK"}` },
      ...outcome.content,
      ...metadata,
    ];
  });
  return blocks.every(block => block.type === "text") ? blocks.map(block => block.text).join("\n\n") : blocks;
}
