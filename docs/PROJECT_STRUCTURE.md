# Project Structure

This document provides the definitive map of the Paser Mini codebase. The project follows a strict separation between core orchestration, infrastructure wrappers, and the toolset.

```text
.
├── src/                       # Source code root
│   ├── main.py                # Application entry point
│   ├── core/                  # The "Brain": ReAct engine & state management
│   │   ├── chat_manager.py    # Message queue & session orchestration
│   │   ├── execution_engine.py # Tool execution & loop logic
│   │   ├── smart_parser.py    # Token-efficient response parsing
│   │   ├── terminal_ui.py     # Decoupled CLI interface
│   │   ├── config_manager.py  # Application settings
│   │   ├── ui_interface.py    # UI Abstractions
│   │   ├── ui_bindings.py     # Keyboard shortcuts & bindings
│   │   ├── latex_translator.py # Math/Science rendering
│   │   ├── repetition_detector.py # Loop prevention
│   │   ├── command_handlers/   # Internal system command logic
│   │   └── schemas/           # JSON Tool definitions (The Source of Truth)
│   ├── infrastructure/        # The "Nerves": System & API wrappers
│   │   ├── gemini/            # LLM client & adapter
│   │   ├── memento/           # Cognitive Graph (SQLite implementation)
│   │   └── nvidia/            # Hardware-specific integrations
│   ├── tools/                 # The "Hands": Minimalist toolset
│   │   ├── registry.py        # Tool mapping & discovery
│   │   ├── file_tools.py      # Surgical file operations
│   │   ├── memory_tools.py    # Memento interface tools
│   │   ├── search_tools.py    # Global search & patterns
│   │   ├── system_tools.py    # OS & analysis tools
│   │   └── util_tools.py      # General utilities
│   └── config/                # Local configuration & cache
├── tests/                     # Test suite & stress tests
├── docs/                      # Technical documentation & protocols
├── scripts/                   # Maintenance & utility scripts
└── pyproject.toml             # Project metadata & dependencies
```

### Key Architectural Principles

1. **Decoupling**: The `TerminalUI` is decoupled from the `ExecutionEngine` to allow for non-blocking input/output.
2. **Surgicality**: Tools are designed to perform the smallest possible change to minimize token consumption.
3. **Persistence**: The `memento` infrastructure ensures that distilled insights survive across sessions via the Cognitive Graph.