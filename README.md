# Paser Mini

[Project website](https://brakdag.github.io/paser-mini/)

<div align="center">
  <img src="docs/assets/mascot.png" alt="Paser Mini Mascot" width="200"/>
</div>

Paser Mini is a terminal AI agent for Debian/Linux. It uses the ReAct
(Reasoning and Acting) loop to work with local files, tools and MCP servers,
with Gemini and other model providers. Its focus is efficient token use and
a minimal terminal interface with Markdown and NerdFonts.

## Quick start

Requires Node **24.x or 26.x** and npm. Git and GNU grep are needed for Git
and text-search tools; additional tool dependencies are listed in the
[operating reference](docs/operations.md#executables-and-credentials).

```bash
git clone https://github.com/brakdag/paser-mini.git
cd paser-mini
npm ci --ignore-scripts
export GOOGLE_API_KEY="your_google_api_key_here"
npm start
```

To use another provider, see [credentials](docs/operations.md#executables-and-credentials).
Run `bash install.sh` from the clone to install the `paser-mini` launcher in
`~/.local/bin` (add it to PATH). Then run `paser-mini` from the project you want
the agent to access. The `paser_mini` npm command remains available as an alias.

## Usage

```bash
paser-mini --message "Explain this project"
paser-mini --no-system-instruction  # Pure chat
```

| Command | Purpose |
| --- | --- |
| `/models` | Cancel a pending request and list models |
| `/models <index>` | Select a listed model |
| `/rewrite <message>` | Replace the latest completed turn; tool effects persist |
| `/reload` | Rebuild the prompt and tool catalog, including MCP configuration |
| `/execute` | Enable shell access |
| `/exit` | End the session |

See [CLI arguments](docs/runtime.md#command-line-arguments) for system instruction
options and [GitHub batch mode](docs/runtime.md#github-batch-mode).

## Development

```bash
npm run check
```

Runs lint, the reviewed JS type baseline and the complete test suite.
See [development and quality checks](docs/development.md) for prerequisites,
test isolation and type-checking limitations.

## Documentation

- [Operating reference](docs/operations.md): dependencies, credentials, configuration scopes, history and shutdown.
- [Runtime reference](docs/runtime.md): diagnostics, persistence, MCP, CLI arguments, retries and turn limits.
- [Local tool reference](docs/local-tools.md): call syntax, indexing, batch loading, path policy and `run` isolation.
- [CLI composition](docs/cli-composition.md): Unix pipelines, endpoints, progressive responses and shortcuts.
- [Tool results and media](docs/tool-results.md): content blocks, resources and provider support.
- [Architecture](docs/ARCHITECTURE.md): system structure.

## License

[MIT](LICENSE).
