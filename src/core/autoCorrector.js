/**
 * Provides utility methods to correct and sanitize JSON-like strings.
 */
class AutoCorrector {
  static KEY_FIX_PATTERN = /([{\s,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;

  static TRAILING_COMMA_PATTERN = /,\s*([}\]])/g;

  static SINGLE_QUOTE_PATTERN = /'([^'\\ ]*(?:\\.[^'\\ ]*)*)'/g;

  /**
   * Attempts to fix common JSON formatting errors such as unquoted keys, single quotes, and trailing commas.
   * @param {string} content - The JSON-like string to be corrected.
   * @returns {string} The corrected JSON string.
   */
  static fixJson(content) {
    let fixed = content.trim();

    // 1. Convert single quotes to double quotes
    fixed = fixed.replace(this.SINGLE_QUOTE_PATTERN, '"$1"');

    // 2. Quote unquoted keys
    fixed = fixed.replace(this.KEY_FIX_PATTERN, '$1"$2":');

    // 3. Remove trailing commas
    fixed = fixed.replace(this.TRAILING_COMMA_PATTERN, '$1');

    // 4. Balance braces/brackets using a stack
    const stack = [];
    const opening = { '{': '}', '[': ']' };
    const closing = { '}': '{', ']': '[' };
    let prefix = "";

    for (let i = 0; i < fixed.length; i += 1) {
      const char = fixed[i];
      if (opening[char]) {
        stack.push(opening[char]);
      } else if (closing[char]) {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        } else {
          prefix = closing[char] + prefix;
        }
      }
    }

    while (stack.length > 0) {
      fixed += stack.pop();
    }

    return prefix + fixed;
  }
}

export default AutoCorrector;