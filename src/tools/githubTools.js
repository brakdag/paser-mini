import axios from "axios";
import axiosRetry from "axios-retry";
import { GitTools } from "./gitTools.js";

export default class GithubTools {
  #GITHUB_API_URL = "https://api.github.com";
  #client;
  #gitTools;

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
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429,
    });
    
    this.#gitTools = new GitTools();
  }

  async #getHeaders() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN no configurado.");
    return { Authorization: `token ${token}` };
  }

  #resolveRepo(repo) {
    const raw = repo || "";
    return raw
      .replace("git@github.com:", "")
      .replace("https://github.com/", "")
      .replace(".git", "");
  }

  async getAuthenticatedUser() {
    try {
      const headers = await this.#getHeaders();
      const response = await this.#client.get("/user", { headers });
      return response.data;
    } catch (e) {
      return `ERR: ${e.response?.data?.message || e.message}`;
    }
  }

  async listIssues({ repo = "" }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      const response = await this.#client.get(`/repos/${targetRepo}/issues`, {
        headers,
      });
      return response.data;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async createIssue({ title, body, repo = "" }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
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

  async editIssue({ issueNumber, repo = "", title, body }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      const data = {};
      if (title) data.title = title;
      if (body) data.body = body;
      await this.#client.patch(`/repos/${targetRepo}/issues/${issue_number}`, data, {
        headers,
      });
      return `Issue #${issue_number} edited successfully.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async closeIssue({ issue_number, repo = "" }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.patch(
        `/repos/${targetRepo}/issues/${issue_number}`,
        { state: "closed" },
        { headers },
      );
      return `Issue #${issue_number} closed successfully.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async postComment({ issue_number, body, repo = "" }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.post(
        `/repos/${targetRepo}/issues/${issue_number}/comments`,
        { body },
        { headers },
      );
      return `Comment posted to issue #${issue_number}.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async addLabel({ issue_number, label, repo = "" }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.post(
        `/repos/${targetRepo}/issues/${issue_number}/labels`,
        { labels: [label] },
        { headers },
      );
      return `Label '${label}' added to issue #${issue_number}.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async removeLabel({ issue_number, label, repo = "" }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      await this.#client.delete(
        `/repos/${targetRepo}/issues/${issue_number}/labels/${label}`,
        { headers },
      );
      return `Label '${label}' removed from issue #${issue_number}.`;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }

  async getIssueComments({ issue_number, repo = "" }) {
    try {
      const targetRepo = repo ? this.#resolveRepo(repo) : await this.#gitTools.getCurrentRepo();
      const headers = await this.#getHeaders();
      const response = await this.#client.get(
        `/repos/${targetRepo}/issues/${issue_number}/comments`,
        { headers },
      );
      return response.data;
    } catch (e) {
      return `ERR: ${e.message}`;
    }
  }
}
