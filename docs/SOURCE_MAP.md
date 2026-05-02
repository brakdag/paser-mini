# Project Source Map

To avoid path resolution errors, always remember the following structure:

- **Source Root**: `src/`
- **Core Logic**: `src/core/` (ChatManager, ExecutionEngine, etc.)
- **Infrastructure**: `src/infrastructure/` (Database, Adapters)
- **Tools**: `src/tools/` (File tools, Memory tools)
- **Config**: `src/config/`

**Rule**: If a file is a Python module, it is almost certainly inside `src/`.