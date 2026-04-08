import os
import requests

GITHUB_API_URL = "https://api.github.com"

def _get_headers():
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN no configurado en el entorno.")
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

def list_issues(repo: str):
    """Lista los issues abiertos de un repositorio (formato 'usuario/repo')."""
    headers = _get_headers()
    url = f"{GITHUB_API_URL}/repos/{repo}/issues"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def create_issue(repo: str, title: str, body: str):
    """Crea un nuevo issue en el repositorio."""
    headers = _get_headers()
    url = f"{GITHUB_API_URL}/repos/{repo}/issues"
    data = {"title": title, "body": body}
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()

def close_issue(repo: str, issue_number: int):
    """Cierra un issue existente."""
    headers = _get_headers()
    url = f"{GITHUB_API_URL}/repos/{repo}/issues/{issue_number}"
    data = {"state": "closed"}
    response = requests.patch(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()