import "dotenv/config";
import fs from "fs";
import { Command } from "commander";
import GeminiAdapter from "./infrastructure/gemini/adapter.js";
import NvidiaAdapter from "./infrastructure/nvidia/adapter.js";
import TerminalUI from "./core/terminalUI.js";
import ChatManager from "./core/chatManager.js";
import ConfigManager from "./core/configManager.js";
import { SYSTEM_INSTRUCTION, AVAILABLE_TOOLS } from "./tools/registry.js";
import * as memoryTools from "./tools/memoryTools.js";

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
    const tools = options.noSystemInstruction ? {} : AVAILABLE_TOOLS;
    const orchestrator = new GitHubModeOrchestrator(
      options.noSystemInstruction
        ? ""
        : options.systemInstruction || SYSTEM_INSTRUCTION,
      tools,
    );
    await orchestrator.runForever();
    return;
  }

  const ui = new TerminalUI();

  const provider = configManager.get("provider", "Gemini");
  const userNick = configManager.get("user_nickname", "user");
  const agentNick = configManager.get("agent_nickname", "assistant");
  const assistant =
    provider === "NVIDIA"
      ? new NvidiaAdapter(configManager, userNick, agentNick)
      : new GeminiAdapter(ui, userNick, agentNick);

  let sysInstr = "";
  if (!options.noSystemInstruction) {
    const baseInstr = options.systemInstruction || SYSTEM_INSTRUCTION;
    let injection = "";

    if (options.injectSystemInstruction) {
      injection = options.injectSystemInstruction;
    } else if (options.fileSystemInstruction) {
      try {
        injection = fs.readFileSync(options.fileSystemInstruction, "utf8");
      } catch (e) {
        console.error(`Error reading instruction file: ${e.message}`);
        process.exit(1);
      }
    }

    sysInstr = injection
      ? `IDENTITY AND PERSONA:\n${injection}\n\nCORE OPERATIONAL PROTOCOLS:\n${baseInstr}`
      : baseInstr;
  }

  const chatManager = new ChatManager(
    assistant,
    options.noSystemInstruction ? {} : AVAILABLE_TOOLS,
    sysInstr,
    ui,
  );

  chatManager.configManager = configManager;

  memoryTools.setMemoryContext(assistant, chatManager);
  await chatManager.run(options.message);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

main().catch((err) => {
  console.error("Critical Error:", err);
  process.exit(1);
});
