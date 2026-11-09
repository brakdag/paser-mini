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

# 3. Check the supported runtime and install locked dependencies
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" != "24" ] && [ "$NODE_MAJOR" != "26" ]; then
    echo "Error: Node 24.x or 26.x is required."
    exit 1
fi

echo "Installing locked Node.js dependencies..."
npm ci --ignore-scripts

# 4. Create a local binary wrapper
echo "Creating local binary wrapper..."
mkdir -p "$PROJECT_ROOT/bin"

cat <<EOF > "$PROJECT_ROOT/bin/paser-mini"
#!/bin/bash
# Resolve the real physical path of this script to avoid symlink issues
REAL_SCRIPT_PATH=\$(readlink -f "\$0")
SCRIPT_DIR=\$(dirname "\$REAL_SCRIPT_PATH")
PROJECT_ROOT=\$(cd "\$SCRIPT_DIR/.." && pwd)

# Execute node using the absolute path to main.js to preserve the user's CWD
node "\$PROJECT_ROOT/src/main.js" "\$@"
EOF

chmod +x "$PROJECT_ROOT/bin/paser-mini"

# 5. Configure symbolic link (exposed as paser-mini)
echo "Configuring 'paser-mini' command..."
mkdir -p "$HOME/.local/bin"

ln -sf "$PROJECT_ROOT/bin/paser-mini" "$HOME/.local/bin/paser-mini"

echo ""
echo "✓ Paser Mini installation successful!"
echo "Make sure '$HOME/.local/bin' is in your PATH."
echo "Try running: paser-mini"