# Project Analysis: Paser Mini

## Overview
Paser Mini is a minimalist autonomous agent based on the ReAct pattern, using Google's Gemini models. It is designed for efficiency, low token overhead, and local system interaction.

## Core Architecture

### 1. Orchestration (`paser/core/`)
- **`ChatManager`**: The heart of the system. It manages the conversation loop, executes tools, handles rate limits (RPM), and monitors context window usage.
- **`ToolParser`**: Handles the extraction of `<TOOL_CALL>` tags and the formatting of `<TOOL_RESPONSE>` tags.
- **`TerminalUI`**: A rich terminal interface providing real-time feedback via spinners and Markdown rendering.
- **`CommandHandler`**: Manages internal slash commands (e.g., `/models`, `/reset`, `/s`).

### 2. Infrastructure (`paser/infrastructure/`)
- **`GeminiAdapter`**: Wraps the Google GenAI SDK, managing chat sessions and history.
- **`Memento`**: A sophisticated long-term memory system using SQLite. It implements a cognitive graph with different levels of detail (L0-L3) based on the Golden Ratio ($\phi$).
    - **Tattoos**: Core, immutable truths.
    - **Fractals**: General knowledge and session summaries.
    - **Bridge Blocks**: Special nodes used to restore session state after a hard reset (The Leap).

### 3. Toolbox (`paser/tools/`)
- **File Tools**: Secure file operations restricted to the project root.
- **Search Tools**: Global text and file pattern searching.
- **Instance Tools**: Ability to launch new `paser-mini` instances for delegation or testing.
- **Memory Tools**: Interface to the Memento system (`pushMemory`, `pullMemory`).

## Key Mechanisms

- **ReAct Loop**: The agent reasons, emits tool calls, receives results, and continues until a final answer is reached.
- **Context Management**: When context reaches 80%, the agent is prompted to distill information. At 95%, it must create a Bridge Block.
- **Hard Reset (The Leap)**: The `/reset` command clears the short-term history and restores the state using the latest Bridge Block from Memento.
- **Safety**: File access is validated to prevent directory traversal outside the project root.

## Current State
The project is modular, highly streamlined, and implements a unique approach to long-term memory and session persistence.