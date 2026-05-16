#!/bin/bash
# Elena Vance - UX Strategist
# Ensuring technical transparency through simple utility.

# List all tracked files in the git repository
# Displays size in bytes and filename, sorted from largest to smallest

git ls-files | xargs -d '\n' du -b 2>/dev/null | sort -nr
