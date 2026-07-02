import logger from "./logger.js";

class ThoughtExtractor {
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

