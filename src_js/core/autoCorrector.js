export class AutoCorrector {
  static KEY_FIX_PATTERN = /([{\\s,])\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*:/g;
  static TRAILING_COMMA_PATTERN = /,\\s*([\}\]])/g;

  static fixJson(content) {
    let fixed = content.trim();

    // Fix invalid backslashes
    fixed = fixed.replace(/\\(?!(?:[\"\\\/bfnrt]|u[0-9a-fA-F]{4}))/g, "\\\\");

    // Only replace single quotes if they are acting as delimiters
    fixed = fixed.replace(/^'|'$|'\\s*:\\s*|:\\s*'/g, '"');

    fixed = fixed.replace(this.KEY_FIX_PATTERN, '$1 "$2":');
    fixed = fixed.replace(this.TRAILING_COMMA_PATTERN, '$1');

    // Balance braces/brackets
    const counts = { "{": 0, "[": 0 };
    const mapping = { "}": "{", "]": "[" };

    for (const char of fixed) {
      if (char in counts) {
        counts[char]++;
      } else if (char in mapping) {
        counts[mapping[char]]--;
      }
    }

    // Append missing closing tags
    for (const [openC, count] of Object.entries(counts)) {
      if (count > 0) {
        fixed += (openC === "{" ? "}" : "]").repeat(count);
      }
    }

    // Prepend missing opening tags
    for (const [openC, count] of Object.entries(counts)) {
      if (count < 0) {
        fixed = (openC === "{" ? "{" : "[").repeat(Math.abs(count)) + fixed;
      }
    }

    return fixed;
  }
}