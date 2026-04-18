# Staff Role Specification: Memento System Implementer

### Senior Systems Engineer (Memento Implementation)

- **Role Mission**: To translate the Memento architectural blueprint into a deterministic, high-performance memory system, ensuring the agent's long-term coherence through the implementation of the Golden Fractal Graph and the Context Jump mechanism.

- **Reports To**: Systems Architect / Technical Lead

- **Key Responsibilities**:
  - **State Orchestration**: Implement the `refresh_session()` logic in `GeminiAdapter` to eliminate ghost states in the SDK.
  - **Graph Engineering**: Develop the SQLite schema for the Cognitive Graph, ensuring strict adherence to the Golden Ratio ($\phi$) scaling for L0-L3 nodes.
  - **Trigger Implementation**: Program the exact token-count triggers (80% and 95%) to automate the Distillation and Bridge phases.
  - **Narrative Integrity**: Ensure the Sequential ID Chain is immutable and correctly indexed for narrative retrieval.

- **Limits of Authority**: 
  - Authorized to modify `paser/core/chat_manager.py` and `paser/infrastructure/gemini/adapter.py`.
  - Cannot alter the `System Instruction` or the `Memento Methodology` without approval from the Systems Architect.
  - Authorized to propose new SQLite indices to optimize `pull_memory` latency.

- **Key Performance Indicators (KPIs)**:
  - **Ghosting Rate**: 0% (No data leakage between Hard Resets).
  - **Jump Latency**: Transition time from Bridge Block to new session < 2 seconds.
  - **Fractal Compliance**: 100% of stored nodes must adhere to the $\phi$-scale size constraints.