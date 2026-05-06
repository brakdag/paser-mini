# Development & Testing

Development of Paser Mini focuses on extreme efficiency and zero-overhead execution. To ensure stability and performance, follow these guidelines:

### Verification Workflow

To verify changes in the core engine or toolset:
1. **Fresh Instance**: Launch a new instance of `paser-mini` to ensure no stale state is affecting the behavior.
2. **Delegated Testing**: Use `newAgent` to launch a secondary instance. This allows the primary agent to observe and verify the behavior of the new instance in real-time.
3. **Regression Check**: After any modification, verify that the tool's token consumption hasn't increased and that no new friction has been introduced to the user experience.
4. **Documentation**: Create a GitHub issue to document the change, the reasoning behind it, and the verification steps taken.

### Testing Environment

All tests should be run in a clean Debian/Linux environment. Avoid using multi-platform wrappers that could introduce latency or behavioral discrepancies.