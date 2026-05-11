import { MementoManager } from '../../infrastructure/memento/manager.js';

export class SystemCommands {
  static handleClear(ui) {
    process.stdout.write('\x1Bc');
    return true;
  }

  static handleExit(chatManager) {
    chatManager.shouldExit = true;
    process.exit(0);
  }

  static async handleReset(chatManager, ui) {
    ui.displayInfo('Performing Hard Reset (The Leap)...');
    const manager = new MementoManager();
    const bridge = await manager.pullMemory('bridge', null, 'next');
    let newHistory = [];
    if (bridge) {
      const bridgeMsg = `[MEMENTO LEAP: RESTORED SESSION STATE]\nNode #${bridge.id} | ${bridge.content}`;
      newHistory.push({ role: 'user', parts: [{ text: bridgeMsg }] });
      ui.displayInfo(`Bridge Block #${bridge.id} restored.`);
    } else {
      ui.displayInfo('No Bridge Block found. Starting fresh.');
    }
    chatManager.assistant.hardReset(newHistory);
    return true;
  }

  static async handleKick(chatManager, ui) {
    ui.displaySystemMessage('*** Agent kicked. Session wiped. Restarting...');
    chatManager.assistant.hardReset();
    ui.clearLog();
    ui.displayLogOpened();
    return true;
  }

  static handleEnableBash(chatManager, ui) {
    ui.bashEnabled = true;
    ui.displayInfo('Bash access enabled. You can now use executeBash.');
    const bashInstruction = 'SYSTEM UPDATE: Bash access has been enabled. ' +
      'You now have access to the tool `executeBash(command: string)`, ' +
      'which allows you to execute shell commands in the project root.';
    const content = ui.renderingMode === 'FOUNTAIN' 
      ? ui._renderFountain('system', bashInstruction) 
      : bashInstruction;
    chatManager.assistant.injectMessage('server', content);
    return true;
  }
}