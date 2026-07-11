/**
 * Manages the registration and instantiation of AI provider adapters.
 * This class acts as a factory for creating adapter instances based on provider IDs.
 */
class ProviderManager {
  /**
   * The registry of available AI providers and their configuration.
   * @static
   * @private
   */
  static PROVIDERS = {
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
    NVIDIA_MINIMAX: {
      name: "NVIDIA MiniMax M3",
      defaultModel: "minimaxai/minimax-m3",
      path: "../infrastructure/nvidia-minimax/adapter.js",
    },
    HUGGINGFACE: {
      name: "HuggingFace",
      defaultModel: "meta-llama/Meta-Llama-3-8B-Instruct",
      path: "../infrastructure/huggingface/adapter.js",
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
    CEREBRAS: {
      name: "Cerebras",
      defaultModel: "llama3.1-8b",
      path: "../infrastructure/cerebras/adapter.js",
    },
    COHERE: {
      name: "Cohere",
      defaultModel: "command-r-plus",
      path: "../infrastructure/cohere/adapter.js",
    },
    CLOUDFLARE: {
      name: "Cloudflare",
      defaultModel: "@cf/meta/llama-3.1-8b-instruct",
      path: "../infrastructure/cloudflare/adapter.js",
    },
    ZAI: {
      name: "Z.AI",
      defaultModel: "glm-5.2",
      path: "../infrastructure/zai/adapter.js",
    },
    PUTER: {
      name: "Puter",
      defaultModel: "gpt-4o-mini",
      path: "../infrastructure/puter/adapter.js",
    },
  };

  /**
   * Initializes the ProviderManager.
   */
  constructor() {
    this.providers = ProviderManager.PROVIDERS;
  }

  /**
   * Retrieves a list of all registered providers.
   * @returns {Array<object>} A list of providers with their IDs and configuration.
   */
  getProviders() {
    return Object.entries(this.providers).map(([id, info]) => ({
      id,
      ...info,
    }));
  }

  /**
   * Dynamically creates an instance of the requested provider adapter.
   * @param {object} params - The parameters for the adapter.
   * @param {string} params.providerId - The unique identifier of the provider (e.g., 'COHERE').
   * @param {object} params.ui - The UI interface for the adapter.
   * @param {object} params.configManager - The configuration manager for the adapter.
   * @param {string} params.userNickname - The nickname of the user.
   * @param {string} params.agentNickname - The nickname of the agent.
   * @returns {Promise<object>} The instantiated adapter instance.
   * @throws {Error} If the providerId is not supported.
   */
  async createAdapter({ providerId, ui, configManager, userNickname, agentNickname }) {
    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Unsupported provider: ${providerId}`);
    }

    const { default: AdapterClass } = await import(provider.path);
    const adapter = new AdapterClass({
      ui,
      configManager,
      userNickname,
      agentNickname,
    });
    adapter.providerId = providerId;
    return adapter;
  }
}

export default ProviderManager;