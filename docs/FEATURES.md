# Main Features

1.  **Minimalist UI:**
    - **Enhanced Visuals**: Supports Markdown rendering, JetBrains Nerd Fonts, and basic LaTeX symbols (e.g., $\rightarrow$, $\Rightarrow$) for a clean yet expressive interface.
    - **Silent Execution**: No tool-call logs, no "Working" indicators. The agent works in total silence until the final response.
    - **Minimal Prompt**: A simple `> ` prompt for a distraction-free experience.

2.  **Pure ReAct Engine:**
    - Uses structured `<TOOL_CALL>` emissions via System Instructions.
    - Optimized for low latency and minimal token consumption.

3.  **Secure File Access:**
    - All operations are restricted to `PROJECT_ROOT` via `get_safe_path` validation.

4.  **Memento Memory System:**
    - **Cognitive Graph**: A long-term memory system using a graph-based SQLite database to store core truths (Tattoos) and technical insights (Fractals).
    - **The Mirror Effect**: A boot sequence that allows the agent to synchronize its identity and mission across sessions.
    - **Context Jumping**: A mechanism to distill knowledge and "leap" to a fresh context window without losing state.
    - Detailed guide: [Memento User Guide](memento_user_guide.md)