/**
 * Wraps text to fit within a specified column range.
 * @param {string} text - The text to be wrapped.
 * @param {number} start - The starting column position.
 * @param {number} end - The ending column position.
 * @returns {string} The wrapped text formatted with leading spaces.
 */
function wrapText(text, start, end) {
  if (!text) return "";
  const width = end - start;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + (currentLine ? " " : "") + word).length <= width) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  
  if (currentLine) lines.push(currentLine);

  return lines.map((line) => " ".repeat(start) + line).join("\n");
}

export default wrapText;
