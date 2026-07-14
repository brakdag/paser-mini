/**
 * Shared utilities for normalizing chat history across AI adapters.
 */

/**
 * Normalizes the role of a message sender to the API-compatible role.
 * @param {string} role - The original role.
 * @param {string} userNickname - The user's nickname.
 * @param {string} agentNickname - The agent's nickname.
 * @returns {string} The normalized role.
 */
export function normalizeRole(role, userNickname, agentNickname) {
  if (role === userNickname) return 'user';
  if (role === agentNickname || role === 'model') return 'assistant';
  if (role === 'server') return 'user';
  return role;
}

/**
 * Normalizes message content for the API, handling objects, arrays, and thought filtering.
 * @param {string|object|Array} content - The raw content.
 * @param {string} apiRole - The normalized API role.
 * @returns {string|Array} The normalized content.
 */
export function normalizeContent(content, apiRole) {
  let finalContent = content;

  if (content && typeof content === 'object' && content.mime_type && content.data) {
    finalContent = [
      { type: 'text', text: `Image resolution: ${content.resolution || 'unknown'}` },
      { type: 'image_url', image_url: { url: `data:${content.mime_type};base64,${content.data}` } },
    ];
  } else if (Array.isArray(content)) {
    finalContent = content.join('\n');
  }

  if (typeof finalContent === 'string' && apiRole === 'assistant') {
    finalContent = finalContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  }

  return finalContent;
}

/**
 * Estimates the token count based on character length heuristic.
 * @param {string} systemInstruction - The system instruction text.
 * @param {Array} history - The conversation history.
 * @param {number} [charsPerToken] - The heuristic ratio of characters per token (default: 3.5).
 * @returns {number} The estimated token count.
 */
export function countTokensHeuristic(systemInstruction, history, charsPerToken = 3.5) {
  const systemChars = systemInstruction?.length || 0;
  const historyChars = history.reduce((acc, msg) => {
    const content = msg.content || msg.text || '';
    return acc + (typeof content === 'string' ? content.length : JSON.stringify(content).length);
  }, 0);
  return Math.ceil((systemChars + historyChars) / charsPerToken);
}