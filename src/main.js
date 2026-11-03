import "dotenv/config";
import parseCliOptions from "./core/cliOptions.js";
import TerminalUI from "./core/terminalUI.js";
import ChatManager from "./core/chatManager.js";
import ConfigManager from "./core/configManager.js";
import ProviderManager from "./infrastructure/providerManager.js";
import promptManager from "./core/systemPromptManager.js";
import { getToolInstance } from "./infrastructure/registry.js";
import mcpManager from "./infrastructure/McpManager.js";
import logger from "./core/logger.js";

/**
 * Main entry point for the paser-mini application.
 * Initializes the CLI, configuration, and chat manager.
 * @returns {Promise<void>}
 */
async function main() {
  const options = parseCliOptions();
  const configManager = new ConfigManager();

  if (options.githubMode) {
    const { GitHubModeOrchestrator } =
      await import("./core/githubModeOrchestrator.js");
    
    const { systemInstruction, filteredTools, pureMode } = await promptManager.buildPrompt(options);

    const orchestrator = new GitHubModeOrchestrator(
      systemInstruction,
      filteredTools,
      pureMode,
    );
    await orchestrator.run();
    return;
  }

  const [ui, providerManager, memoryToolsInstance, systemToolsInstance, utilToolsInstance] = await Promise.all([
    new TerminalUI(),
    new ProviderManager(),
    getToolInstance("memoryTools"),
    getToolInstance("systemTools"),
    getToolInstance("utilTools"),
  ]);

  const { systemInstruction, filteredTools, pureMode } = await promptManager.buildPrompt(options);

  const providerId = configManager.get("provider", "GEMINI");
  const userNick = configManager.get("user_nickname", "user");
  const agentNick = configManager.get("agent_nickname", "assistant");
  const modelName = configManager.get("model_name", "gemini-2.0-flash");
  const temperature = parseFloat(configManager.get("default_temperature", 0.7));

  const user = { nickname: userNick };
  const model = { nickname: agentNick, name: modelName, temperature };

  logger.info(`Startup: Loading adapter for provider ${providerId}...`);

  const assistant = await providerManager.createAdapter({
    providerId,
    ui,
    configManager,
    userNickname: userNick,
    agentNickname: agentNick,
  });

  const chatManager = new ChatManager({
    assistant,
    tools: filteredTools,
    systemInstruction,
    pureMode,
    ui,
    user,
    model,
    configManager,
  });

  chatManager.providerManager = providerManager;

  memoryToolsInstance.setMemoryContext(assistant, chatManager);
  systemToolsInstance.setContext(assistant, chatManager);
  utilToolsInstance.setIdentityContext(model);

  logger.info("Startup: Initialization complete. Handing off to ChatManager.\n");
  
  await chatManager.run(options.message);

  promptManager.saveCache();
}

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", reason, { promise });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception thrown:", err);
});

/**
 * Gracefully terminates all active connections and saves caches.
 * Triggered on normal exits, SIGINT (Ctrl+C), and SIGTERM.
 */
async function gracefulShutdown() {
  promptManager.saveCache();
  await mcpManager.shutdown();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

process.on("exit", () => {
  promptManager.saveCache();
});

main().catch((err) => {
  logger.error("Critical Error:", err);
  process.exit(1);
});
