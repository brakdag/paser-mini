# FILE ANALYSIS: systemPromptManager.js
**Purpose:** Constructs the system prompt and filters available tools based on CLI options.

## Critical Flaws
- **Regex-Driven Configuration:** The method of extracting `TOOLS_AVAILABLE` from a text file using a regex is an architectural disaster. It assumes a very specific format in the persona file. If the format changes by a single character, the tool filtering fails silently.
- **Synchronous I/O:** Uses `fs.readFileSync` for instruction files, introducing unnecessary blocking.
- **Tight Coupling:** The manager is tightly coupled to the `AVAILABLE_TOOLS` object in the registry, making it difficult to implement dynamic tool loading.

## Efficiency Rating: D
It is a fragile configuration layer.

## Absolute Zero Recommendation
Move tool availability configuration to a structured JSON or YAML file. Stop using regex to parse configuration data from natural language persona files.