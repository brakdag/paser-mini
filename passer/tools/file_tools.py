"""
# passer/tools/file_tools.py
# Simple utilities for project root management used by commands.
# Exposes PROJECT_ROOT and set_project_root.
"""

import os

# Default to current working directory
PROJECT_ROOT = os.getcwd()

def set_project_root(path: str):
    """Set the global PROJECT_ROOT to an absolute path.
    Ensures the path exists.
    """
    global PROJECT_ROOT
    abs_path = os.path.abspath(path)
    if not os.path.isdir(abs_path):
        raise FileNotFoundError(f"Directory not found: {abs_path}")
    PROJECT_ROOT = abs_path
