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
  return { limit: parsedLimit, output: parsedOutput, charsPerToken };
}

/**
 * Shortens text only, retaining both ends and leaving binary/structured fields intact.
 * @param {unknown} value - Content tree.
 * @param {number} fraction - Fraction of text to retain.
 * @returns {unknown} Copy with shortened text blocks.
 */
function shortenText(value, fraction) {
  if (typeof value === "string") {
    const length = Math.max(128, Math.floor(value.length * fraction));
    if (value.length <= length) return value;
    const marker = "\n[Context truncated]\n";
    const head = Math.ceil((length - marker.length) / 2);
    return value.slice(0, head) + marker + value.slice(-(length - marker.length - head));
  }
  if (Array.isArray(value)) return value.map(item => shortenText(item, fraction));
  if (!value || typeof value !== "object") return value;
  // Never slice base64, URLs, tool arguments, identifiers or provider metadata.
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ["text", "content", "parts", "resource"].includes(key) ? shortenText(item, fraction) : item,
  ]));
}

/**
 * Removes complete old turns, then shortens active text when necessary.
 * Instructions, media and protocol structure impose a soft minimum budget;
 * an impossible local limit must never interrupt the agent's tool loop.
 * @param {object[]} messages - History with optional contextTurn identifiers.
 * @param {object} settings - Validated settings.
 * @param {number} settings.limit - Requested total local budget.
 * @param {number} settings.output - Output reserve.
 * @param {number} settings.charsPerToken - Heuristic ratio.
 * @param {string} systemInstruction - Separate prompt.
 * @param {object} [extra] - Final payload fields, including tool schemas.
 * @returns {object[]} Retained entries, without mutating any input.
 */
export function planContext(messages, settings, systemInstruction, extra = {}) {
  if (!settings.limit) return messages.slice();
  /**
   * Identifies instructions that must remain intact.
   * @param {object} message - History entry.
   * @returns {boolean} Whether this entry is pinned.
   */
  const pinned = message => ["system", "developer"].includes(message.role);
  /**
   * Estimates total request usage including reserves.
   * @param {object[]} entries - Retained messages.
   * @returns {number} Estimated total tokens.
   */
  const cost = entries => estimateContextTokens(entries, systemInstruction, settings.charsPerToken, extra) + settings.output + 500;
  const units = [...new Set(messages.filter(message => !pinned(message)).map(message => message.contextTurn || "legacy"))];
  let retained = messages.slice();
  let index = 0;
  while (cost(retained) > settings.limit && index < units.length - 1) {
    const removed = units[index];
    retained = retained.filter(message => pinned(message) || (message.contextTurn || "legacy") !== removed);
    index += 1;
  }
  if (cost(retained) <= settings.limit) return retained;
  /**
   * Copies active content with proportionally shortened text.
   * @param {number} fraction - Fraction of text to retain.
   * @returns {object[]} Shortened history.
   */
  const shortened = fraction => retained.map(message => {
    if (pinned(message)) return message;
    const copy = { ...message };
    ["content", "parts", "text", "sourceContent"].forEach(key => {
      if (key in copy) copy[key] = shortenText(copy[key], fraction);
    });
    return copy;
  });
  let result = shortened(0);
  const target = Math.max(settings.limit, cost(result));
  let low = 0;
  let high = 1;
  // Bounded search also accounts for JSON escaping in the serialized estimate.
  for (let step = 0; step < 24; step += 1) {
    const fraction = (low + high) / 2;
    const candidate = shortened(fraction);
    if (cost(candidate) <= target) {
      result = candidate;
      low = fraction;
    } else high = fraction;
  }
  return result;
}
