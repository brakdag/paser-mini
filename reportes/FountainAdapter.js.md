# FILE ANALYSIS: FountainAdapter.js
**Purpose:** Adapts input and output for 'Fountain' screenwriting format.

## Critical Flaws
- **History Mutation:** In `processResponse`, the adapter calls `popLastMessage()` and then `injectMessage()`. This is a destructive mutation of the conversation history. If the formatted response is lost or corrupted, the original raw response is already gone.
- **Thin Abstraction:** This class is a 'grease layer'. It provides almost no logic that couldn't be handled by a simple utility function. It exists only to satisfy a 'Manager/Adapter' architectural pattern that adds call-stack depth without adding value.

## Efficiency Rating: D
High overhead for very low functional utility.

## Absolute Zero Recommendation
Eliminate the class. Replace it with a pure function `formatFountain(text, role)` and call it directly in the `TurnProcessor`.