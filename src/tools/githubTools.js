import axios from "axios";
import axiosRetry from "axios-retry";
import { getCurrentRepo } from "./gitTools";

const GITHUB_API_URL = "https://api.github.com";

const client = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    Accept: "application/vnd.github.v3+json",
  },
});

// Implementación de estrategia de reintentos similar a la de Python
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status === 429,
});

async function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN no configurado.");
  return { Authorization: `token ${token}` };
}

function resolveRepo(repo) {
  const raw = repo || "";
  return raw
    .replace("git@github.com:", "")
    .replace("https://github.com/", "")
    .replace(".git", "");
}

export const getAuthenticatedUser = async () => {
  try {
    const headers = await getHeaders();
    const response = await client.get("/user", { headers });
    return response.data;
  } catch (e) {
    return `ERR: ${e.response?.data?.message || e.message}`;
  }
};

export const listIssues = async ({ repo = "" }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    const response = await client.get(`/repos/${targetRepo}/issues`, {
      headers,
    });
    return response.data;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const createIssue = async ({ title, body, repo = "" }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    const response = await client.post(
      `/repos/${targetRepo}/issues`,
      { title, body },
      { headers },
    );
    return `Issue #${response.data.number} created successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const editIssue = async ({ issueNumber, repo = "", title, body }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    const data = {};
    if (title) data.title = title;
    if (body) data.body = body;
    await client.patch(`/repos/${targetRepo}/issues/${issueNumber}`, data, {
      headers,
    });
    return `Issue #${issueNumber} edited successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const closeIssue = async ({ issueNumber, repo = "" }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    await client.patch(
      `/repos/${targetRepo}/issues/${issueNumber}`,
      { state: "closed" },
      { headers },
    );
    return `Issue #${issueNumber} closed successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const postComment = async ({ issueNumber, body, repo = "" }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    await client.post(
      `/repos/${targetRepo}/issues/${issueNumber}/comments`,
      { body },
      { headers },
    );
    return `Comment posted to issue #${issueNumber}.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const addLabel = async ({ issueNumber, label, repo = "" }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    await client.post(
      `/repos/${targetRepo}/issues/${issueNumber}/labels`,
      { labels: [label] },
      { headers },
    );
    return `Label '${label}' added to issue #${issueNumber}.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const removeLabel = async ({ issueNumber, label, repo = "" }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    await client.delete(
      `/repos/${targetRepo}/issues/${issueNumber}/labels/${label}`,
      { headers },
    );
    return `Label '${label}' removed from issue #${issueNumber}.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const getIssueComments = async ({ issueNumber, repo = "" }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : await getCurrentRepo();
    const headers = await getHeaders();
    const response = await client.get(
      `/repos/${targetRepo}/issues/${issueNumber}/comments`,
      { headers },
    );
    return response.data;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};
