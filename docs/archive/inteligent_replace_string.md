# Intelligent Replace String: Semantic Assistance for AI Agents

## 1. The Problem: The "Exact Match" Wall

Autonomous AI agents often struggle with `replaceString` tools because LLMs are probabilistic, while file systems are deterministic. A single missing space, a different indentation (tabs vs spaces), or a slight variation in a line break causes the tool to fail.

When the agent has a large context, it suffers from "Context Noise," leading it to hallucinate the exact string it needs to replace, resulting in multiple failed attempts, wasted tokens, and agent frustration.

## 2. The Solution: Semantic Assistance (Strict Suggestion Mode)

Instead of a binary `OK` or `ERR: Not found`, the tool is transformed into a guide. If an exact match fails, the system performs a **Fuzzy Search** to find the most similar string in the file and suggests it to the agent. 

**CRITICAL RULE:** The tool must NEVER perform an automatic replacement based on a fuzzy match. It must only suggest the correct string, forcing the agent to make a new, explicit call with the exact text to ensure total control and prevent accidental corruption.

### The Logic Flow
1. **Exact Match Phase:** Search for the `search_text` exactly as provided. If found $\rightarrow$ `OK`.
2. **Fuzzy Match Phase:** If not found, scan the file for lines or blocks with high similarity (e.g., > 80% similarity using Levenshtein Distance).
3. **Suggestion Phase:** Return a detailed error message containing the closest match found and its location.

## 3. Implementation Guide

### Technical Stack
- **Language:** Python
- **Recommended Libraries:** `difflib` (Standard Library) or `RapidFuzz` (High Performance).

### Implementation Steps

#### A. Similarity Algorithm
Use the `get_close_matches` function from `difflib` or `fuzz.partial_ratio` from `RapidFuzz` to compare the `search_text` against the lines of the file.

#### B. Pseudo-code Logic
```python
import difflib

def intelligent_replace(path, search_text, replace_text):
    with open(path, 'r') as f:
        lines = f.readlines()
    
    content = "".join(lines)
    
    # PHASE 1: Exact Match Only
    if search_text in content:
        new_content = content.replace(search_text, replace_text)
        with open(path, 'w') as f:
            f.write(new_content)
        return "OK"
    
    # PHASE 2: Suggestion Only (NO REPLACEMENT)
    # We search for the closest match to help the agent correct its input
    closest_matches = difflib.get_close_matches(search_text, lines, n=1, cutoff=0.6)
    
    if closest_matches:
        suggestion = closest_matches[0].strip()
        return f"ERR: Exact text not found. NO replacement performed. Did you mean: '\"{suggestion}\"'?"
    
    return "ERR: Text not found and no close matches identified."
```

## 4. Impact on Agent Performance

- **Convergence Speed:** Reduces the number of turns to successfully edit a file from 3-5 attempts to 1-2.
- **Token Efficiency:** Minimizes the "Error $\rightarrow$ Retry $\rightarrow$ Error" loop, saving thousands of tokens in long sessions.
- **Reliability:** Prevents the agent from giving up or hallucinating the file content when a small typo occurs.

---
**Implementation Role:** Senior Python Dev / AI Engineer specialized in NLP.