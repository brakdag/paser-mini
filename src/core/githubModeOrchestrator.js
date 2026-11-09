import { createHash } from "node:crypto";
import GithubTools from "../tools/githubTools.js";
import GitHubUI from "./githubUI.js";
import ConfigManager from "./configManager.js";
import createSession from "./sessionFactory.js";

/**
 * Processes a finite snapshot of triggered issues, recording completed input versions.
 */
class GitHubModeOrchestrator {
  /**
   * Initializes the finite GitHub runner with injectable external dependencies.
   * @param {string} systemInstruction - The session prompt.
   * @param {object} tools - Available tools.
   * @param {boolean} [pureMode] - Whether tools are disabled.
   * @param {object} [options] - Client, configuration and session factory overrides.
   * @param {object} [options.githubApi] - GitHub API client.
   * @param {object} [options.configManager] - Configuration storage.
   * @param {(options: object) => Promise<object>} [options.sessionFactory] - Configured session factory.
   * @param {string|null} [options.repo] - Explicit target repository.
   */
  constructor(systemInstruction, tools, pureMode = false, {
    githubApi = new GithubTools(), configManager = null, sessionFactory = createSession, repo = null,
  } = {}) {
    this.systemInstruction = systemInstruction;
    this.tools = tools;
    this.pureMode = pureMode;
    this.githubApi = githubApi;
    this.configManager = configManager;
    this.sessionFactory = sessionFactory;
    this.repo = repo;
    this.processingLabel = "paser-processing";
    this.triggerHashtag = "#ai-assistance";
    this.botLogin = null;
    this.activeIssues = new Set();
  }

  /**
   * Takes one snapshot and attempts each eligible issue once; no polling is started.
   * @returns {Promise<void>} Resolves after all issues and publications settle.
   */
  async run() {
    this.botLogin = (await this.githubApi.getAuthenticatedUser()).login;
    const issues = await this.githubApi.listIssues(this.repo);
    const failures = [];
    for (let index = 0; index < issues.length; index += 1) {
      const issue = issues[index];
      if (!issue.pull_request && issue.state !== "closed" &&
          (issue.body || "").includes(this.triggerHashtag) &&
          !(issue.labels || []).some((label) => (label.name || label) === this.processingLabel)) {
        try {
          await this.processIssue(issue);
        } catch (error) {
          failures.push(error);
        }
      }
    }
    if (failures.length) throw new AggregateError(failures, "GitHub issue processing failed");
  }

  /**
   * Runs one issue turn, publishes completion or error, and always releases its label.
   * Completion receipts prevent repeating unchanged inputs across invocations.
   * Labels are advisory and do not provide a distributed lock.
   * @param {object} issue - The issue to process.
   * @returns {Promise<void>} Resolves after comment publication and label removal.
   */
  async processIssue(issue) {
    const { number } = issue;
    if (this.activeIssues.has(number)) return;
    this.activeIssues.add(number);
    let labeled = false;
    const failures = [];
    try {
      if (!this.botLogin) this.botLogin = (await this.githubApi.getAuthenticatedUser()).login;
      const comments = await this.githubApi.getIssueComments(number, this.repo);
      const inputs = comments.filter((comment) => comment.user?.login !== this.botLogin);
      const version = createHash("sha256").update(JSON.stringify([
        issue.title || "", issue.body || "", inputs.map((comment) => [comment.id, comment.body || ""]),
      ])).digest("hex");
      const marker = `<!-- paser-mini:completed:${version} -->`;
      if (comments.some((comment) => comment.user?.login === this.botLogin && (comment.body || "").includes(marker))) return;
      await this.githubApi.addLabel(number, this.processingLabel, this.repo);
      labeled = true;
      const ui = new GitHubUI(number, this.repo, this.githubApi);
      const session = await this.sessionFactory({
        ui, configManager: this.configManager || new ConfigManager(),
        systemInstruction: this.systemInstruction, tools: this.tools, pureMode: this.pureMode,
        instanceMode: true,
      });
      const discussion = inputs.map((comment) => `${comment.user?.login || "user"}: ${comment.body || ""}`).join("\n\n");
      await session.runOnce(`GitHub Issue #${number}: ${issue.title || ""}\n${issue.body || ""}\n\n${discussion}`);
      await ui.flush();
      await this.githubApi.postComment(number, `Processing completed.\n\n${marker}`, this.repo);
    } catch (error) {
      failures.push(error);
      try {
        await this.githubApi.postComment(number, `Paser Mini could not complete this issue: ${error.message}`, this.repo);
      } catch (publicationError) {
        failures.push(publicationError);
      }
    } finally {
      if (labeled) {
        try {
          await this.githubApi.removeLabel(number, this.processingLabel, this.repo);
        } catch (labelError) {
          failures.push(labelError);
        }
      }
      this.activeIssues.delete(number);
    }
    if (failures.length) throw new AggregateError(failures, `Issue #${number} failed`);
  }
}

export default GitHubModeOrchestrator;
