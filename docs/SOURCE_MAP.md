# Project Source Map

To avoid path resolution errors, always remember the following structure:

- **Source Root**: `src_js/`
- **Core Logic**: `src_js/core/` (ChatManager, ExecutionEngine, etc.)
- **Infrastructure**: `src_js/infrastructure/` (Database, Adapters)
- **Tools**: `src_js/tools/` (File tools, Memory tools)
- **Config**: `src_js/config/`

**Rule**: All core logic and tool implementations are written in JavaScript/Node.js and reside within the `src_js/` directory.