# Paser (Autonomous Function Calling System - ReAct Pattern)

<div align="center">
  <img src="assets/mascot.png" alt="Paser Mascot" width="200"/>
</div>

**Paser** (originally called "Passer", after _Passer domesticus_) is an autonomous agent powered by Google's Gemini model (via the `google-genai` SDK) that employs the **ReAct (Reasoning and Acting)** pattern to execute local functions transparently for the user. Designed and optimized for **Debian/Linux** systems.

The name change from "Passer" to "Paser" simplifies terminal typing while maintaining the root of the original name and the meaning linked to the house sparrow, a very common bird in southern Mendoza.

## 📦 Installation

You can choose between cloning the repository (for development) or running the installation script directly:

### Option 1: Quick Installation (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/brakdag/paser/main/install.sh | bash
```

### Option 2: Clone from Repository (For Development)

```bash
git clone https://github.com/brakdag/paser.git && cd paser && chmod +x install.sh && ./install.sh
```

## 🔑 Credentials Configuration

To allow Paser to interact with external services, you must configure the following environment variables in your `.bashrc` or `.zshrc` file:

```bash
# API Key for the Gemini model
export GOOGLE_API_KEY="your_google_api_key_here"

# Personal access token for GitHub (required for managing issues)
export GITHUB_TOKEN="your_github_token_here"
```

## 🚀 Execution

Once installed and configured, you can run the application simply by using:

```bash
paser
```

## 🛠️ Main Features

1.  **Local Function Calling (Manual):**
    - Does not use native Google SDK tools.
    - Uses _System Instructions_ to force the model to emit structured calls (`<TOOL_CALL>`).
    - The script acts as a _middleware_ that intercepts these calls, executes the local function, and returns the result in `<TOOL_RESPONSE>` format to the model's history.

2.  **Security and File Control:**
    - All file operations (read, write, delete) are restricted to the current working directory defined by `PROJECT_ROOT` through a secure path validation function (`get_safe_path`).
    - File deletion requires interactive confirmation (`y/n`).

3.  **Dynamic Configuration:**
    - **Temperature:** Allows adjusting the model's creativity when selecting a model (`/models`).
    - **Thoughts:** Allows toggling the visibility of the model's thoughts (lines starting with `*`) via the `/thinking` command.
    - **Working Directory:** Allows changing the agent's working directory via `/cd <path>`.
    - **Context Window Tokens:** `/t` returns the number of tokens in a message.

## 🔧 Available Tools

### 📁 Files and Directories

- `read_file(path)`, `read_files(paths)`, `read_lines(...)`, `read_head(...)`: File reading.
- `write_file(path, content)`, `update_line(...)`, `replace_text(...)`, `replace_block(...)`, `replace_text_regex(...)`, `replace_block_regex(...)`: Writing and editing.
- `list_dir(path)`, `make_dir(path)`, `rename_path(origin, destination)`, `remove_file(path)`: Path management.
- `global_search(query)`, `glob_search(pattern)`, `global_replace(path, search_text, replace_text, extensions)`: Mass search and replace.

### 🔢 Code Navigation

- `list_symbols(file_path)`: Lists all classes and functions defined in a file.
- `get_definition(symbol_name, file_path)`: Locates the line and column where a symbol is defined.
- `get_references(symbol_name, file_path)`: Searches for all references to a symbol in the file.

### 🌐 Utilities and Web

- `web_search(query)`, `fetch_url(url)`: Access to external information.
- `get_time(timezone)`, `get_cwd()`: Basic tools.

### 💠 Computing and Vision

- `execute_python(code)`: Executes Python code in a secure sandbox.
- `see_image(path)`: Analyzes the content of an image.

### 💻 System, Notifications and GitHub

- `analyze_pyright(path)`: Static analysis for Python.
- `notify_user()`: Visual notification in the terminal.
- `notify_mobile(message)`: Sends mobile notification via MQTT.
- `set_timer(seconds, message)`: Task scheduling.
- `is_window_in_focus(action)`: Terminal window focus verification.
- `git_diff()`, `get_remote_repo()`: Local Git integration.
- `list_issues(repo)`, `create_issue(repo, title, body)`, `close_issue(repo, issue_number)`: GitHub Issues management.
