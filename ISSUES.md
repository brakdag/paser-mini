# Project Issues

## [Resolved] UI: Professional Spinner Implementation
- **Description**: The previous spinner was a moving dot that spanned 80 characters, which was visually distracting and could interfere with other UI elements.
- **Solution**: Implemented a compact, Braille-based animated spinner (approx. 10 characters) using Nerd Fonts characters. This provides a more modern "pro" look and ensures no overlap with JSON tool calls or notifications.
- **File changed**: `paser/core/ui.py`
