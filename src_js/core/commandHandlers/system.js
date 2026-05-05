export class SystemCommands {
  static handleClear(ui) {
    process.stdout.write('\x1Bc');
    return true;
  }

  static handleExit(chatManager) {
    chatManager.shouldExit = true;
    console.log('Shutting down...');
    process.exit(0);
  }
}