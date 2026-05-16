import { logger } from "./logger.js";

export class HistoryManager {
  constructor(assistant, ui, configManager) {
    this.assistant = assistant;
    this.ui = ui;
    this.configManager = configManager;
  }

  async prepareCompaction() {
    try {
      const fs = await import("fs/promises");
      let logContent = "";
      try {
        logContent = await fs.readFile("log/session.log", "utf8");
      } catch (e) {
        this.ui.displayError("No log file found to compact.");
        return null;
      }

      if (!logContent || logContent.trim() === "") {
        return null;
      }

      let processedLog = logContent;
      if (this.ui.renderingMode === "CLEAN") {
        processedLog = logContent.replace(
          /^\[\d{2}:\d{2}\]\s*<[^>]+>\s*/gm,
          "",
        );
      }
      const log = `--- Session History Compaction ---\n${processedLog}\n--- End of Compaction ---`;

      // ChatManager will be responsible for calling assistant.hardReset()
      // and sending the prompt to keep flow responsibility within the orchestrator.
      return {
        prompt: `The following is a log of our previous conversation for context:\n\n${log}\n\nContinue from here.`,
        type: "compaction",
      };
    } catch (e) {
      logger.error("Error preparing compaction", { error: e.message });
      this.ui.displayError(`Error during compaction preparation: ${e.message}`);
      return null;
    }
  }
}
