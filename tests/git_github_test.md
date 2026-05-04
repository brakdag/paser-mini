# Git & GitHub Tools Test Suite

This document defines the test cases to verify the correct integration of `git_tools` and `github_tools`.

## 🛠 Test Environment Requirements
- **Git**: The project must be a git repository.
- **GitHub**: A valid `GITHUB_TOKEN` must be set in the environment variables to test GitHub API tools.

## 🧪 Test Cases

### 1. Git Tools Verification
| Tool | Action | Expected Result |
| :--- | :--- | :--- |
| `get_current_repo` | Call without arguments | Returns the correct `owner/repo` string |
| `git_diff_all` | Call without arguments | Returns the current diff of the entire project |

### 2. GitHub Tools Verification
| Tool | Action | Expected Result |
| :--- | :--- | :--- |
| `list_issues` | Call for the current repo | Returns a JSON list of open issues |
| `create_issue` | Create a test issue (e.g., "Test Issue from Paser") | Returns "Issue #X created successfully" |
| `edit_issue` | Edit the issue created above | Returns "Issue #X edited successfully" |
| `close_issue` | Close the issue created above | Returns "Issue #X closed successfully" |

## 🚀 Execution Protocol
1. Run `get_current_repo` to identify the target repository.
2. Attempt to `list_issues` to verify API connectivity.
3. Perform the Create $\rightarrow$ Edit $\rightarrow$ Close cycle to verify write permissions.
4. Use `git_diff_all` to ensure local git integration is working.