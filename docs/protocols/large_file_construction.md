# Protocol: Large File Construction (LFC)

## 1. Purpose
To prevent silent data loss caused by buffer collapse in the tool execution bridge when passing large strings (> 5KB) as arguments.

## 2. The Constraint
- **Forbidden**: Passing strings larger than 5KB as the `content` argument in `fs.writeFile` or `fs.appendFile` (if available).
- **Observation**: Silent failures occur when the argument is large, but `fs.writeFile` works correctly when the large string is constructed internally within a tool (e.g., `fs.replaceString`).

## 3. The Layered Construction Technique (LCT)
When creating a document that exceeds 5KB, the following sequence MUST be followed:

### Phase 1: Skeleton Creation
Create the file with a small set of unique markers representing the sections of the document.
Example:
`fs.writeFile({ path: "doc.tex", content: "[PREAMBLE]\n[SECTION1]\n[SECTION2]\n[BIBLIOGRAPHY]" })`

### Phase 2: Incremental Injection
Use `fs.replaceString` to replace each marker with its corresponding content. Each injection must be kept under 5KB.
Example:
`fs.replaceString({ path: "doc.tex", search_text: "[PREAMBLE]", replace_text: "\\documentclass{article}..." })`

### Phase 3: Atomic Verification
After each injection, verify the file's persistence and size using `fs.readFile` (with `tail` if necessary) or `fs.readdir`.

## 4. Compliance
Failure to follow the LFC protocol when handling large files is a Major Non-Conformity (NC) under Clause 8.7.