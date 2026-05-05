import 'dotenv/config';
import { Command } from 'commander';
import { GeminiAdapter } from './infrastructure/gemini/adapter.js';
import { NvidiaAdapter } from './infrastructure/nvidia/adapter.js';
import { TerminalUI } from './core/terminalUI.js';
import { ChatManager } from './core/chatManager.js';
import { ConfigManager } from './core/configManager.js';
import { SYSTEM_INSTRUCTION, AVAILABLE_TOOLS } from './tools/registry.js';
import * as fileTools from './tools/fileTools.js';
import * as gitTools from './tools/gitTools.js';
import * as githubTools from './tools/githubTools.js';
import * as memoryTools from './tools/memoryTools.js';
import * as jsonTools from './tools/jsonTools.js';
import * as searchTools from './tools/searchTools.js';
import * as utilTools from './tools/utilTools.js';
import * as systemTools from './tools/systemTools.js';
import * as instanceTools from './tools/instanceTools.js';

Object.assign(AVAILABLE_TOOLS, {
  ...fileTools,
  ...gitTools,
  ...githubTools,
  ...memoryTools,
  ...jsonTools,
  ...searchTools,
  ...utilTools,
  ...systemTools,
  ...instanceTools
});

async function main() {
  const program = new Command();

  program
    .name('paser-mini')
    .description('Minimalist Autonomous Agent (JS Port)')
    .option('-m, --message <message>', 'Initial message to send')
    .option('-si, --system-instruction <instruction>', 'Custom system instructions')
    .option('--github-mode', 'Run in GitHub mode: process issues with #ai-assistance')
    .parse(process.argv);

  const options = program.opts();
  const configManager = new ConfigManager();

  if (options.githubMode) {
    const { GitHubModeOrchestrator } = await import('./core/githubModeOrchestrator.js');
    const orchestrator = new GitHubModeOrchestrator(options.systemInstruction || SYSTEM_INSTRUCTION);
    await orchestrator.runForever();
    return;
  }

  const ui = new TerminalUI();
  
  // Selección dinámica de proveedor
  const provider = configManager.get('provider', 'Gemini');
  const assistant = provider === 'NVIDIA' ? new NvidiaAdapter() : new GeminiAdapter();
  
  const sysInstr = options.systemInstruction || SYSTEM_INSTRUCTION;

  const chatManager = new ChatManager(
    assistant,
    AVAILABLE_TOOLS,
    sysInstr,
    ui
  );
  
  // Inyectamos el configManager para que el chatManager pueda usarlo en los comandos
  chatManager.configManager = configManager;

  await chatManager.run(options.message);
}

main().catch(err => {
  console.error('Critical Error:', err);
  process.exit(1);
});