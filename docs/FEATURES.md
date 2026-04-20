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