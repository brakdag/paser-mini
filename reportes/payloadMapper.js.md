# FILE ANALYSIS: payloadMapper.js
**Purpose:** Translates neutral conversation history into provider-specific API payloads.

## Critical Flaws
- **Manual Translation Layer:** This class is a 'grease layer'. It manually maps objects from one format to another. This is a high-maintenance approach; every new provider requires a new mapping method, leading to a bloated class over time.
- **Redundant Logic:** The mapping logic is often trivial (e.g., changing `model` to `assistant`). This should be a configuration property of the `Adapter` rather than a centralized static mapper.

## Efficiency Rating: D
It is a maintenance bottleneck that adds unnecessary indirection to the data flow.

## Absolute Zero Recommendation
Eliminate the `PayloadMapper` class. Move the mapping logic into the specific `Adapter` classes. Each adapter knows its own API requirements; there is no reason to centralize this knowledge in a separate mapper.