import axios from 'axios';
import { get_current_repo } from './gitTools.js';

const GITHUB_API_URL = 'https://api.github.com';

async function request(method, endpoint, data = null) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN no configurado.');

  const config = {
    method,
    url: `${GITHUB_API_URL}${endpoint}`,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    data
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

function resolveRepo(repo) {
  // Nota: get_current_repo es async, así que el llamador debe manejar la resolución
  // Para simplificar, resolveRepo aquí asume que ya recibió el string del repo
  let raw = repo || '';
  return raw.replace('git@github.com:', '').replace('https://github.com/', '').replace('.git', '');
}

export const list_issues = async ({ repo = '' }) => {
  try {
    // Intentamos obtener el repo actual si no se provee uno
    const targetRepo = repo ? resolveRepo(repo) : (await get_current_repo());
    return await request('GET', `/repos/${targetRepo}/issues`);
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const create_issue = async ({ title, body, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await get_current_repo());
    const data = await request('POST', `/repos/${targetRepo}/issues`, { title, body });
    return `Issue #${data.number} created successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const edit_issue = async ({ issue_number, repo = '', title, body }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await get_current_repo());
    const data = {};
    if (title) data.title = title;
    if (body) data.body = body;
    await request('PATCH', `/repos/${targetRepo}/issues/${issue_number}`, data);
    return `Issue #${issue_number} edited successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const close_issue = async ({ issue_number, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await get_current_repo());
    await request('PATCH', `/repos/${targetRepo}/issues/${issue_number}`, { state: 'closed' });
    return `Issue #${issue_number} closed successfully.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const post_comment = async ({ issue_number, body, repo = '' }) => {
  try {
    const targetRepo = repo ? resolveRepo(repo) : (await get_current_repo());
    await request('POST', `/repos/${targetRepo}/issues/${issue_number}/comments`, { body });
    return `Comment posted to issue #${issue_number}.`;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};