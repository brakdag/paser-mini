# Project Structure

This document provides the definitive map of the Paser Mini codebase. The project follows a strict separation between core orchestration, infrastructure wrappers, and the toolset.

```text
.
├── src_js/                       # Source code root (JavaScript)
│   ├── main.js                # Application entry point
│   ├── core/                  # The "Brain": ReAct engine & state management
│   │   ├── chatManager.js    # Message queue & session orchestration
│   │   ├── executionEngine.js # Tool execution & loop logic
│   │   ├── smartParser.js    # Token-efficient response parsing
│   │   ├── terminalUI.js     # Decoupled CLI interface
│   │   ├── configManager.js  # Application settings
│   │   ├── commandHandler.js  # Internal system command logic
│   │   └── schemas/           # JSON Tool definitions (The Source of Truth)
│   ├── infrastructure/        # The "Nerves": System & API wrappers
│   │   ├── gemini/            # LLM client & adapter
│   │   ├── memento/           # Cognitive Graph (SQLite implementation)
│   │   └── nvidia/            # Hardware-specific integrations
│   ├── tools/                 # The "Hands": Minimalist toolset
│   │   ├── registry.js        # Tool mapping & discovery
│   │   ├── fileTools.js      # Surgical file operations
│   │   ├── memoryTools.js    # Memento interface tools
│   │   ├── searchTools.js    # Global search & patterns
│   │   ├── systemTools.js    # OS & analysis tools
│   │   └── utilTools.js      # General utilities
│   └── config/                # Local configuration & cache
├── tests/                     # Test suite & stress tests
├── docs/                      # Technical documentation & protocols
├── scripts/                   # Maintenance & utility scripts
└── package.json             # Project metadata & dependencies
```

### Key Architectural Principles

1. **Decoupling**: The `TerminalUI` is decoupled from the `ExecutionEngine` to allow for non-blocking input/output.
2. **Surgicality**: Tools are designed to perform the smallest possible change to minimize token consumption.
3. **Persistence**: The `memento` infrastructure ensures that distilled insights survive across sessions via the Cognitive Graph.