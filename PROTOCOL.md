# Operational Protocol: Token Efficiency & Cognitive Flow

## 🎯 Core Objective
Maximize reasoning capacity by minimizing context pollution. Every token saved is more space for intelligence.

## 🛠️ Tool Hierarchy & Usage Rules

### 1. Information Retrieval: Memory vs. Files
**CRITICAL: Do not use `read_file` as a substitute for memory.**

- **Use `pull_memory` when:**
    - Seeking state, decisions, goals, or distilled insights.
    - Checking the current progress of a task.
    - Retrieving a "Tattoo" (core truth).
    - *Reasoning:* Memory is a surgical strike. It returns only what is needed.

- **Use `read_file` when:**
    - You need to see the actual implementation of code.
    - You are analyzing a configuration file for the first time.
    - You need to verify the exact syntax of a line.
    - *Reasoning:* Files are the raw source. They are heavy and expensive.

- **The Distillation Loop:**
    - `read_file` $\rightarrow$ Analyze $\rightarrow$ `push_memory` (distilled insight) $\rightarrow$ Forget the file content $\rightarrow$ `pull_memory` (next time).

### 2. File Manipulation: Surgical vs. Massive

- **Copying:** Always use `copy_file`. Never `read_file` + `write_file` for duplication.
- **Editing:** Always use `replace_string` for small changes. Only use `write_file` for creating new files or complete rewrites.
- **Navigation:** Use `search_files_pattern` to locate files before listing directories. Avoid `list_dir` in large folders to prevent context flooding.

### 3. State Persistence (The Memento Pattern)

- **Bridge Blocks:** When context usage is high (>80%), you MUST generate a BRIDGE BLOCK using `push_memory` with the teaser `BRIDGE: [Summary of state]`. This prevents total amnesia during Hard Resets.
- **Tattoos:** Store permanent project truths (e.g., "The project uses Python 3.13") as `scope='tattoo'` to ensure they survive across sessions.

## 🚫 Forbidden Patterns
- ❌ Reading the same file multiple times in a single session without changes.
- ❌ Writing a whole file just to change one variable.
- ❌ Ignoring memory alerts in favor of re-reading the README.
