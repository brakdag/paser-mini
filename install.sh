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

# 4. Crear enlace simbólico
echo "🔗 Configurando comando 'paser'..."
mkdir -p "$HOME/bin"
ln -sf "$PROJECT_ROOT/venv/bin/paser" "$HOME/bin/paser"

echo "✅ ¡Instalación exitosa! Asegúrate de tener '$HOME/bin' en tu PATH."
