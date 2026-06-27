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
   * Initializes the GithubTools instance and configures the axios client with retry logic.
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
       * Determines if the request should be retried based on the error.
       * @param {Error} error - The error object encountered during the request.
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
    if (!token) {
    throw new Error("GITHUB_TOKEN no configurado.");
  }
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
   * Prepares the repository identifier and authentication headers for a request.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<{targetRepo: string, headers: object}>} The prepared request data.
   */
  async #prepareRequest(repo) {
    const targetRepo = repo
      ? this.#resolveRepo(repo)
      : await this.#gitTools.getCurrentRepo();

    if (!targetRepo) {
      throw new Error("Could not resolve target repository.");
    }

    const headers = await this.#getHeaders();
    return { targetRepo, headers };
  }

  /**
   * Gets the details of the currently authenticated user.
   * @returns {Promise<object>} The user data.
   */
  async getAuthenticatedUser() {
    const headers = await this.#getHeaders();
    const response = await this.#client.get("/user", { headers });
    return response.data;
  }

  /**
   * Lists issues for a given repository.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<Array>} A list of issues.
   */
  async listIssues(repo) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);
    const response = await this.#client.get(`/repos/${targetRepo}/issues`, { headers });
    return response.data;
  }

  /**
   * Creates a new issue in a repository.
   * @param {string} title The title of the issue.
   * @param {string} body The body text of the issue.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<string>} A success message.
   */
  async createIssue(title, body, repo) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);
    const response = await this.#client.post(
      `/repos/${targetRepo}/issues`,
      { title, body },
      { headers },
    );
    return `Issue #${response.data.number} created successfully.`;
  }

  /**
   * Edits an existing issue.
   * @param {number|string} issueNumber The issue number to edit.
   * @param {string} [repo] The repository identifier.
   * @param {string} [title] The new title for the issue.
   * @param {string} [body] The new body for the issue.
   * @returns {Promise<string>} A success message.
   */
  async editIssue(issueNumber, repo, title, body) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);
    const data = {};
    if (title) {
    data.title = title;
  }
    if (body) {
    data.body = body;
  }

    await this.#client.patch(
      `/repos/${targetRepo}/issues/${issueNumber}`,
      data,
      { headers },
    );
    return `Issue #${issueNumber} edited successfully.`;
  }

  /**
   * Closes an existing issue.
   * @param {number|string} issueNumber The issue number to close.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<string>} A success message.
   */
  async closeIssue(issueNumber, repo) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);
    await this.#client.patch(
      `/repos/${targetRepo}/issues/${issueNumber}`,
      { state: "closed" },
      { headers },
    );
    return `Issue #${issueNumber} closed successfully.`;
  }

  /**
   * Posts a comment to an issue.
   * @param {number|string} issueNumber The issue number to comment on.
   * @param {string} body The content of the comment.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<string>} A success message.
   */
  async postComment(issueNumber, body, repo) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);

    const cleanIssueNumber = String(issueNumber).replace(/\D/g, '');
    if (!cleanIssueNumber) {
    throw new Error("Invalid issue number provided.");
  }

    if (!body || typeof body !== 'string' || body.trim() === '') {
      throw new Error("Comment body must be a non-empty string.");
    }

    await this.#client.post(
      `/repos/${targetRepo}/issues/${cleanIssueNumber}/comments`,
      { body: body.trim() },
      { headers },
    );
    return `Comment posted to issue #${cleanIssueNumber}.`;
  }

  /**
   * Adds a label to an issue.
   * @param {number|string} issueNumber The issue number to label.
   * @param {string} label The label to add.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<string>} A success message.
   */
  async addLabel(issueNumber, label, repo) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);
    await this.#client.post(
      `/repos/${targetRepo}/issues/${issueNumber}/labels`,
      { labels: [label] },
      { headers },
    );
    return `Label '${label}' added to issue #${issueNumber}.`;
  }

  /**
   * Removes a label from an issue.
   * @param {number|string} issueNumber The issue number to modify.
   * @param {string} label The label to remove.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<string>} A success message.
   */
  async removeLabel(issueNumber, label, repo) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);
    await this.#client.delete(
      `/repos/${targetRepo}/issues/${issueNumber}/labels/${label}`,
      { headers },
    );
    return `Label '${label}' removed from issue #${issueNumber}.`;
  }

  /**
   * Retrieves comments for a specific issue.
   * @param {number|string} issueNumber The issue number.
   * @param {string} [repo] The repository identifier.
   * @returns {Promise<Array>} A list of comments.
   */
  async getIssueComments(issueNumber, repo) {
    const { targetRepo, headers } = await this.#prepareRequest(repo);
    const response = await this.#client.get(
      `/repos/${targetRepo}/issues/${issueNumber}/comments`,
      { headers },
    );
    return response.data;
  }
}