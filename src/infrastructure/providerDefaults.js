/**
 * Local fallback choices; these do not assert remote model availability.
 * @type {Readonly<Record<string, string>>}
 */
const DEFAULT_MODELS = Object.freeze({
  GEMINI: "gemini-flash-lite-latest",
  NVIDIA: "z-ai/glm-5.2",
  NVIDIA_MINIMAX: "minimaxai/minimax-m3",
  HUGGINGFACE: "meta-llama/Meta-Llama-3-8B-Instruct",
  OPENROUTER: "stealth/crouton-alpha",
  ZENMUX: "google/gemini-3.1-pro-preview",
  GROQ: "llama3-8b-8192",
  CEREBRAS: "llama3.1-8b",
  COHERE: "command-r-plus",
  CLOUDFLARE: "@cf/meta/llama-3.1-8b-instruct",
  ZAI: "glm-4.7-flash",
  POOLSIDE: "poolside/laguna-s-2.1",
});

export default DEFAULT_MODELS;
