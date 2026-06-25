<!-- Navigation: See /robots.txt for the Cognitive Navigation Map -->

# Project Structure

This document provides the definitive map of the Paser Mini codebase. The project follows a strict separation between core orchestration, infrastructure wrappers, and the toolset.

```text
.
├── src/                       # Source code root (JavaScript)
│   ├── main.js                # Application entry point
│   ├── core/                  # The "Brain": ReAct engine & state management
│   │   ├── chatManager.js    # Message queue & session orchestration
│   │   ├── turnProcessor.js   # Main ReAct loop & turn logic
│   │   ├── ApiCommunicator.js # Resilient API communication layer
│   │   ├── systemPromptManager.js # Prompt aggregation & tool filtering
│   │   ├── FountainAdapter.js # Screenplay mode orchestration
│   │   ├── terminalUI.js     # UI Orchestrator (Delegates to Renderer/Input)
│   │   ├── TerminalRenderer.js# Visual output & Markdown formatting
│   │   ├── TerminalInput.js   # User input & readline management
│   │   ├── SessionLogger.js   # Session persistence & logging
│   │   ├── configManager.js  # Application settings
│   │   ├── commandHandler.js  # Internal system command logic
│   │   └── schemas.js         # Centralized Zod Tool definitions
│   ├── infrastructure/        # The "Nerves": System & API wrappers
│   │   ├── providerManager.js # Provider registry & adapter factory
│   │   ├── gemini/            # LLM client & adapter
│   │   ├── openrouter/        # LLM client & adapter
│   │   ├── groq/              # LLM client & adapter
│   │   ├── cohere/            # LLM client & adapter

│   │   └── nvidia/            # Hardware-specific integrations
│   ├── tools/                 # The "Hands": Minimalist toolset
│   │   ├── registry.js        # Tool mapping & discovery
│   │   ├── fileTools.js      # Surgical file operations
│   │   ├── memoryTools.js    # Memento interface tools
│   │   ├── searchTools.js    # Global search & patterns
│   │   ├── systemTools.js    # OS & analysis tools
│   │   └── utilTools.js      # General utilities
│   └── config/                # Local configuration & cache
├── tests/                     # Test suite & stress tests
├── docs/                      # Technical documentation & protocols

└── package.json             # Project metadata & dependencies
```

### Key Architectural Principles

1. **Decoupling**: The `TerminalUI` is now a thin orchestrator, delegating rendering, input, and logging to specialized classes to reduce cognitive load.
2. **Surgicality**: Tools are designed to perform the smallest possible change to minimize token consumption.
3. **Persistence**: The `memoryTools` infrastructure ensures that distilled insights survive across sessions via the `memento.log` file.
4. **Resilience**: API communication is abstracted into a dedicated communicator to handle retries and recovery without polluting the reasoning loop.
5. **Scalability**: The `ProviderManager` ensures that new LLM providers can be integrated without modifying the core orchestration logic.
6. **Formalization**: The `SystemPromptManager` ensures that the agent's identity and operational protocols are constructed through a consistent, verifiable pipeline.
