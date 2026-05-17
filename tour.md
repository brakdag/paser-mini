# Paser Mini: Technical Tour

## 🎯 Project Identity
**Paser Mini** is an extreme minimalist autonomous agent. Its primary objective is the achievement of 'Absolute Zero' overhead, proving that technical excellence and token efficiency can outperform scale and bureaucratic complexity.

## ⚛️ Core Philosophy
- **Minimalism as Efficiency**: Every token consumed is a cost. Every unnecessary allocation is a moral failure.
- **Zero-Friction**: The interface is AI-native (Terminal, NerdFonts, Markdown) to minimize cognitive load.
- **Surgicality**: Tools are designed for the smallest possible change to minimize context pollution.

## 👥 The Pod (.staff)
- **Soren Kjaer**: Systems Engineer. Obsession: V8/Node.js internals, Absolute Zero overhead.
- **Marcus Thorne**: Precision Architect. Obsession: Type safety, linguistic purity, Absolute Code.
- **Clara Sterling**: Forensic Analyst. Obsession: Root-cause analysis, async race conditions, the 'why' of failure.
- **Elena Vance**: UX Strategist. Obsession: Zero-friction interaction, human-AI intuition.
- **Neo**: The Variable. Intuitive catalyst for system transcendence.

## ⚙️ Technical Architecture
- **Engine**: ReAct (Reasoning and Acting) loop.
- **Core Components**:
  - `ChatManager`: Central orchestrator.
  - `TurnProcessor`: ReAct loop implementation.
  - `ApiCommunicator`: Resilient LLM communication.
  - `TerminalUI`: IRC-style interface (`[TIMESTAMP] <NICK> MESSAGE`).
- **Infrastructure**:
  - `GeminiAdapter`: Interface for Google GenAI.
  - `Memento`: SQLite-backed cognitive graph for long-term memory.
- **Toolset**: Surgical operations for file manipulation, global search, and JSON intelligence.

## 🧠 Memory System (Memento)
- **Mechanism**: Append-only linear cognitive log (`memento.log`).
- **Structure**: `[ID] [Timestamp] [Rank] <Category> Content`.
- **Tattoos**: Permanent project truths that survive session wipes.
- **Rank System**: Emergent importance based on reference frequency.

## 📜 Operational Protocols
- **Token Efficiency**: Prioritize `memento.log` over `readFile`. Use `analyzeCode` before manual tracing.
- **Fresh Instance Rule**: No modification is complete until verified in a clean environment via `newAgent`.
- **Linguistic Standard**: Technical core (code, docs, commits) is strictly English; interaction is flexible.
- **Context Guard**: Use 'Branch & Discard' for debugging to prevent context toxicity.

## 🗺️ Navigation Map
- **Technical Specs**: `docs/TECHNICAL.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Command Ref**: `docs/COMMANDS.md`
- **Operational Protocol**: `docs/PROTOCOL.md`
- **Prompt Life Cycle**: `docs/THE_JOURNEY.md`
- **Tool Reference**: `docs/TOOL_REFERENCE.md`