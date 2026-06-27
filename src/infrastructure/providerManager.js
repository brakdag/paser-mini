/**
 *
 */
class ProviderManager {
  /**
   *
   */
  constructor() {
    this.providers = {
      GEMINI: {
        name: "Gemini",
        defaultModel: "gemini-2.0-flash",
        path: "../infrastructure/gemini/adapter.js",
      },
      NVIDIA: {
        name: "NVIDIA",
        defaultModel: "meta/llama-3.1-405b-instruct",
        path: "../infrastructure/nvidia/adapter.js",
      },
      OPENROUTER: {
        name: "OpenRouter",
        defaultModel: "openai/gpt-4o",
        path: "../infrastructure/openrouter/adapter.js",
      },
      GROQ: {
        name: "Groq",
        defaultModel: "llama3-8b-8192",
        path: "../infrastructure/groq/adapter.js",
      },
      COHERE: {
        name: "Cohere",
        defaultModel: "command-r-plus",
        path: "../infrastructure/cohere/adapter.js",
      },
    };
  }

  /**
   *
   */
  getProviders() {
    return Object.entries(this.providers).map(([id, info]) => ({
      id,
      ...info,
    }));
  }

  /**
   *
   * @param providerId
   * @param ui
   * @param configManager
   * @param userNickname
   * @param agentNickname
   */
  async createAdapter(providerId, ui, configManager, userNickname, agentNickname) {
    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Unsupported provider: ${providerId}`);
    }

    const { default: AdapterClass } = await import(provider.path);
    const adapter = new AdapterClass(
      ui,
      configManager,
      userNickname,
      agentNickname,
    );
    adapter.providerId = providerId;
    return adapter;
  }
}

export default ProviderManager;