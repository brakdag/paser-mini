export { normalizeRole, normalizeContent } from "../historyNormalizer.js";

/**
 * Parses various truthy string/boolean values into a strict boolean.
 * @param {unknown} flag - The flag value to parse.
 * @returns {boolean} True if the flag is considered truthy.
 */
export function parseBooleanFlag(flag) {
  return flag === true || flag === "true" || flag === "1";
}
