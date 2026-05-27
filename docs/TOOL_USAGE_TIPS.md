# Tool Usage Tips & Best Practices

These guidelines are recommended for optimal performance and system stability.

## File Manipulation

- **Copying**: Use `fs.copyFile` for duplication. Trust the tool's success response; do not verify with `fs.readFile` unless an error occurs.
- **Editing**: Use `fs.replaceString` for surgical changes. Only use `fs.writeFile` for new files or full rewrites.
- **Handling Failures**: If `fs.replaceString` fails, use the tool's fuzzy suggestion or expand the search context to ensure uniqueness.