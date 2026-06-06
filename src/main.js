import "dotenv/config";
import { Command } from "commander";
import TerminalUI from "./core/terminalUI.js";
import ChatManager from "./core/chatManager.js";
import ConfigManager from "./core/configManager.js";
import ProviderManager from "./infrastructure/providerManager.js";
import SystemPromptManager from "./core/systemPromptManager.js";
import { AVAILABLE_TOOLS } from "./tools/registry.js";
import { MemoryTools } from "./tools/memoryTools.js";

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
    
    const promptManager = new SystemPromptManager();
    const { systemInstruction, filteredTools } = promptManager.buildPrompt(options);

    const orchestrator = new GitHubModeOrchestrator(
      systemInstruction,
      filteredTools,
    );
    await orchestrator.runForever();
    return;
  }

  const ui = new TerminalUI();
  const providerManager = new ProviderManager();
  const promptManager = new SystemPromptManager();

  const { systemInstruction, filteredTools } = promptManager.buildPrompt(options);

  const providerId = configManager.get("provider", "GEMINI");
  const userNick = configManager.get("user_nickname", "user");
  const agentNick = configManager.get("agent_nickname", "assistant");

  const assistant = await providerManager.createAdapter(
    providerId,
    ui,
    configManager,
    userNick,
    agentNick,
  );

  const chatManager = new ChatManager(
    assistant,
    filteredTools,
    systemInstruction,
    ui,
  );

  chatManager.configManager = configManager;
  chatManager.providerManager = providerManager;

  const memoryToolsInstance = new MemoryTools();
  memoryToolsInstance.setMemoryContext(assistant, chatManager);
  await chatManager.run(options.message);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", reason, promise);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

main().catch((err) => {
  console.error("Critical Error:", err);
  process.exit(1);
});
