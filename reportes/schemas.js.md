# FILE ANALYSIS: schemas.js
**Purpose:** Central definition of Zod schemas for all system tools.

## Critical Flaws
- **Data Duplication:** This file represents one of several 'sources of truth' for tool definitions. The same information (tool names and argument structures) is duplicated in `registry.js` and `ExecutionEngine.js`.
- **Maintenance Burden:** Because the tool definitions are split across multiple files, adding a new tool requires a synchronized update across the entire codebase.

## Efficiency Rating: B-
The schemas themselves are well-defined, but their placement in the architecture is suboptimal.

## Absolute Zero Recommendation
Consolidate all tool metadata (Zod schema, UI mapper, and implementation) into a single Tool Definition Object. This would eliminate the need for `schemas.js`, `_detailMappers`, and `MODULE_MAP` entirely.