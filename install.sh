#!/bin/bash
set -e

echo "Starting Paser Mini (Node.js) installation..."

# 1. Verify we are in the project root
if [ ! -f "package.json" ]; then
    echo "Error: You must run this script from the project root (where package.json is located)."
    exit 1
fi

# 2. Verify basic dependencies
if ! command -v node &> /dev/null; then
    echo "Error: node is not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed."
    exit 1
fi

PROJECT_ROOT=$(pwd)
echo "Project at: $PROJECT_ROOT"

# 3. Install dependencies
echo "Installing Node.js dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "[OK] Dependencies installed successfully."
else
    echo "[ERROR] npm install failed."
    exit 1
fi

# 4. Create a local binary wrapper
echo "Creating local binary wrapper..."
mkdir -p "$PROJECT_ROOT/bin"

cat <<EOF > "$PROJECT_ROOT/bin/paser-mini"
#!/bin/bash
# Get the absolute path to the project root
PROJECT_ROOT="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
node "\$PROJECT_ROOT/src_js/main.js" "\$@"
EOF

chmod +x "$PROJECT_ROOT/bin/paser-mini"

# 5. Configure symbolic link (exposed as paser-mini)
echo "Configuring 'paser-mini' command..."
mkdir -p "$HOME/.local/bin"

# Remove existing link
rm -f "$HOME/.local/bin/paser-mini"

ln -sf "$PROJECT_ROOT/bin/paser-mini" "$HOME/.local/bin/paser-mini"

echo ""
echo "✓ Paser Mini installation successful!"
echo "Make sure '$HOME/.local/bin' is in your PATH."
echo "Try running: paser-mini"