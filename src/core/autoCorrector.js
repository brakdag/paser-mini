class AutoCorrector {
  static KEY_FIX_PATTERN = /([{\\s,])\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*:/g;

  static TRAILING_COMMA_PATTERN = /,\\s*([}\]])/g;

  static fixJson(content) {
    let fixed = content.trim();

    // 1. Fix newlines (turn raw newlines into \n)
    fixed = fixed.replace(/\n/g, "\\n");

    // 2. Fix invalid backslashes
    fixed = fixed.replace(/\\(?!(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, "\\\\");

    // 3. Fix quotes and trailing commas
    fixed = fixed.replace(/^'|'$|'\\s*:\\s*|:\\s*'/g, '"');
    fixed = fixed.replace(this.KEY_FIX_PATTERN, '$1 "$2":');
    fixed = fixed.replace(this.TRAILING_COMMA_PATTERN, "$1");

    // Balance braces/brackets
    const counts = { "{": 0, "[": 0 };
    const mapping = { "}": "{", "]": "[" };

    fixed.split("").forEach((char) => {
      if (char in counts) {
        counts[char] += 1;
      } else if (char in mapping) {
        counts[mapping[char]] -= 1;
      }
    });

    // Append missing closing tags
    Object.entries(counts).forEach(([openC, count]) => {
      if (count > 0) {
        fixed += (openC === "{" ? "}" : "]").repeat(count);
      }
    });

    // Prepend missing opening tags
    Object.entries(counts).forEach(([openC, count]) => {
      if (count < 0) {
        fixed = (openC === "{" ? "{" : "[").repeat(Math.abs(count)) + fixed;
      }
    });

    return fixed;
  }
}

export default AutoCorrector;
