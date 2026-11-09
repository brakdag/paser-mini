import IRCFormatter from "../utils/ircFormatter.js";
import { normalizeRole, normalizeContent } from "./historyNormalizer.js";
import logger from "../core/logger.js";

/**
 * Appends raw content using the shared chat-completions history contract.
 * @param {object} adapter - Owner of identities and mutable history.
 * @param {string} role - Sender identity or API role.
 * @param {string|object|Array} content - Raw content, including media blocks.
 * @param {string|null} [timestamp] - Optional timestamp.
 */
export function appendChatMessage(adapter, role, content, timestamp = null) {
  const apiRole = normalizeRole(role, adapter.user.nickname, adapter.model.nickname);
  adapter.history.push({
    role: apiRole, content: normalizeContent(content, apiRole),
    timestamp: timestamp || IRCFormatter.getTimestamp(),
  });
}

/**
 * Resets history with one leading system message and without mutating an override.
 * @param {object} adapter - History owner.
 * @param {Array|null} [override] - Replacement conversation.
 */
export function resetChatHistory(adapter, override = null) {
  const owner = adapter;
  owner.history = structuredClone(override || []);
  adapter.updateSystemInstruction(adapter.systemInstruction);
  logger.info(`[${adapter.constructor.name}] History hard reset`);
}

/**
 * Preserves cancellation and HTTP metadata used by the common retry policy.
 * @param {object} error - Transport or response failure.
 * @returns {Error} Public API error.
 */
export function normalizeApiError(error) {
  if (["AbortError", "UserInterruptException", "TimeoutError"].includes(error.name) || error.code === "ERR_CANCELED") return error;
  return Object.assign(new Error(error.response?.data?.error?.message || error.message), {
    name: "APIError", response: error.response, code: error.code,
  });
}

/**
 * Composes compatible wire transport with the adapter's own formatting/context policy.
 * History rollback and the total deadline belong to BaseAdapter.sendMessage.
 * @param {object} adapter - Adapter providing client, identities and context methods.
 * @param {string|object|Array} message - Raw input.
 * @param {string} role - Sender role.
 * @param {object} options - Shared request budget and cancellation.
 * @param {AbortSignal} [options.signal] - Cancels requests and waits.
 * @param {import("../utils/requestBudget.js").default} [options.budget] - Request deadline.
 * @returns {Promise<string>} Assistant text.
 */
export async function sendChatCompletion(adapter, message, role, { signal, budget }) {
  adapter.injectMessage(role, message, IRCFormatter.getTimestamp());
  adapter._enforceContextLimit();
  const payload = {
    model: adapter.currentModel,
    messages: adapter.getHistory().map(({ role: sender, content, timestamp }) => ({
      role: sender, content: adapter.formatTextForPayload(sender, content, timestamp),
    })),
    temperature: adapter.temperature,
    max_tokens: adapter.getMaxOutputTokens(),
  };
  adapter._validateContextPayload(payload);
  const owner = adapter;
  owner.lastPayload = payload;
  await adapter._applyRateLimit(signal);
  const name = adapter.constructor.name.replace(/Adapter$/, "");
  return adapter.retryHandler.execute(async () => {
    try {
      const response = await adapter.client.post("/chat/completions", payload, { signal });
      signal?.throwIfAborted();
      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) throw new Error(`Empty response from ${name}`);
      adapter.injectMessage("assistant", content, IRCFormatter.getTimestamp());
      return content;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }, {
    signal, budget, recoverableErrors: adapter.recoverableErrors,
    /**
     * Reports one retry without logging conversation contents.
     * @param {number} attempt - Attempt number.
     * @param {Error} error - Failure.
     * @param {string} delay - Human-readable wait.
     */
    onRetry(attempt, error, delay) {
      logger.warn(`[${name}Adapter] Retrying in ${delay} (${attempt}/${adapter.retryHandler.maxRetries}): ${error.message}`);
      adapter.ui?.displayInfo?.(`Retrying ${name} in ${delay}... (${attempt}/${adapter.retryHandler.maxRetries}) | Error: ${error.message}`);
    },
  });
}
