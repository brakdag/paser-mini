# Policy for Middleware Interception

If the tool middleware incorrectly intercepts file content (e.g., due to JSON-like structures or tool call tags within the code), do not attempt to fix the file directly using `write_file` or `replace_string`.

Instead:
1. Create a standalone fix script in the root directory.
2. Execute the script to perform the necessary repairs.
3. Remove the script after successful execution.