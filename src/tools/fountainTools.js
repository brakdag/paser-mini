export const insertSceneFountain = async ({ scene, action }) => {
  // Ensure scene is uppercase as per requirements
  const formattedScene = scene.toUpperCase();
  const content = `* SCENE: ${formattedScene}\n${action}`;
  
  // Return a signal object instead of a string to trigger special handling in TurnProcessor
  return {
    type: 'FOUNTAIN_INJECTION',
    content: content
  };
};