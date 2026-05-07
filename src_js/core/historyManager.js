import { logger } from './logger.js';

export class HistoryManager {
  constructor(assistant, ui, configManager) {
    this.assistant = assistant;
    this.ui = ui;
    this.configManager = configManager;
  }

  async prepareCompaction() {
    try {
      const fs = await import('fs/promises');
      let logContent = '';
      try {
        logContent = await fs.readFile('session.log', 'utf8');
      } catch (e) {
        this.ui.displayError('No log file found to compact.');
        return null;
      }
      
      if (!logContent || logContent.trim() === '') {
        return null;
      }

      const log = `--- Session History Compaction ---\n${logContent}\n--- End of Compaction ---`;

      // El ChatManager se encargará de llamar a assistant.hardReset()
      // y de enviar el prompt para mantener la responsabilidad del flujo en el orquestador.
      return {
        prompt: `The following is a log of our previous conversation for context:\n\n${log}\n\nContinue from here.`,
        type: 'compaction'
      };
    } catch (e) {
      logger.error('Error preparing compaction', { error: e.message });
      this.ui.displayError('Error during compaction preparation: ' + e.message);
      return null;
    }
  }
}