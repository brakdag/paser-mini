export class FountainTools {
  async insertSceneFountain({ scene, action }) {
    const formattedScene = scene.toUpperCase();
    const content = `* SCENE: ${formattedScene}\n${action}`;

    return {
      type: "FOUNTAIN_INJECTION",
      content,
    };
  }
}
