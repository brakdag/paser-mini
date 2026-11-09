import DEFAULT_MODELS from "./providerDefaults.js";

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
      defaultModel: DEFAULT_MODELS.GEMINI,
      path: "./gemini/adapter.js",
    },
    NVIDIA: {
      name: "NVIDIA",
      defaultModel: DEFAULT_MODELS.NVIDIA,
      path: "./nvidia/adapter.js",
    },
    NVIDIA_MINIMAX: {
      name: "NVIDIA MiniMax M3",
      defaultModel: DEFAULT_MODELS.NVIDIA_MINIMAX,
      path: "./nvidia-minimax/adapter.js",
    },
    HUGGINGFACE: {
      name: "HuggingFace",
      defaultModel: DEFAULT_MODELS.HUGGINGFACE,
      path: "./huggingface/adapter.js",
    },
    OPENROUTER: {
      name: "OpenRouter",
      defaultModel: DEFAULT_MODELS.OPENROUTER,
      path: "./openrouter/adapter.js",
    },
    ZENMUX: {
      name: "ZenMux",
      defaultModel: DEFAULT_MODELS.ZENMUX,
      path: "./zenmux/adapter.js",
    },
    GROQ: {
      name: "Groq",
      defaultModel: DEFAULT_MODELS.GROQ,
      path: "./groq/adapter.js",
    },
    CEREBRAS: {
      name: "Cerebras",
      defaultModel: DEFAULT_MODELS.CEREBRAS,
      path: "./cerebras/adapter.js",
    },
    COHERE: {
      name: "Cohere",
      defaultModel: DEFAULT_MODELS.COHERE,
      path: "./cohere/adapter.js",
    },
    CLOUDFLARE: {
      name: "Cloudflare",
      defaultModel: DEFAULT_MODELS.CLOUDFLARE,
      path: "./cloudflare/adapter.js",
    },
    ZAI: {
      name: "Z.AI",
      defaultModel: DEFAULT_MODELS.ZAI,
      path: "./zai/adapter.js",
    },
    POOLSIDE: {
      name: "Poolside",
      defaultModel: DEFAULT_MODELS.POOLSIDE,
      path: "./poolside/adapter.js",
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
   * @param {string} [params.userNickname] - The nickname of the user.
   * @param {string} [params.agentNickname] - The nickname of the agent.
   * @returns {Promise<object>} The instantiated adapter instance.
   * @throws {Error} If the providerId is not supported.
   */
  async createAdapter({
    providerId,
    ui,
    configManager,
    userNickname = "user",
    agentNickname = "assistant",
  }) {
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
