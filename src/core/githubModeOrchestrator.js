import * as githubTools from "../tools/githubTools.js";
import GitHubUI from "./githubUI.js";
import ChatManager from "./chatManager.js";
import ConfigManager from "./configManager.js";
import ProviderManager from "../infrastructure/providerManager.js";

/**
 * Orchestrates the AI's interaction with GitHub issues, monitoring for specific hashtags
 * and processing issues using the ChatManager.
 */
class GitHubModeOrchestrator {
  /**
   * Initializes the GitHubModeOrchestrator.
   * @param {string} systemInstruction - The system prompt/instructions for the AI assistant.
   * @param {object} tools - The map of available tools for the AI to use.
   */
  constructor(systemInstruction, tools) {
    this.systemInstruction = systemInstruction;
    this.tools = tools;
    this.processingLabel = "paser-processing";
    this.triggerHashtag = "#ai-assistance";
    this.botLogin = null;
  }

  /**
   * Scans GitHub issues for the trigger hashtag and processes any that are not already being handled.
   * @returns {Promise<void>}
   */
  async run() {
    if (!this.botLogin) {
      const userData = await githubTools.get_authenticated_user();
      this.botLogin = userData.login;
    }
    const issues = await githubTools.listIssues();
    const filtered = issues.filter(
      (i) =>
        (i.body || "").includes(this.triggerHashtag) &&
        !(i.labels || []).some((l) => l.name === this.processingLabel),
    );

    await filtered.reduce(async (promise, issue) => {
      await promise;
      return this.processIssue(issue);
    }, Promise.resolve());
  }

  /**
   * Processes a single GitHub issue by adding a processing label, initializing a chat session,
   * and removing the label upon completion.
   * @param {object} issue - The GitHub issue object to process.
   * @returns {Promise<void>}
   */
  async processIssue(issue) {
    const { number: issueNumber, body: issueBody = "" } = issue;
    await githubTools.add_label({
      issue_number: issueNumber,
      label: this.processingLabel,
    });
    try {
      const configManager = new ConfigManager();
      const providerManager = new ProviderManager();
      const providerId = configManager.get("provider", "GEMINI");

      const ui = new GitHubUI(issueNumber);
      const assistant = await providerManager.createAdapter({
        providerId,
        ui,
        configManager,
        userNickname: "user",
        agentNickname: "assistant",
      });

      // Provide dummy identity objects to satisfy ChatManager requirements
      const user = { nickname: "user" };
      const model = { nickname: "assistant", temperature: 1.0, name: "model" };

      const chatManager = new ChatManager({
        assistant,
        tools: this.tools,
        systemInstruction: this.systemInstruction,
        ui,
        user,
        model,
        configManager,
      });

      await chatManager.run(
        `SYSTEM: GitHub Issue #${issueNumber}.\n${issueBody}`,
      );
    } finally {
      await githubTools.remove_label({
        issue_number: issueNumber,
        label: this.processingLabel,
      });
    }
  }
}

export default GitHubModeOrchestrator;