/**
 * Provides utilities for injecting content into Fountain-formatted screenplays.
 */
class FountainTools {
  /**
   * Inserts a formatted scene into a Fountain screenplay.
   * @param {string} scene - The scene heading to insert.
   * @param {string} action - The action text to insert.
   * @returns {Promise<{type: string, content: string}>} The formatted injection object.
   */
  async insertSceneFountain(scene, action) {
    if (!scene || !action) {
      throw new Error("FountainTools: Missing required arguments 'scene' or 'action'.");
    }
    const formattedScene = scene.toUpperCase();
    const content = `* SCENE: ${formattedScene}\n${action}`;
    return {
      type: "FOUNTAIN_INJECTION",
      content,
    };
  }
}

export default FountainTools;