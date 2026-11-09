/**
 * Converts legacy values and provider parts to ordered, lossless content blocks.
 * @param {unknown} value - Raw content.
 * @returns {Array<object>} Neutral content blocks.
 */
export function contentBlocks(value) {
  if (Array.isArray(value)) return value.flatMap(contentBlocks);
  if (typeof value === "string") return [{ type: "text", text: value }];
  if (value && typeof value === "object") {
    if ("mime_type" in value && "data" in value) {
      return [
        { type: "text", text: `Image resolution: ${("resolution" in value && value.resolution) || "unknown"}` },
        { type: "image", mimeType: value.mime_type, data: value.data },
      ];
    }
    if ("type" in value) return [structuredClone(value)];
  }
  return [{ type: "text", text: JSON.stringify(value) ?? "" }];
}

/**
 * Describes terminal or provider limitations without dumping binary data.
 * @param {object} block - Content block.
 * @param {string} target - Consumer name.
 * @returns {string} Explicit representation or explanation.
 */
export function describeBlock(block, target) {
  if (block.type === "text") return block.text;
  if (block.type === "resource" && typeof block.resource?.text === "string") {
    return `[Resource ${block.resource.uri || ""}]\n${block.resource.text}`;
  }
  if (block.type === "resource_link") return `[Resource link] ${JSON.stringify(block)}`;
  const metadata = { ...block };
  delete metadata.data;
  if (metadata.image_url) metadata.image_url = { ...metadata.image_url, url: "[image URL retained in history]" };
  if (metadata.resource?.blob) {
    metadata.resource = { ...metadata.resource, blob: "[binary retained in history]" };
  }
  return `[Unsupported content: ${block.type || "unknown"}; ${target} cannot send/render this block. Original data retained in history.] ${JSON.stringify(metadata)}`;
}

/**
 * Projects blocks at the provider boundary; unknown formats get an explicit explanation.
 * @param {unknown} content - Neutral or legacy content.
 * @param {string} target - Adapter name.
 * @param {boolean} [images] - Whether OpenAI image parts are supported by this adapter.
 * @returns {string|Array<object>} Provider content.
 */
export function providerContent(content, target, images = false) {
  if (typeof content === "string") return content;
  const blocks = contentBlocks(content);
  const projected = blocks.map(block => {
    if (images && block.type === "image" && block.data && block.mimeType) {
      return { type: "image_url", image_url: { url: `data:${block.mimeType};base64,${block.data}` } };
    }
    if (images && block.type === "image_url") return block;
    return { type: "text", text: describeBlock(block, target) };
  });
  return projected.every(block => block.type === "text") ? projected.map(block => block.text).join("\n") : projected;
}
