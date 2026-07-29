/**
 * Maps neutral history to Gemini/NVIDIA API formats
 */
class PayloadMapper {
  /**
   * Maps neutral history to Gemini API format.
   * Gemini expects: { contents: [ { role: 'user'|'model', parts: [ { text: '...' } ] } ] }
   * @param {object} config - The configuration object.
   * @param {Array<object>} config.history - The conversation history array.
   * @param {string} config.systemInstruction - The system-level prompt.
   * @param {number} config.temperature - The sampling temperature.
   * @param {number} config.maxOutputTokens - The maximum tokens to generate.
   * @returns {object} The Gemini-formatted payload.
   */
  static toGemini({ history, systemInstruction, temperature, maxOutputTokens }) {
    const contents = history.map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const payload = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    return payload;
  }

  /**
   * Maps neutral history to NVIDIA/OpenAI format.
   * NVIDIA expects: { messages: [ { role: 'system'|'user'|'assistant', content: '...' } ] }
   * @param {object} config - The configuration object.
   * @param {Array<object>} config.history - The conversation history array.
   * @param {string} config.systemInstruction - The system-level prompt.
   * @param {number} config.temperature - The sampling temperature.
   * @param {number} config.maxTokens - The maximum tokens to generate.
   * @returns {object} The NVIDIA-formatted payload.
   */
  static toNvidia({ history, systemInstruction, temperature, maxTokens }) {
    const messages = [];

    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }

    history.forEach((m) => {
      messages.push({
        role: m.role === "model" ? "assistant" : "user",
        content: m.text,
      });
    });

    return {
      messages,
      temperature,
      max_tokens: maxTokens,
    };
  }
}

export default PayloadMapper;