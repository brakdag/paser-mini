import axios from "axios";
import axiosRetry from "axios-retry";
import GitTools from "./gitTools.js";

/**
 * Tools for interacting with the GitHub API.
 */
export default class GithubTools {
  #GITHUB_API_URL = "https://api.github.com";

  #client;

  #gitTools;

  /**
   * Initializes the GitHub API client with retry logic.
   */
  constructor() {
    this.#client = axios.create({
      baseURL: this.#GITHUB_API_URL,
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    axiosRetry(this.#client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      /**
       * Determines if a request should be retried.
       * @param {Error} error The error object from the failed request.
       * @returns {boolean} True if the request should be retried.
       */
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429,
    });

    this.#gitTools = new GitTools();
  }

  /**
   * Retrieves the authentication headers using the GITHUB_TOKEN environment variable.
   * @returns {Promise<{Authorization: string}>} The headers object.
   * @throws {Error} If GITHUB_TOKEN is not configured.
   */
  async #getHeaders() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN no configurado.");
    return { Authorization: `token ${token}` };
  }

  /**
   * Resolves a repository identifier to a standard "owner/repo" format.
   * @param {string} repo The repository URL or identifier.
   * @returns {string} The resolved repository name.
   */
  #resolveRepo(repo) {
    const raw = repo || "";
    return raw
      .replace("git@github.com:", "")
      .replace("https://github.com/", "")
      .replace(".git", "");
  }

  /**
   * Gets the details of the currently authenticated user.
   * @returns {Promise<object|string>} The user data or an error message.
   */
  async getAuthenticatedUser() {
    try {
      const headers = await this.#getHeaders();
      const response = await this.#client.get("/user", { headers });
      return response.data;
    } catch (e) {
      return `ERR: ${e.response?.data?.message || e.message}`;
    }
  }

  /**
   * Lists issues for a given repository.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @returns {Promise<Array|string>} A list of issues or an error message.
   */
  async listIssues(repo) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      const response = await this.#client.get(`/repos/${targetRepo}/issues`, {
        headers,
      });
      return response.data;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Creates a new issue in a repository.
   * @param {string} title The title of the issue.
   * @param {string} body The body text of the issue.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @returns {Promise<string>} A success message or an error message.
   */
  async createIssue(title, body, repo) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      const response = await this.#client.post(
        `/repos/${targetRepo}/issues`,
        { title, body },
        { headers },
      );
      return `Issue #${response.data.number} created successfully.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Edits an existing issue.
   * @param {number|string} issueNumber The issue number to edit.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @param {string} [title] The new title for the issue.
   * @param {string} [body] The new body for the issue.
   * @returns {Promise<string>} A success message or an error message.
   */
  async editIssue(issueNumber, repo, title, body) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      const data = {};
      if (title) data.title = title;
      if (body) data.body = body;
      await this.#client.patch(
        `/repos/${targetRepo}/issues/${issueNumber}`,
        data,
        {
          headers,
        },
      );
      return `Issue #${issueNumber} edited successfully.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Closes an existing issue.
   * @param {number|string} issueNumber The issue number to close.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @returns {Promise<string>} A success message or an error message.
   */
  async closeIssue(issueNumber, repo) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.patch(
        `/repos/${targetRepo}/issues/${issueNumber}`,
        { state: "closed" },
        { headers },
      );
      return `Issue #${issueNumber} closed successfully.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Posts a comment to an issue.
   * @param {number|string} issueNumber The issue number to comment on.
   * @param {string} body The content of the comment.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @returns {Promise<string>} A success message or an error message.
   */
  async postComment(issueNumber, body, repo) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.post(
        `/repos/${targetRepo}/issues/${issueNumber}/comments`,
        { body },
        { headers },
      );
      return `Comment posted to issue #${issueNumber}.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Adds a label to an issue.
   * @param {number|string} issueNumber The issue number to label.
   * @param {string} label The label to add.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @returns {Promise<string>} A success message or an error message.
   */
  async addLabel(issueNumber, label, repo) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.post(
        `/repos/${targetRepo}/issues/${issueNumber}/labels`,
        { labels: [label] },
        { headers },
      );
      return `Label '${label}' added to issue #${issueNumber}.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Removes a label from an issue.
   * @param {number|string} issueNumber The issue number to modify.
   * @param {string} label The label to remove.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @returns {Promise<string>} A success message or an error message.
   */
  async removeLabel(issueNumber, label, repo) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.delete(
        `/repos/${targetRepo}/issues/${issueNumber}/labels/${label}`,
        { headers },
      );
      return `Label '${label}' removed from issue #${issueNumber}.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  /**
   * Retrieves comments for a specific issue.
   * @param {number|string} issueNumber The issue number.
   * @param {string} [repo] The repository identifier. If omitted, the current repo is used.
   * @returns {Promise<Array|string>} A list of comments or an error message.
   */
  async getIssueComments(issueNumber, repo) {
    try {
      const targetRepo = repo
        ? this.#resolveRepo(repo)
        : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      const response = await this.#client.get(
        `/repos/${targetRepo}/issues/${issueNumber}/comments`,
        { headers },
      );
      return response.data;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }
}