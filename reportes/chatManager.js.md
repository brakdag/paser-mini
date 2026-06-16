# FILE ANALYSIS: chatManager.js
**Purpose:** The central orchestrator of the application.

## Critical Flaws
- **God Object Pattern:** `ChatManager` violates every principle of separation of concerns. It manages configuration, provider state, UI synchronization, history migration, and the main execution loop. It is too large and knows too much.
- **Tokenization Farce:** The `getTokenCount` method uses `totalLength / 4`. This is an unacceptable approximation for a system that claims to manage context windows. It is a guess, not a measurement.
- **Fragile History Migration:** `switchProvider` manually iterates through history and injects messages. This is a manual process that is prone to data loss or duplication if the provider's message format differs slightly.
- **Tight Coupling:** It is tightly coupled to almost every other class in the system, making it impossible to test in isolation.

## Efficiency Rating: F
Architecturally bankrupt.

## Absolute Zero Recommendation
Deconstruct this class into three distinct services:
1. **SessionManager:** To handle the turn loop and history.
2. **ProviderOrchestrator:** To handle adapter switching and API state.
3. **ConfigService:** To handle persistence and settings.
Implement a real tokenizer for context window calculations.