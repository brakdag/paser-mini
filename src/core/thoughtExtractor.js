import logger from "./logger.js";

/**
 * Utility class for extracting thought blocks from AI responses.
 */
class ThoughtExtractor {
  /**
   * Extracts thoughts from the AI response and displays them via the UI.
   * @param {string} response The AI response text.
   * @param {object} ui The UI instance for displaying thoughts.
   * @returns {string} The response text with thoughts removed.
   */
  static extract(response, ui) {
    const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/i;
    const match = response.match(thoughtRegex);
    if (match && match[1]) {
      const thought = match[1].trim();
      ui.displayThought(thought);
      logger.sessionLog(thought);
      return response.replace(match[0], "").trim();
    }
    const firstCallIndex = response.indexOf("SchwaSymbol");
    if (firstCallIndex > 0) {
      const thought = response.substring(0, firstCallIndex).trim();
      if (thought) {
        ui.displayThought(thought);
        logger.sessionLog(thought);
        return response.substring(firstCallIndex).trim();
      }
    }
    return response;
  }
}

export default ThoughtExtractor;