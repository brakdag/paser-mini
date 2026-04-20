# Development & Testing

Testing must be performed in a fresh environment. Because Python caches imported modules and the agent maintains internal state (such as `READ_CACHE` in `file_tools.py`), modifications to the codebase may not be reflected in the current running session.

To ensure a clean state and verify changes:
1. Launch a new instance of `paser-mini`.
2. Use `run_instance` to delegate verification to a subsequent agent.
3. For high-security testing of untrusted code, use `run_instance` with `sandbox=True` (requires Wasmer).
3. After any modification, create a GitHub issue to document the change and provide testing instructions for the next agent.