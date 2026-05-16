const PayloadMapper = {
  /**
   * Maps neutral history to Gemini API format
   * Gemini expects: { contents: [ { role: 'user'|'model', parts: [ { text: '...' } ] } ] }
   */
  toGemini(history, systemInstruction, temperature) {
    const contents = history.map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const payload = {
      contents,
      generationConfig: {
        temperature,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    return payload;
  },

  /**
   * Maps neutral history to NVIDIA/OpenAI format
   * NVIDIA expects: { messages: [ { role: 'system'|'user'|'assistant', content: '...' } ] }
   */
  toNvidia(history, systemInstruction, temperature) {
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
    };
  },
};


export default PayloadMapper;
