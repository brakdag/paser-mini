import os
import requests
from paser.tools.core_tools import ToolError
from paser.tools.git_tools import get_current_repo
from paser.tools.system_tools import notify_user

GITHUB_API_URL = "https://api.github.com"

def _get_headers():
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ToolError("GITHUB_TOKEN no configurado.")
    return {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}

def _resolve_repo(repo: str) -> str:
    raw = repo if repo else get_current_repo()
    raw = raw.replace("git@github.com:", "").replace("https://github.com/", "").replace(".git", "")
    return raw

def list_issues(repo: str = ""):
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def create_issue(title: str, body: str, repo: str = ""):
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues"
    response = requests.post(url, headers=headers, json={"title": title, "body": body})
    response.raise_for_status()
    data = response.json()
    return f"Issue #{data['number']} created successfully."

def edit_issue(issue_number: int, repo: str = "", title: str = None, body: str = None):
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}"
    data = {k: v for k, v in {"title": title, "body": body}.items() if v}
    response = requests.patch(url, headers=headers, json=data)
    response.raise_for_status()
    return f"Issue #{issue_number} edited successfully."

def close_issue(issue_number: int, repo: str = ""):
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}"
    response = requests.patch(url, headers=headers, json={"state": "closed"})
    response.raise_for_status()
    return f"Issue #{issue_number} closed successfully."