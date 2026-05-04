import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from . import ToolError
from .git_tools import get_current_repo


GITHUB_API_URL = "https://api.github.com"


def _get_session():
    """
    Creates a requests session with a retry strategy for transient server errors.
    """
    session = requests.Session()
    retry_strategy = Retry(
        total=3, # Total number of retries
        backoff_factor=1, # Wait 1s, 2s, 4s between retries
        status_forcelist=[429, 500, 502, 503, 504], # Retry on these status codes
        allowed_methods=["HEAD", "GET", "POST", "PUT", "PATCH", "DELETE"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


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
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues"
    response = session.get(url, headers=headers)
    response.raise_for_status()
    return response.json()


def create_issue(title: str, body: str, repo: str = ""):
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues"
    response = session.post(url, headers=headers, json={"title": title, "body": body})
    response.raise_for_status()
    data = response.json()
    return f"Issue #{data['number']} created successfully."


def edit_issue(issue_number: int, repo: str = "", title: str = None, body: str = None):
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}"
    data = {k: v for k, v in {"title": title, "body": body}.items() if v}
    response = session.patch(url, headers=headers, json=data)
    response.raise_for_status()
    return f"Issue #{issue_number} edited successfully."


def close_issue(issue_number: int, repo: str = ""):
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}"
    response = session.patch(url, headers=headers, json={"state": "closed"})
    response.raise_for_status()
    return f"Issue #{issue_number} closed successfully."


def post_comment(issue_number: int, body: str, repo: str = ""):
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}/comments"
    response = session.post(url, headers=headers, json={"body": body})
    response.raise_for_status()
    return f"Comment posted to issue #{issue_number}."


def add_label(issue_number: int, label: str, repo: str = ""):
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}/labels"
    response = session.post(url, headers=headers, json={"labels": [label]})
    response.raise_for_status()
    return f"Label '{label}' added to issue #{issue_number}."


def remove_label(issue_number: int, label: str, repo: str = ""):
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}/labels/{label}"
    response = session.delete(url, headers=headers)
    response.raise_for_status()
    return f"Label '{label}' removed from issue #{issue_number}."


def get_issue_comments(issue_number: int, repo: str = ""):
    session = _get_session()
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}/comments"
    response = session.get(url, headers=headers)
    response.raise_for_status()
    return response.json()