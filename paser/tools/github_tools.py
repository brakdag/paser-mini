import os
import requests
from paser.tools.git_tools import get_remote_repo

GITHUB_API_URL = "https://api.github.com"

def _get_headers():
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN no configurado en el entorno.")
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

def _resolve_repo(repo: str) -> str:
    return repo if repo else get_remote_repo()

def list_issues(repo: str = ""):
    """Lista los issues abiertos de un repositorio (formato 'usuario/repo')."""
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def create_issue(title: str, body: str, repo: str = ""):
    """Crea un nuevo issue en el repositorio."""
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues"
    data = {"title": title, "body": body}
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()

def close_issue(issue_number: int, repo: str = ""):
    """Cierra un issue existente."""
    headers = _get_headers()
    target_repo = _resolve_repo(repo)
    url = f"{GITHUB_API_URL}/repos/{target_repo}/issues/{issue_number}"
    data = {"state": "closed"}
    response = requests.patch(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()