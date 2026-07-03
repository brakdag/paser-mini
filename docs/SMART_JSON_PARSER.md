# Smart Tool Parser: Technical Documentation

## 1. Parser Architecture

The system utilizes a unified parser (`SmartToolParser`) that safely extracts and evaluates tool calls from LLM outputs using Abstract Syntax Tree (AST) analysis, discarding brittle string preprocessing.

### Key Components

- **SmartToolParser**: Central parser using `acorn` for AST evaluation. Extracts tool calls enclosed within the special delimiters.
- **Schema Registry**: Validation engine based on JSON schemas defined in `src/core/schemas.js`.
- **AutoCorrector**: Auxiliary module for potential response fixing (unused in the main AST path but available for fallback).

## 2. Execution Flow

1. **Extraction**: The parser uses a global regular expression to find all blocks wrapped in the tool call delimiters.
2. **AST Evaluation**: Each extracted block is parsed using `acorn.parse()`. This safely interprets the JavaScript-like syntax without executing it.
3. **Argument Casting**: The AST nodes are traversed and evaluated into real JavaScript types (strings, numbers, booleans, arrays, objects).
4. **Schema Validation**: The parsed arguments are validated against the tool's defined schema in `SchemaRegistry`.
5. **Normalization**: The final arguments object is constructed and passed to the `ExecutionEngine`.

## 3. Tool Schemas

Schemas are centrally located in `src/core/schemas.js`. Each schema defines:

- **required**: Mandatory fields.
- **properties**: Data types and constraints (e.g., `type`, `description`).

## 4. Operational Benefits

- **Robustness**: AST parsing is immune to unescaped quotes or minor syntax quirks that break `JSON.parse`.
- **Efficiency**: Single-pass extraction and evaluation reduces overhead.
- **Clarity**: The AST provides precise boundary detection for arguments.
- **Security**: Strict validation ensures only correctly typed data reaches the tools.
