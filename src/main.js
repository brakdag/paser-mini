import "dotenv/config";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import parseCliOptions from "./core/cliOptions.js";
import TerminalUI from "./core/terminalUI.js";
import createSession from "./core/sessionFactory.js";
import ConfigManager from "./core/configManager.js";
import promptManager from "./core/systemPromptManager.js";
import mcpManager from "./infrastructure/McpManager.js";
import { shutdownTools } from "./infrastructure/registry.js";
import logger from "./core/logger.js";
import ApplicationLifecycle, { runProcess } from "./core/applicationLifecycle.js";

/**
 * Starts one CLI session. The owner also covers failures during startup.
 * @param {ApplicationLifecycle} lifecycle - Application resource owner.
 * @returns {Promise<void>} Session completion.
 */
export default async function main(lifecycle) {
  const options = parseCliOptions();
  lifecycle.own(() => promptManager.saveCache());
  lifecycle.own(() => mcpManager.shutdown());
  lifecycle.own(() => shutdownTools(true));
  logger.start();
  const configManager = new ConfigManager();
  configManager.migrateGlobalKeys();
  const { systemInstruction, filteredTools, pureMode } = await promptManager.buildPrompt(options);
  if (lifecycle.closing) return;

  if (options.githubMode) {
    const { default: GitHubModeOrchestrator } = await import("./core/githubModeOrchestrator.js");
    if (lifecycle.closing) return;
    const orchestrator = new GitHubModeOrchestrator(systemInstruction, filteredTools, pureMode, { configManager });
    let githubRun;
    /**
     * Cancels the active issue and waits for final GitHub publications.
     * @returns {Promise<void>} The runner has stopped.
     */
    const closeGitHub = async () => { orchestrator.close(); await githubRun; };
    lifecycle.own(closeGitHub);
    githubRun = orchestrator.run();
    await githubRun;
    return;
  }

  const ui = new TerminalUI();
  lifecycle.own(() => ui.close());
  const chatManager = await createSession({
    ui, configManager, systemInstruction, tools: filteredTools, pureMode,
  });
  if (lifecycle.closing) { chatManager.requestExit(); return; }
  let running;
  /**
   * Cancels the turn before waiting for its final publications.
   * @returns {Promise<void>} Final publications are settled.
   */
  const closeSession = async () => { chatManager.requestExit(); await running; };
  lifecycle.own(closeSession);
  logger.info("Startup: Initialization complete. Handing off to ChatManager.\n");
  running = chatManager.run(options.message);
  await running;
}

// Importing the entry point is inert; process termination belongs to the executable.
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @returns {Promise<void>} Buffered session events have been written. */
  const flush = () => logger.shutdownStreams();
  const lifecycle = new ApplicationLifecycle({ flush });
  /** @returns {Promise<void>} CLI session completion. */
  const start = () => main(lifecycle);
  const code = await runProcess(start, lifecycle);
  process.exit(code);
}
