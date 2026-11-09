import ChatManager from "./chatManager.js";
import ProviderManager from "../infrastructure/providerManager.js";
import { getToolInstance } from "../infrastructure/registry.js";

/**
 * Creates a session and binds the tool contexts shared by terminal and GitHub modes.
 * @param {object} options - Session dependencies, prompt and execution mode.
 * @param {object} options.ui - Session UI.
 * @param {object} options.configManager - Configuration storage.
 * @param {string} options.systemInstruction - Session prompt.
 * @param {object} options.tools - Tool registry.
 * @param {boolean} [options.pureMode] - Whether tools are disabled.
 * @param {object} [options.providerManager] - Adapter factory and provider metadata.
 * @param {(name: string) => Promise<object>} [options.resolveTool] - Tool instance resolver.
 * @param {boolean} [options.instanceMode] - Whether configuration changes stay in memory.
 * @returns {Promise<ChatManager>} The configured session, ready to start.
 */
export default async function createSession({
  ui, configManager, systemInstruction, tools, pureMode = false,
  providerManager = new ProviderManager(), resolveTool = getToolInstance,
  instanceMode = false,
}) {
  const providerId = configManager.get("provider", "GEMINI");
  const provider = providerManager.getProviders().find((entry) => entry.id === providerId);
  if (!provider) throw new Error(`Unsupported provider: ${providerId}`);
  const user = { nickname: configManager.get("user_nickname", "user") };
  const model = {
    nickname: configManager.get("agent_nickname", "assistant"),
    name: configManager.get("model_name") || provider.defaultModel,
    temperature: Number.parseFloat(configManager.get("default_temperature", 0.7)),
  };
  const assistant = await providerManager.createAdapter({
    providerId, ui, configManager, userNickname: user.nickname, agentNickname: model.nickname,
  });
  const session = new ChatManager({
    assistant, tools, systemInstruction, pureMode, ui, user, model, configManager, instanceMode,
  });
  session.providerManager = providerManager;
  /** Loads and binds contexts only when tools are first enabled. */
  session.prepareToolContexts = async () => {
    if (session.toolContexts) return;
    const [memory, system, util] = await Promise.all([
      resolveTool("memoryTools"), resolveTool("systemTools"), resolveTool("utilTools"),
    ]);
    session.toolContexts = { memory, system, util };
    session.bindToolContexts();
  };
  if (!pureMode) await session.prepareToolContexts();
  return session;
}
