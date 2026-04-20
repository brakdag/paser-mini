# Project Structure

```text
.
├── paser/                # Core application package
│   ├── core/             # Unified ReAct engine and state management
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