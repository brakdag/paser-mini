# Paser Mini (Minimalist Autonomous Agent)

<div align="center">
  <img src="assets/mascot.png" alt="Paser Mini Mascot" width="200"/>
</div>

**Paser Mini** is a streamlined, minimalist fork of the original Paser system. It is an autonomous agent powered by Google's Gemini model (via the `google-genai` SDK) that employs the **ReAct (Reasoning and Acting)** pattern to execute local functions with maximum efficiency and minimum overhead.

Designed for developers who need a lightweight yet powerful autonomous core on **Debian/Linux** systems.

## Installation

You can choose between cloning the repository or running the installation script:

### Option 1: Quick Installation

```bash
curl -fsSL https://raw.githubusercontent.com/brakdag/paser-mini/main/install.sh | bash
```

### Option 2: Clone from Repository

```bash
git clone https://github.com/brakdag/paser-mini.git && cd paser-mini && chmod +x install.sh && ./install.sh
```

## Credentials Configuration

Configure the following environment variables in your `.bashrc` or `.zshrc`:

```bash
# API Key for the Gemini model
export GOOGLE_API_KEY="your_google_api_key_here"

# Personal access token for GitHub
export GITHUB_TOKEN="your_github_token_here"
```

## Execution

Run the application using:

```bash
paser-mini
```

## Project Structure

```text
. 
├── paser/                # Core application package
│   ├── core/             # ReAct engine and state management
│   ├── tools/            # Minimalist toolset and registry
│   │   ├── file_tools.py # Essential file operations
│   │   ├── lsp_tools.py  # Basic introspection
│   │   ├── code_navigator.py # AST analysis
│   │   └── registry.py   # Tool mapping
│   ├── infrastructure/   # System wrappers
│   ├── config/           # Settings
│   └── main.py           # Entry point
├── tests/                # Test suite
├── scripts/              # Maintenance scripts
└── pyproject.toml        # Metadata
```

## Main Features

1.  **Minimalist ReAct Engine:**
    - Uses structured `<TOOL_CALL>` emissions via System Instructions.
    - Lightweight middleware for local function execution.
    - Optimized for low latency and reduced token consumption.

2.  **Secure File Access:**
    - Restricted to `PROJECT_ROOT` via `get_safe_path` validation.
    - Interactive confirmation for destructive operations.

3.  **Core User Commands:**
    - `/models`: Change AI model/temperature.
    - `/thinking`: Toggle reasoning visibility.
    - `/cd <path>`: Change working directory.
    - `/reset`: Save session and restart.

## Tool Management

To keep Paser Mini lightweight, only essential tools are included. To add new capabilities:
1. **Implement** the function in `paser/tools/`.
2. **Map** it in `paser/tools/registry.py`.
3. **Define** metadata in `paser/tools/registry_positional.json`.

## Development & Testing

Testing must be performed in a fresh environment. After any modification, please create a GitHub issue to delegate verification to a subsequent agent instance.
