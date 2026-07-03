# Paser Mini: Technical Documentation

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

| Argument                      | Short  | Description                                                             |
| :---------------------------- | :----- | :---------------------------------------------------------------------- |
| `--message`                   | `-m`   | Initial message to send                                                 |
| `--system-instruction`        | `-si`  | Provide custom system instructions to the agent                         |
| `--inject-system-instruction` | `-isi` | Inject instruction at the start of system prompt                        |
| `--file-system-instruction`   | `-fsi` | Path to file for system instruction injection                           |
| `--no-system-instruction`     | `-nsi` | Run without system instructions                                         |
| `--github-mode`               |        | Run in GitHub mode: process issues with #ai-assistance                  |

**Example (One-shot mode):**

```bash
paser-mini "Analyze the current directory and summarize the project"
```

## Workspace Hygiene

To keep the project root clean, please use the `/tmp` directory for temporary files or experimental tests. Avoid creating test files directly in the project root to ensure the repository remains uncluttered.

## Documentation

For more detailed information, please refer to the following documents in the `docs/` directory:

- [The Journey](THE_JOURNEY.md) - A narrative guide to how a message travels through the system (Recommended for beginners).
- [Project Structure](PROJECT_STRUCTURE.md) - Overview of the codebase organization.
- [Technical Architecture](ARCHITECTURE.md) - Deep dive into the ReAct engine and data flow.
- [Main Features](FEATURES.md) - Detailed list of capabilities and UI highlights.
- [User Commands](COMMANDS.md) - Guide to internal agent commands.
- [Toolbox](TOOLS.md) - Description of the minimalist toolset.
- [Development & Testing](DEVELOPMENT.md) - Guidelines for contributing and verifying changes.
- [Project History](../staff/HISTORY.md) - The story behind the creation of Paser Mini and the team.
