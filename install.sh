#!/bin/bash
# Install script for 'passer'
set -e

# Get project root from where the script is executed
PROJECT_ROOT=$(pwd)
echo "Setting up project in: $PROJECT_ROOT"

# 1. Create/Recreate virtual environment
echo "Creating virtual environment..."
python3 -m venv "$PROJECT_ROOT/venv"

# 2. Upgrade pip and install dependencies in editable mode
echo "Installing package and dependencies..."
"$PROJECT_ROOT/venv/bin/pip" install --upgrade pip
"$PROJECT_ROOT/venv/bin/pip" install -e .

# 3. Add to local bin
echo "Setting up 'passer' command link..."
mkdir -p "$HOME/bin"
ln -sf "$PROJECT_ROOT/venv/bin/passer" "$HOME/bin/passer"

# 4. Check PATH
if [[ ":$PATH:" != *":$HOME/bin:"* ]]; then
    echo "Warning: \$HOME/bin is not in your PATH."
    echo "Add 'export PATH=\"\$HOME/bin:\$PATH\"' to your ~/.zshrc or ~/.bashrc"
else
    echo "Successfully installed! You can now run 'passer' from anywhere."
fi
