# Paser Mini (Extreme Minimalist Autonomous Agent)

<div align="center">
  <img src="assets/mascot.png" alt="Paser Mini Mascot" width="200"/>
</div>

**Paser Mini** is a highly streamlined fork of the original Paser system. It is an autonomous agent powered by Google's Gemini model that employs the **ReAct (Reasoning and Acting)** pattern to execute local functions with zero overhead and maximum efficiency.

Designed for developers who want a lightweight, distraction-free autonomous core on **Debian/Linux** systems.

## Installation

Installation is now near-instant as all heavy system dependencies have been removed.

### Quick Installation

```bash
curl -fsSL https://raw.githubusercontent.com/brakdag/paser-mini/main/install.sh | bash
```

### Clone from Repository

```bash
git clone https://github.com/brakdag/paser-mini.git && cd paser-mini && chmod +x install.sh && ./install.sh
```

## Credentials Configuration

Configure your API key in your `.bashrc` or `.zshrc`:

```bash
export GOOGLE_API_KEY="your_google_api_key_here"
```

## Execution

Run the application using the newly created binary:

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
│   │   ├── system_tools.py # Basic system analysis (Pyright)
│   │   ├── util_tools.py # Core utilities
│   │   └── registry.py   # Tool mapping
│   ├── infrastructure/   # System wrappers
│   ├── config/           # Settings
│   └── main.py           # Entry point
├── tests/                # Test suite
├── scripts/              # Maintenance scripts
└── pyproject.toml        # Metadata
```

## Main Features

1.  **Pure ReAct Engine:**
    - Uses structured `<TOOL_CALL>` emissions via System Instructions.
    - Optimized for low latency and minimal token consumption.
    - **Silent Mode**: Reasoning/Thinking is disabled by default for a cleaner terminal experience.

2.  **Secure File Access:**
    - All operations are restricted to `PROJECT_ROOT` via `get_safe_path` validation.

3.  **Essential User Commands:**
    - `/models`: Change AI model and adjust temperature.
    - `/q`, `/quit`, `/exit`: Exit the application.

## Minimal Toolset

To maintain extreme lightness, only the absolute core tools are included:

### 📂 File System
- **Reading**: `read_file`.
- **Writing**: `write_file`, `remove_file`, `create_dir`, `rename_path`.
- **Navigation**: `list_dir`, `get_cwd`.

### ✂️ Basic Editing
- **Modification**: `replace_string` (Surgical text replacement).

### 🔍 Search & Analysis
- **Search**: `search_files_pattern`, `search_text_global`.
- **Analysis**: `analyze_pyright` (Static type checking).

### 🛠️ Core Utils
- **Validation**: `validate_json`.

## Development & Testing

Testing must be performed in a fresh environment. After any modification, please create a GitHub issue to delegate verification to a subsequent agent instance.
