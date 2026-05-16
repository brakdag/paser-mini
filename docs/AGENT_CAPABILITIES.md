# Agent Capability Registry

This document defines the specialized functional modules (Agents) within the Paser Mini ecosystem. These agents are not independent entities but specialized processing units designed to transform specific types of data while managing context efficiency.

## 🛠️ Agent Catalog

### 🌐 The Navigator (Web-to-Data)

- **Primary Function:** Web searching, information retrieval, and synthesis from external sources.
- **Input:** Natural language queries, URLs, or research topics.
- **Output:** Structured data, summaries, or curated information sets.
- **Context Load:** **HIGH** (Processes high-noise web content; outputs high-density structured data).
- **Use Case:** When the system needs knowledge outside its local environment.

### 🔍 The Explorer (Project-to-Index)

- **Primary Function:** Deep navigation of local file structures, dependency mapping, and architectural summarization.
- **Input:** Directory paths, file patterns, or broad architectural questions.
- **Output:** File maps, dependency graphs, or condensed project summaries.
- **Context Load:** **VERY HIGH** (Scans large volumes of files; outputs high-density structural maps).
- **Use Case:** When the system needs to understand the internal state or organization of a complex project.

### 👁️ The Observer (Vision-to-Description)

- **Primary Function:** Visual analysis of images, screenshots, and UI elements.
- **Input:** Image files, screenshots, or visual UI components.
- **Output:** Semantic descriptions, layout analysis, or visual-to-text translations.
- **Context Load:** **HIGH** (Processes visual tokens; outputs descriptive semantic text).
- **Use Case:** When the system needs to bridge the gap between visual perception and textual reasoning.

### 🧠 The Synthesizer (Context-to-Summary)

- **Primary Function:** Compression of long conversation histories, logs, or execution traces into coherent state summaries.
- **Input:** Long chat logs, execution histories, or extensive text streams.
- **Output:** Condensed state summaries, key takeaways, or "current status" snapshots.
- **Context Load:** **CRITICAL** (Manages the core memory window; prevents context saturation).
- **Use Case:** When the system needs to maintain long-term continuity without bloating the primary context window.

### ✅ The Validator (Output-to-Test)

- **Primary Function:** Verification of code syntax, execution of test suites, and cross-referencing outputs against requirements.
- **Input:** Generated code, data outputs, or specific test criteria.
- **Output:** Pass/Fail reports, error logs, or corrected versions.
- **Context Load:** **MEDIUM** (Processes specific outputs; outputs binary or structured feedback).
- **Use Case:** When the system needs to ensure the reliability and correctness of a task completed by another agent.

---

## 📐 Operational Principles

1. **Task-Based Delegation:** Agents are invoked based on the _type of data transformation_ required, not by arbitrary roles.
2. **Context Isolation:** Each agent operates within a controlled window to prevent "context pollution" and noise leakage.
3. **Linear Workflow:** Tasks follow a structured pipeline (Orchestrator $\rightarrow$ Agent $\rightarrow$ Validator) to ensure traceability and reliability.
4. **Zero-Friction Output:** Every agent must return data in a format that is immediately actionable by the Orchestrator or the next agent in the pipeline.
