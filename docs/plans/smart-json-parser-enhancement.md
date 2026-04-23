# Smart JSON Parser Enhancement Plan

## Objective
Replace the current multi-attempt JSON parser with a robust, single-pass parser that includes schema validation and automatic error correction.

## Current Problems
1. **Inefficient Parsing**: 3-4 fallback attempts consume 150-200 tokens per failure
2. **No Schema Validation**: Invalid arguments reach tools, causing runtime errors 
3. **Generic Errors**: "Invalid JSON format" provides no actionable feedback

## Technical Architecture

### Core Components
- **SmartToolParser**: Single-pass parser with preprocessing
- **SchemaValidator**: JSON schema validation engine
- **AutoCorrector**: Fixes common JSON errors automatically
- **ValidationResult**: Structured error responses with field-level details

### Schema Files Location
```
paser/core/schemas/
├── read_file.json
├── write_file.json
├── run_python.json
├── push_memory.json
└── [all other tools]
```

## Implementation Steps

### Phase 1: Foundation
1. Create JSON schema definitions for all 19 tools
2. Implement basic JSON preprocessing pipeline
3. Design validation exception hierarchy

### Phase 2: Core Parser
1. Build SmartToolParser class with single-pass logic
2. Integrate schema validation with detailed field errors
3. Add auto-correction for common JSON mistakes

### Phase 3: Integration 
1. Replace ToolParser in chat_manager.py
2. Update error handling throughout tool execution
3. Add validation feedback to terminal UI

### Phase 4: Testing & Optimization
1. Comprehensive unit tests for all schemas
2. Performance benchmarks vs current parser
3. Security review and edge case testing

## Success Metrics
- **Token Efficiency**: 75% reduction in parsing tokens
- **Speed**: 70% faster parsing (single attempt vs 3-4)
- **Error Clarity**: 90% more specific error messages
- **False Positives**: 95% reduction in incorrect parses

## Testing Strategy
- Unit tests for each tool schema validation
- Integration tests with malformed JSON inputs
- Performance benchmarks with large payloads
- Security tests with malicious JSON payloads

## Executor Role
**Senior Python Engineer specializing in JSON parsing and validation**