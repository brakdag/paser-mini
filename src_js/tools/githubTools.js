import axios from 'axios';
import axiosRetry from 'axios-retry';
import { getCurrentRepo } from './gitTools.js';

const GITHUB_API_URL = 'https://api.github.com';

const client = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    'Accept': 'application/vnd.github.v3+json'
  }
});

// Implementación de estrategia de reintentos similar a la de Python
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

async function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN no configurado.');
  return { 'Authorization': `token ${token}` };
}

function resolveRepo(repo) {
  let raw = repo || '';
  return raw.replace('git@github.com:', '').replace('https://github.com/', '').replace('.git', '');
}

export const get_authenticated_user = async () => {
  try {
    const headers = await getHeaders();
    const response = await client.get('/user', { headers });
    return response.data;
  } catch (e) {
    return `ERR: ${e.response?.data?.message || e.message}`;
  }
};

export const listIssues = async ({ repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    const response = await client.get(`/repos/${targetRepo}/issues`, { headers });
    return response.data;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const createIssue = async ({ title, body, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    const response = await client.post(`/repos/${targetRepo}/issues`, { title, body }, { headers });
    return `Issue #${response.data.number} created successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const editIssue = async ({ issue_number, repo = '', title, body }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    const data = {};
    if (title) data.title = title;
    if (body) data.body = body;
    await client.patch(`/repos/${targetRepo}/issues/${issue_number}`, data, { headers });
    return `Issue #${issue_number} edited successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const closeIssue = async ({ issue_number, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    await client.patch(`/repos/${targetRepo}/issues/${issue_number}`, { state: 'closed' }, { headers });
    return `Issue #${issue_number} closed successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const postComment = async ({ issue_number, body, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    await client.post(`/repos/${targetRepo}/issues/${issue_number}/comments`, { body }, { headers });
    return `Comment posted to issue #${issue_number}.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const add_label = async ({ issue_number, label, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    await client.post(`/repos/${targetRepo}/issues/${issue_number}/labels`, { labels: [label] }, { headers });
    return `Label '${label}' added to issue #${issue_number}.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const remove_label = async ({ issue_number, label, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    await client.delete(`/repos/${targetRepo}/issues/${issue_number}/labels/${label}`, { headers });
    return `Label '${label}' removed from issue #${issue_number}.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const get_issue_comments = async ({ issue_number, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await getCurrentRepo());
    const headers = await getHeaders();
    const response = await client.get(`/repos/${targetRepo}/issues/${issue_number}/comments`, { headers });
    return response.data;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};