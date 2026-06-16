# FILE ANALYSIS: conversationState.js
**Purpose:** Manages the raw history and state of the current conversation.

## Critical Flaws
- **Logic Leak (Presentation in State):** The `_formatMessage` method is a critical architectural error. A state manager should only store and retrieve data. By including formatting logic for IRC and Fountain, this class is now coupled to the UI, violating the separation of concerns.
- **Role Normalization Hardcoding:** The mapping of `model` vs `assistant` is hardcoded. This should be handled by the `PayloadMapper` or the `Adapter`, not the state container.

## Efficiency Rating: D
The pollution of the data layer with presentation logic makes this class fragile and difficult to test.

## Absolute Zero Recommendation
Strip all formatting logic from this class. `ConversationState` should be a pure data store. Move `_formatMessage` to the `TerminalRenderer` or a dedicated `Formatter` service.