/**
 * Parses space-separated command arguments, preserving quoted values and case.
 * @param {string} input - Command payload.
 * @returns {string[]} Parsed arguments.
 */
export default function parseCommandArguments(input) {
  const args = [];
  const pattern = /\s*("(?:\\.|[^"\\])*"|'[^']*'|[^\s"']+)(?=\s|$)/gy;
  const text = input.trim();
  while (pattern.lastIndex < text.length) {
    const match = pattern.exec(text);
    if (!match) throw new Error("Invalid arguments: separate values with spaces and close quoted strings.");
    const token = match[1];
    if (token.startsWith('"')) {
      try { args.push(JSON.parse(token)); } catch { throw new Error("Invalid quoted argument; check escape sequences."); }
    } else args.push(token.startsWith("'") ? token.slice(1, -1) : token);
  }
  return args;
}
