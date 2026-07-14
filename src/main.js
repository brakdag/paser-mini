import "dotenv/config";
import { Command } from "commander";
import TerminalUI from "./core/terminalUI.js";
import ChatManager from "./core/chatManager.js";
import ConfigManager from "./core/configManager.js";
import ProviderManager from "./infrastructure/providerManager.js";
import promptManager from "./core/systemPromptManager.js";
import { getToolInstance } from "./infrastructure/registry.js";
import GeminiAdapter from "./infrastructure/gemini/adapter.js";
import logger from "./core/logger.js";

/**
 * Main entry point for the paser-mini application.
 * Initializes the CLI, configuration, and chat manager.
 * @returns {Promise<void>}
 */
async function main() {
  const program = new Command();

  program
    .name("paser-mini")
    .description("Minimalist Autonomous Agent (JS Port)")
    .option("-m, --message <message>", "Initial message to send")
    .option(
      "-si, --system-instruction <instruction>",
      "Custom system instructions",
    )
    .option(
      "-isi, --inject-system-instruction <instruction>",
      "Inject instruction at the start of system prompt",
    )
    .option(
      "-fsi, --file-system-instruction <path>",
      "Path to file for system instruction injection",
    )
    .option("-nsi, --no-system-instruction", "Run without system instructions")
    .option(
      "--github-mode",
      "Run in GitHub mode: process issues with #ai-assistance",
    )
    .parse(process.argv);

  const options = program.opts();
  const configManager = new ConfigManager();

  if (options.githubMode) {
    const { GitHubModeOrchestrator } =
      await import("./core/githubModeOrchestrator.js");
    
    const { systemInstruction, filteredTools } = await promptManager.buildPrompt(options);

    const orchestrator = new GitHubModeOrchestrator(
      systemInstruction,
      filteredTools,
    );
    await orchestrator.runForever();
    return;
  }

  const [ui, providerManager, memoryToolsInstance, systemToolsInstance, utilToolsInstance] = await Promise.all([
    new TerminalUI(),
    new ProviderManager(),
    getToolInstance("memoryTools"),
    getToolInstance("systemTools"),
    getToolInstance("utilTools"),
  ]);

  const { systemInstruction, filteredTools } = await promptManager.buildPrompt(options);

  const providerId = configManager.get("provider", "GEMINI");
  const userNick = configManager.get("user_nickname", "user");
  const agentNick = configManager.get("agent_nickname", "assistant");
  const modelName = configManager.get("model_name", "gemini-2.0-flash");
  const temperature = parseFloat(configManager.get("default_temperature", 0.7));

  const user = { nickname: userNick };
  const model = { nickname: agentNick, name: modelName, temperature };

  logger.info(`Startup: Loading adapter for provider ${providerId}...`);

  let assistant;
  if (providerId === "GEMINI") {
    assistant = new GeminiAdapter({ ui, configManager });
    assistant.providerId = providerId;
  } else {
    assistant = await providerManager.createAdapter({
      providerId,
      ui,
      configManager,
    });
  }

  const chatManager = new ChatManager({
    assistant,
    tools: filteredTools,
    systemInstruction,
    ui,
    user,
    model,
    configManager,
  });

  chatManager.providerManager = providerManager;

  memoryToolsInstance.setMemoryContext(assistant, chatManager);
  await systemToolsInstance.setContext(assistant, chatManager);
  utilToolsInstance.setIdentityContext(model);

  logger.info("Startup: Initialization complete. Handing off to ChatManager.\n");
  
  await chatManager.run(options.message);

  promptManager.saveCache();
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", reason, promise);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

// Guardar caché del system prompt al cerrar la aplicación
process.on("exit", () => {
  promptManager.saveCache();
});

main().catch((err) => {
  console.error("Critical Error:", err);
  process.exit(1);
});