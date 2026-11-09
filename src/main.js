import "dotenv/config";
import { writeSync } from "fs";
import parseCliOptions from "./core/cliOptions.js";
import TerminalUI from "./core/terminalUI.js";
import createSession from "./core/sessionFactory.js";
import ConfigManager from "./core/configManager.js";
import promptManager from "./core/systemPromptManager.js";
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
  configManager.migrateGlobalKeys();

  const { systemInstruction, filteredTools, pureMode } = await promptManager.buildPrompt(options);

  if (options.githubMode) {
    const { default: GitHubModeOrchestrator } = await import("./core/githubModeOrchestrator.js");
    try {
      const orchestrator = new GitHubModeOrchestrator(systemInstruction, filteredTools, pureMode, { configManager });
      await orchestrator.run();
    } finally {
      promptManager.saveCache();
      await mcpManager.shutdown();
    }
    return;
  }

  const chatManager = await createSession({
    ui: new TerminalUI(), configManager, systemInstruction, tools: filteredTools, pureMode,
  });

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
  writeSync(2, `Paser Mini error: ${err.message}\n`);
  logger.error("Critical Error:", err);
  process.exit(1);
});
