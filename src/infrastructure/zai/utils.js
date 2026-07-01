/**
 * Parses various truthy string/boolean values into a strict boolean.
 * @param {unknown} flag - The flag value to parse.
 * @returns {boolean} True if the flag is considered truthy.
 */
export function parseBooleanFlag(flag) {
  return flag === true || flag === "true" || flag === "1";
}

/**
 * Maps internal roles to Z.AI API roles.
 * @param {string} role - The internal role name.
 * @param {string} userNickname - The nickname of the user.
 * @param {string} agentNickname - The nickname of the agent.
 * @returns {string} The normalized API role.
 */
export function normalizeRole(role, userNickname, agentNickname) {
  if (role === userNickname) return "user";
  if (role === agentNickname) return "assistant";
  if (role === "server") return "user";
  if (role === "system") return "system";
  return role;
}

/**
 * Sanitizes and formats message content based on type and role.
 * @param {string|object|Array} content - The raw content.
 * @param {string} role - The normalized API role.
 * @returns {string} The formatted string content.
 */
export function normalizeContent(content, role) {
  let finalContent = content;
  if (
    content &&
    typeof content === "object" &&
    content.mime_type &&
    content.data
  ) {
    finalContent = `[Image Data: ${content.mime_type}]`;
  } else if (Array.isArray(content)) {
    finalContent = content.join("\n");
  }

  if (typeof finalContent === "string" && role === "assistant") {
    finalContent = finalContent
      .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
      .trim();
  }
  return finalContent;
}