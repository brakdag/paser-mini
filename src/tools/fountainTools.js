/**
 * Provides utilities for injecting content into Fountain-formatted screenplays.
 */
class FountainTools {
  /**
   * Inserts a formatted scene into a Fountain screenplay.
   * @param {object} options - Injection options.
   * @param {string} options.scene - The scene heading to insert.
   * @param {string} options.action - The action text to insert.
   * @returns {Promise<{type: string, content: string}>} The formatted injection object.
   */
  async insertSceneFountain({ scene, action }) {
    const formattedScene = scene.toUpperCase();
    const content = `* SCENE: ${formattedScene}\n${action}`;
    return {
      type: "FOUNTAIN_INJECTION",
      content,
    };
  }
}

export default FountainTools;