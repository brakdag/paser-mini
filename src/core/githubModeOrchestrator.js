import * as githubTools from '../tools/githubTools.js';
import { GitHubUI } from './githubUI.js';
import { ChatManager } from './chatManager.js';
import { GeminiAdapter } from '../infrastructure/gemini/adapter.js';

export class GitHubModeOrchestrator {
  constructor(systemInstruction, tools) {
    this.systemInstruction = systemInstruction;
    this.tools = tools;
    this.processingLabel = 'paser-processing';
    this.triggerHashtag = '#ai-assistance';
    this.botLogin = null;
  }

  async run() {
    if (!this.botLogin) {
      const userData = await githubTools.get_authenticated_user();
      this.botLogin = userData.login;
    }
    const issues = await githubTools.listIssues();
    for (const issue of issues.filter(i => (i.body || '').includes(this.triggerHashtag) && !(i.labels || []).map(l => l.name).includes(this.processingLabel))) {
      await this.processIssue(issue);
    }
  }

  async processIssue(issue) {
    const { number: issueNumber, body: issueBody = '' } = issue;
    await githubTools.add_label({ issue_number: issueNumber, label: this.processingLabel });
    try {
      const ui = new GitHubUI(issueNumber);
      const chatManager = new ChatManager(new GeminiAdapter(), this.tools, this.systemInstruction, ui, true);
      await chatManager.run(`SYSTEM: GitHub Issue #${issueNumber}.\n${issueBody}`);
    } finally {
      await githubTools.remove_label({ issue_number: issueNumber, label: this.processingLabel });
    }
  }
}