# Memento System: Documentation Index

This index serves as the central map for the Memento Memory System, designed to overcome the volatile nature of LLM context windows by implementing a persistent, graph-based long-term memory (LTM).

## 🗺️ Documentation Map

| Document | Purpose | Key Focus |
| :--- | :--- | :--- |
| [Methodology](memento_methodology_ai.md) | **The "Why"** | Conceptual foundation, the "Tattoo" analogy, and the philosophy of externalized cognition. |
| [Implementation Plan](memento_implementation_plan.md) | **The "How" (Technical)** | SQLite schema, Cognitive Graph architecture, and the `pull_memory`/`push_memory` tool specifications. |
| [Protocol](memento_protocol.md) | **The "Rules" (Behavioral)** | Role transition management, perspective shifting, and memory audit standards. |
| [Operational Guide](memento_operational_guide.md) | **The "Manual" (Execution)** | Step-by-step workflows for the agent to maintain its own memory during active sessions. (TBD) |

## 🧠 Memory Hierarchy

1. **Vital Tattoos (The Skin)**: Immutable core truths and identity. Loaded at boot.
2. **Root Summary (The Mirror)**: High-level project state. The primary anchor.
3. **Fractal Nodes (The Graph)**: Atomic chunks of memory linked by citations and temporal threads.

## 🛠️ Maintenance Workflow

To update the Memento system:
1. Review the **Methodology** to ensure the change aligns with the core philosophy.
2. Update the **Implementation Plan** if the technical interface (tools/DB) changes.
3. Update the **Protocol** if the way roles interact with memory evolves.
4. Reflect all changes in the **Operational Guide** to ensure the agent knows how to use the new features.