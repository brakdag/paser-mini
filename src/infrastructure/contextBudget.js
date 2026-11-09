/**
 * Normalizes provider message shapes without flattening content blocks.
 * @param {object} message - Raw or formatted message.
 * @returns {object} Common budget representation.
 */
export function normalizeBudgetMessage(message) {
  const role = message.role === "model" ? "assistant" : message.role;
  return {
    role,
    content: message.content ?? message.parts ?? message.text ?? "",
    ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
  };
}

/**
 * Counts media blocks for an explicit additional heuristic charge.
 * @param {unknown} value - Content tree.
 * @returns {number} Number of media blocks.
 */
function mediaCount(value) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + mediaCount(item), 0);
  if ("inline_data" in value || "inlineData" in value || "image_url" in value ||
      ("type" in value && ["image", "audio", "video", "document", "input_audio"].includes(String(value.type)))) return 1;
  return Object.values(value).reduce((sum, item) => sum + mediaCount(item), 0);
}

/**
 * Estimates serialized content, framing and media; never claims tokenizer accuracy.
 * @param {object[]} messages - Messages in any supported provider shape.
 * @param {string} systemInstruction - Separate system text, if not in messages.
 * @param {number} charsPerToken - Positive heuristic ratio.
 * @param {object} [extra] - Additional payload fields, including tool schemas.
 * @returns {number} Estimated input tokens.
 */
export function estimateContextTokens(messages, systemInstruction, charsPerToken, extra = {}) {
  const normalized = messages.map(normalizeBudgetMessage);
  const system = normalized.some(message => message.role === "system" && message.content === systemInstruction) ? "" : systemInstruction || "";
  const content = { messages: normalized, ...(system ? { system } : {}), ...extra };
  return Math.ceil(JSON.stringify(content).length / charsPerToken) + mediaCount(content) * 2048;
}

/**
 * Validates the local budget and generation allowance without permissive parseInt.
 * @param {unknown} limit - Local context setting; zero disables trimming.
 * @param {unknown} output - Requested generation allowance.
 * @param {number} charsPerToken - Heuristic ratio.
 * @returns {{limit: number, output: number, charsPerToken: number}} Valid policy.
 */
export function contextSettings(limit, output, charsPerToken) {
  const parsedLimit = Number(limit);
  const parsedOutput = Number(output);
  if ([limit, output].some(value => typeof value !== "number" && !(typeof value === "string" && /^\d+$/u.test(value.trim()))) ||
      !Number.isSafeInteger(parsedLimit) || parsedLimit < 0 || !Number.isSafeInteger(parsedOutput) || parsedOutput < 1 ||
      !Number.isFinite(charsPerToken) || charsPerToken <= 0) {
    throw new Error("CONTEXT_CONFIG: expected a nonnegative integer limit, positive integer output reserve and positive token ratio");
  }
  if (parsedLimit && parsedLimit <= parsedOutput + 500) {
    throw new Error("CONTEXT_BUDGET: limit must exceed the output reserve plus 500 estimated protocol tokens");
  }
  return { limit: parsedLimit, output: parsedOutput, charsPerToken };
}

/**
 * Plans removal of complete old turns. Untagged legacy history is one unit.
 * The current unit and all system/developer instructions remain intact.
 * @param {object[]} messages - History with optional contextTurn identifiers.
 * @param {object} settings - Validated settings.
 * @param {number} settings.limit - Total local budget.
 * @param {number} settings.output - Output reserve.
 * @param {number} settings.charsPerToken - Heuristic ratio.
 * @param {string} systemInstruction - Separate prompt.
 * @returns {object[]} Retained original entries, without mutating any input.
 */
export function planContext(messages, settings, systemInstruction) {
  if (!settings.limit) return messages.slice();
  const units = [...new Set(messages.filter(message => !["system", "developer"].includes(message.role)).map(message => message.contextTurn || "legacy"))];
  let retained = messages.slice();
  let index = 0;
  while (estimateContextTokens(retained, systemInstruction, settings.charsPerToken) + settings.output + 500 > settings.limit) {
    if (index >= units.length - 1) {
      throw new Error("CONTEXT_BUDGET: system instructions and current turn do not fit the estimated budget; shorten input, reduce output reserve or increase /trunc");
    }
    const removed = units[index];
    retained = retained.filter(message => ["system", "developer"].includes(message.role) || (message.contextTurn || "legacy") !== removed);
    index += 1;
  }
  return retained;
}
