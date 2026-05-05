import * as githubTools from '../tools/githubTools.js';
import { GitHubUI } from './githubUI.js';
import { ChatManager } from './chatManager.js';
import { GeminiAdapter } from '../infrastructure/gemini/adapter.js';
import { AVAILABLE_TOOLS } from '../tools/registry.js';

export class GitHubModeOrchestrator {
  constructor(systemInstruction) {
    this.systemInstruction = systemInstruction;
    this.processingLabel = 'paser-processing';
    this.triggerHashtag = '#ai-assistance';
    this.botLogin = null;
  }

  async run() {
    console.log('Scanning GitHub for eligible issues...');
    try {
      if (!this.botLogin) {
        const userData = await githubTools.get_authenticated_user();
        this.botLogin = userData.login;
        console.log(`Authenticated as bot: ${this.botLogin}`);
      }

      const issues = await githubTools.list_issues();
      const eligibleIssues = this._filterIssues(issues);

      if (eligibleIssues.length === 0) {
        console.log('No eligible issues found.');
        return;
      }

      for (const issue of eligibleIssues) {
        await this.processIssue(issue);
      }
    } catch (e) {
      console.error(`Error during GitHub scan cycle: ${e.message}`);
    }
  }

  async runForever(interval = 60) {
    console.log(`Entering Continuous Daemon Mode (Interval: ${interval}s)...`);
    while (true) {
      try {
        await this.run();
      } catch (e) {
        console.error(`Unexpected error in daemon loop: ${e.message}`);
      }
      console.log(`Cycle complete. Sleeping for ${interval} seconds...`);
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    }
  }

  _filterIssues(issues) {
    return issues.filter(issue => {
      const body = issue.body || '';
      const labels = (issue.labels || []).map(l => l.name);
      return body.includes(this.triggerHashtag) && !labels.includes(this.processingLabel);
    });
  }

  async processIssue(issue) {
    const issueNumber = issue.number;
    const issueBody = issue.body || '';

    console.log(`Processing issue #${issueNumber}...`);

    try {
      // 1. Mark as processing
      await githubTools.add_label({ issue_number: issueNumber, label: this.processingLabel });

      // 2. Consume trigger hashtag
      const newBody = issueBody.replace(this.triggerHashtag, '').trim();
      if (newBody !== issueBody) {
        await githubTools.edit_issue({ issue_number: issueNumber, body: newBody });
      }

      // 3. Setup Agent
      const ui = new GitHubUI(issueNumber);
      const assistant = new GeminiAdapter();
      const chatManager = new ChatManager(
        assistant,
        AVAILABLE_TOOLS,
        this.systemInstruction,
        ui,
        true // instanceMode
      );

      const lastCommentId = await this._getLastCommentId(issueNumber);

      const initialPrompt = `SYSTEM: You have been assigned to GitHub Issue #${issueNumber}.\nIssue Description: ${issueBody}\n\nPlease acknowledge the request, analyze the problem, and provide a detailed plan of action to the user via a comment on this issue. Do NOT create new issues.`;

      // Ejecutamos el chat en una promesa separada para poder monitorear comentarios
      const runPromise = chatManager.run(initialPrompt);

      while (!runPromise.status === 'fulfilled') {
        const commentData = await this._waitForComment(issueNumber, lastCommentId);
        if (commentData) {
          const [newComment, newId] = commentData;
          console.log(`User feedback received on issue #${issueNumber}. Interrupting...`);
          
          chatManager.stopExecution();
          // Inyectamos el comentario en el flujo del chat
          await chatManager.processTurn(new_comment);
        }
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      await runPromise;
    } catch (e) {
      console.error(`Error processing issue #${issueNumber}: ${e.message}`);
      await githubTools.post_comment({ issue_number: issueNumber, body: `Error: ${e.message}` });
    } finally {
      try {
        await githubTools.remove_label({ issue_number: issueNumber, label: this.processingLabel });
      } catch (e) {
        console.error(`Failed to remove label from issue #${issueNumber}: ${e.message}`);
      }
    }
  }

  async _getLastCommentId(issueNumber) {
    const comments = await githubTools.get_issue_comments({ issue_number: issueNumber });
    if (!comments || comments.length === 0) return 0;
    return comments[comments.length - 1].id;
  }

  async _waitForComment(issueNumber, lastId) {
    try {
      const comments = await githubTools.get_issue_comments({ issue_number: issueNumber });
      if (!comments) return null;

      const humanComments = comments.filter(c => c.user.login !== this.botLogin);
      if (humanComments.length > 0 && humanComments[humanComments.length - 1].id > lastId) {
        const lastComment = humanComments[humanComments.length - 1];
        if (lastComment.body.includes(`@${this.botLogin}`)) {
          return [lastComment.body, lastComment.id];
        }
      }
    } catch (e) {
      console.error(`Error polling comments: ${e.message}`);
    }
    return null;
  }
}