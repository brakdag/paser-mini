import { MockAssistant } from './smoke_test.js';
import { ChatManager } from '../core/chatManager.js';
import { TerminalUI } from '../core/terminalUI.js';
import { AVAILABLE_TOOLS } from '../tools/registry.js';
import * as fileTools from '../tools/fileTools.js';

async function runTest() {
  console.log('--- STARTING SMOKE TEST ---');

  // 1. Setup
  const ui = new TerminalUI({ noSpinner: true });
  const assistant = new MockAssistant();
  
  // Registrar herramientas básicas para el test
  Object.assign(AVAILABLE_TOOLS, { ...fileTools });

  const chatManager = new ChatManager(
    assistant,
    AVAILABLE_TOOLS,
    'Test System Instruction',
    ui
  );

  try {
    // 2. Ejecutar un turno
    console.log('Testing processTurn...');
    await chatManager.processTurn('Hello, can you check the main.js file?');
    
    console.log('\n--- SMOKE TEST PASSED ---');
    console.log('Flow: User -> MockAssistant (Tool Call) -> ExecutionEngine -> MockAssistant (Final Response)');
  } catch (e) {
    console.error('\n--- SMOKE TEST FAILED ---');
    console.error(e);
    process.exit(1);
  }
}

runTest();