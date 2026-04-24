# Paser Mini (Extreme Minimalist Autonomous Agent)

<div align="center">
  <img src="assets/mascot.png" alt="Paser Mini Mascot" width="200"/>
</div>

**Paser Mini** is a highly streamlined fork of the original Paser system. It is an autonomous agent powered by Google's Gemini model that employs the **ReAct (Reasoning and Acting)** pattern to execute local functions with zero overhead and maximum efficiency.

Designed for developers who want a lightweight, distraction-free autonomous core on **Debian/Linux** systems.

### ⚛️ The Philosophy of Minimalism
In Paser Mini, **minimalism is not about the scarcity of tools or code, but about the maximum efficiency of token consumption**. Every tool is strategically chosen to prevent unnecessary data from flooding the context window, ensuring the agent maintains peak reasoning capacity.

Furthermore, the system embraces an **AI-native interface**: a terminal-based environment using NerdFonts and Markdown—the formats where the AI feels most at home.

For detailed operational guidelines on token efficiency and tool usage, refer to [PROTOCOL.md](PROTOCOL.md).

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
export OTROS_SERVICIOS_API_KEY="your_api_key_here"
```

## Execution

Run the application using the newly created binary:

```bash
paser-mini
```

### Command Line Arguments

| Argument                      | Short  | Description                                         |
| :---------------------------- | :----- | :-------------------------------------------------- |
| `--version`                   | `-v`   | Show version information                            |
| `--unit_tests`                | `-ut`  | Run the internal unit test suite                    |
| `--system_instruction`        | `-si`  | Provide custom system instructions to the agent     |
| `--inject_system_instruction` | `-isi` | Inject instruction at the start of system prompt    |
| `--file_system_instruction`   | `-fsi` | Path to file for system instruction injection       |
| `--message`                   | `-m`   | Send an initial message in one-shot mode            |
| `--input`                     | `-i`   | Input text to process in one-shot mode              |
| `--instance-mode`             | `-im`  | Run in instance mode (read-only config, no recursion)|
| `--debug`                     | `-d`   | Enable debug logging                                 |

**Example (One-shot mode):**

```bash
paser-mini "Analyze the current directory and summarize the project"
```

## Workspace Hygiene
To keep the project root clean, please use the `/tmp` directory for temporary files or experimental tests. Avoid creating test files directly in the project root to ensure the repository remains uncluttered.

## Documentation

For more detailed information, please refer to the following documents in the `docs/` directory:

- [Project Structure](docs/PROJECT_STRUCTURE.md) - Overview of the codebase organization.
- [Technical Architecture](docs/ARCHITECTURE.md) - Deep dive into the ReAct engine and data flow.
- [Main Features](docs/FEATURES.md) - Detailed list of capabilities and UI highlights.
- [User Commands](docs/COMMANDS.md) - Guide to internal agent commands.
- [Toolbox](docs/TOOLS.md) - Description of the minimalist toolset.
- [Development & Testing](docs/DEVELOPMENT.md) - Guidelines for contributing and verifying changes.