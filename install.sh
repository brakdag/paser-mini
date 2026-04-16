#!/bin/bash
set -e

echo "Starting Paser Mini installation..."

# 1. Verify we are in the project root
if [ ! -f "pyproject.toml" ]; then
    echo "Error: You must run this script from the project root (where pyproject.toml is located)."
    exit 1
fi

# 2. Verify basic dependencies
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed."
    exit 1
fi

PROJECT_ROOT=$(pwd)
echo "Project at: $PROJECT_ROOT"

# 3. Create/Recreate virtual environment
echo "Preparing virtual environment..."
python3 -m venv "$PROJECT_ROOT/venv"

# 4. Install/Update Python dependencies
echo "Installing Python dependencies..."
"$PROJECT_ROOT/venv/bin/pip" install --upgrade pip > /dev/null

if "$PROJECT_ROOT/venv/bin/pip" install -e . ; then
    echo "[OK] Dependencies installed successfully."
else
    echo "[ERROR] Dependency installation via pip failed."
    exit 1
fi

# 5. Verify binary was created (looking for paser_mini)
BINARY_PATH="$PROJECT_ROOT/venv/bin/paser_mini"
if [ ! -f "$BINARY_PATH" ]; then
    echo "[ERROR] The executable 'paser_mini' was not created at $BINARY_PATH."
    echo "Verify that pyproject.toml has the correct [project.scripts] section."
    exit 1
fi

# 6. Configure symbolic link (exposed as paser-mini)
echo "Configuring 'paser-mini' command..."
mkdir -p "$HOME/.local/bin"

# Remove existing link
rm -f "$HOME/.local/bin/paser-mini"

ln -sf "$BINARY_PATH" "$HOME/.local/bin/paser-mini"

echo ""
echo "✓ Paser Mini installation successful!"
echo "Make sure '$HOME/.local/bin' is in your PATH."
echo "Try running: paser-mini"