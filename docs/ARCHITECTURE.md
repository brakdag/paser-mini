<!-- Navigation: See /robots.txt for the Cognitive Navigation Map -->

# Detailed Technical Architecture

This project follows a modular ReAct (Reasoning and Acting) architecture designed for extreme token efficiency and zero-overhead execution. Below is the conceptual breakdown of the system:

### ⚙️ Core Engine (`src/core/`)

The "Brain" of the agent. It handles the conversation loop, state management, and internal commands without coupling to specific LLM APIs or UI implementations.
- **Pattern**: Central Orchestrator (`ChatManager`) delegating to specialized processors (Turn, API, UI).
- **Resilience**: Implements exponential backoff, repetition detection, and strict schema validation.

### 💠 Infrastructure (`src/infrastructure/`)

The "Nerves". Decouples the core engine from external services.
- **Multi-Provider**: Uses a factory pattern (`ProviderManager`) to seamlessly switch between LLMs (Gemini, OpenRouter, Groq, Cohere, etc.).
- **Identity**: Hosts the `system_instruction.json` which defines the agent's persona, cognitive protocols, and tool usage rules.

### 💡 Toolbox (`src/tools/`)

The "Hands". A minimalist, schema-driven toolset.
- **Dynamic Loading**: Tools are loaded dynamically and exposed via central schemas (Zod).
- **Surgicality**: Each tool is designed to perform the smallest possible change to minimize token consumption.

### 🛡️ Containment & Security Strategy

The agent operates within a strict sandbox to ensure freedom of action without risking the host system:
- **Process Control**: CPU cycles and execution timeouts are restricted to prevent infinite loops.
- **Resource Limits**: Strict memory (`mem_limit`) and swap limits are enforced via Docker to prevent RAM exhaustion.
- **Network Isolation**: `network_mode: none` is applied by default. Network access is selectively enabled only when required.
- **File System**: The project volume is mounted as `read-write` for persistence, while the rest of the container remains `read-only`.

### ⏱️ Temporal Context Protocol

To ensure absolute transparency, the data presented to the user is identical to the data sent to the LLM.
- **Information Symmetry**: No filtering of timestamps or nicknames is allowed in the communication layer.
- **Semantic Structure**: Messages follow the `[HH:mm] <Nickname> Content` format, leveraging the model's understanding of chat logs.
- **Forensic Auditing**: The `/s` command captures the exact raw payload dispatched to the server.

### ↻ Data Flow

`User Input` $\rightarrow$ `TerminalUI` $\rightarrow$ `TurnProcessor` $\rightarrow$ `ApiCommunicator` $\rightarrow$ `ProviderManager` $\rightarrow$ `Adapter` $\rightarrow$ `SmartToolParser` (if tool call) $\rightarrow$ `ExecutionEngine` $\rightarrow$ `Tools` $\rightarrow$ `TurnProcessor` (loop) $\rightarrow$ `Final Response` $\rightarrow$ `TerminalUI`.