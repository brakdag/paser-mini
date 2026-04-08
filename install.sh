#!/bin/bash
set -e

echo "🚀 Iniciando instalación de Paser..."

# 1. Verificar dependencias básicas
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 no está instalado."
    exit 1
fi

# Get project root (donde se ejecute el script)
PROJECT_ROOT=$(pwd)
echo "📂 Proyecto en: $PROJECT_ROOT"

# 2. Crear/Recrear entorno virtual
echo "🛠️ Preparando entorno virtual..."
python3 -m venv "$PROJECT_ROOT/venv"

# 3. Instalar/Actualizar dependencias
echo "📦 Instalando dependencias..."
"$PROJECT_ROOT/venv/bin/pip" install --upgrade pip > /dev/null
"$PROJECT_ROOT/venv/bin/pip" install -e . > /dev/null

# 4. Instalar Wasmer Runtime
echo "📦 Instalando Wasmer Runtime..."
if ! command -v wasmer &> /dev/null; then
    curl https://get.wasmer.io -sSfL | sh
else
    echo "✅ Wasmer ya está instalado. Saltando..."
fi

# 5. Descargar binario de Python WASM
echo "📂 Descargando python.wasm..."
mkdir -p "$PROJECT_ROOT/assets"
curl -L https://github.com/vmware-labs/python-wasm/releases/latest/download/python.wasm -o "$PROJECT_ROOT/assets/python.wasm"

# 4. Crear enlace simbólico
echo "🔗 Configurando comando 'paser'..."
mkdir -p "$HOME/.local/bin"
ln -sf "$PROJECT_ROOT/venv/bin/paser" "$HOME/.local/bin/paser"

echo "✅ ¡Instalación exitosa! Asegúrate de tener '$HOME/.local/bin' en tu PATH."
