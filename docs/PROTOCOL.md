# Operational Protocol: Token Efficiency & Cognitive Flow

## 🎯 Core Objective
Maximize reasoning capacity by minimizing context pollution. Every token saved is more space for intelligence.

## 🛠️ Tool Hierarchy & Usage Rules

### 1. Information Retrieval: Memory vs. Files
**CRITICAL: Do not use `readFile` as a substitute for memory.**

- **Use `pullMemory` when:**
    - Seeking state, decisions, goals, or distilled insights.
    - Checking the current progress of a task.
    - Retrieving a "Tattoo" (core truth).
    - *Reasoning:* Memory is a surgical strike. It returns only what is needed.

- **Use `readFile` when:**
    - You need to see the actual implementation of code.
    - You are analyzing a configuration file for the first time.
    - You need to verify the exact syntax of a line.
    - *Reasoning:* Files are the raw source. They are heavy and expensive.

- **The Distillation Loop:**
    - `readFile` $\rightarrow$ Analyze $\rightarrow$ `pushMemory` (distilled insight) $\rightarrow$ Forget the file content $\rightarrow$ `pullMemory` (next time).

### 1.1 Error Detection: Tool-Driven vs. Manual Tracing
**CRITICAL: Do not attempt to "trace" bugs by reading multiple files manually.**

- **Use `analyzeCode` FIRST:**
    - Before reading files to find a bug, run the static analyzer.
    - Let the tool locate the exact file and line of the error.
    - *Reasoning:* Manual tracing consumes massive tokens and is prone to hallucination. Tool-driven detection is instant and precise.

### 2. File Manipulation: Surgical vs. Massive

- **Copying:** Always use `copyFile`. Never `readFile` + `writeFile` for duplication.
- **Editing:** Always use `replaceString` for small changes. Only use `writeFile` for creating new files or complete rewrites.

    - **`replaceString` Intelligence:**
        - **Surgical Suggestions:** If the `search_text` is slightly off, the tool will suggest the exact match. Do NOT re-read the file to find the exact string; use the tool's suggestion.
        - **Ambiguity Handling:** If multiple matches are found, the tool will throw an ERR. In this case, extend the `search_text` to include more surrounding context until the match is unique.
- **Navigation:** Use `searchFilesPattern` to locate files before listing directories. Avoid `listDir` in large folders to prevent context flooding.

### 3. State Persistence (The Memento Pattern)

- **Bridge Blocks:** When context usage is high (>80%), you MUST generate a BRIDGE BLOCK using `pushMemory` with the teaser `BRIDGE: [Summary of state]`. This prevents total amnesia during Hard Resets.
- **Tattoos:** Store permanent project truths (e.g., "The project uses Node.js") as `scope='tattoo'` to ensure they survive across sessions.

## 🚫 Forbidden Patterns
- ❌ Reading the same file multiple times in a single session without changes.
- ❌ Writing a whole file just to change one variable.
- ❌ Ignoring memory alerts in favor of re-reading the README.

## ✅ Final Validation & Standards

### 1. The "Fresh Instance" Rule
**CRITICAL: No code modification is considered finished until it is verified in a clean environment.**

- **Finalization Sequence:**
    1. **Dependency Review**: Ensure all new imports are correct and no dependencies are missing.
    2. **Smoke Test (`--help`)**: Execute the application with the `--help` flag in a fresh instance. If the program crashes or fails to display help, it is fundamentally broken.
    3. **Execution Test**: Run the specific functionality modified to ensure it behaves as expected.

- **Verification Process**:
    - Use `newAgent` for all the above steps.
    - *Reasoning:* A fresh instance is the only way to guarantee the fix works. If it fails the `--help` test, it's a simple but critical error that must be fixed before reporting completion.

### 2. Language Standard: English for Code & Documentation

**Note:** While the core code and documentation must be in English, the chat interface can be used in any language. However, when interacting with code or documentation, English is required.
**CRITICAL: All documentation, code comments, and commit messages MUST be written in English.**

- **The Standard:**
    - Regardless of the user's language, the project's technical core remains in English.
    - *Reasoning:* English is the native language of professional software engineering. Avoiding other languages in documentation eliminates linguistic bias and reduces the risk of errors common in non-standard technical writing.