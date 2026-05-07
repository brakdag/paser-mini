# Memento: The Linear Cognitive Log

Memento is Paser Mini's long-term memory (LTM) system. To ensure zero friction and absolute transparency, Memento operates as a simple, append-only log file (`memento.log`). This replaces the previous complex graph-based system with a streamlined, chronological record of distilled insights.

## 📝 The Log Format

Every memory entry follows a strict, machine-readable structure:

`[ID: X] [YYYY-MM-DD HH:mm:ss] [Rank: Y] <Category> Content`

### Field Breakdown:
- **ID**: A unique, incremental integer used for direct referencing (e.g., `#12`).
- **Timestamp**: The exact date and time the memory was captured.
- **Rank**: A numerical value representing the importance of the entry. All entries start at `Rank: 0`. The rank increases as the entry is referenced by other memories or the agent, highlighting the most critical project truths.
- **Category**: A tag (e.g., `<tattoo>`, `<technical>`, `<decision>`) used to classify the type of information.
- **Content**: The distilled insight or fact.

## ⚙️ How to Use

### Storing Knowledge (`pushMemory`)
Use this tool to save insights that must survive a context wipe.
- **Example**: `pushMemory(scope="tattoo", value="The project must follow the Airbnb JavaScript Style Guide strictly.")`
- **Result**: `[ID: 42] [2026-05-07 18:45] [Rank: 0] <tattoo> The project must follow the Airbnb JavaScript Style Guide strictly.`

### Retrieving Knowledge (`readFile`)

**CRITICAL**: To ensure absolute data integrity and trust, the agent does NOT use a tool to read memories. Instead, it reads the raw log file directly.

- **Retrieval Strategy**: Use `readFile("memento.log")` to access the full cognitive history.
- **Analysis**: Once the file is read, the agent can manually locate entries by ID (e.g., `#42`) or keywords within the text.
- **Reasoning**: Reading the raw file prevents "tool-bias" and ensures the agent sees the exact state of its long-term memory.

## 🚀 The Rank System

Rank is the organic measure of a memory's value. Instead of a predefined hierarchy, importance is emergent:
1. **Creation**: Every memory starts at `Rank: 0`.
2. **Referencing**: When an entry is cited in a new memory, its Rank increases. To reference a memory and trigger a rank increment, you MUST use an HTML anchor tag in the `value` field: `<a href="#ID">Reference Text</a>` (e.g., `<a href="#1">The core mission</a>`).
3. **Visibility**: High-rank entries are the "North Stars" of the project, representing the most validated and frequently used truths.

## 🔴 Navigation Summary

| Goal | Strategy |
| :--- | :--- |
| **Full State Recovery** | `pullMemory()` (The Mirror) |
| **Fact Check** | `pullMemory(scope="category", key="keyword")` |
| **Chronological Flow** | `pullMemory(scope="category", key="keyword", direction="next/prev")` |