#!/bin/bash
set -e

echo "Iniciando instalación de Paser..."

# Helper function to check and install apt packages
install_apt_package() {
    local package=$1
    if dpkg -l | grep -q "^ii  $package "; then
        echo "[OK] $package ya está instalado."
    else
        echo "[INSTALL] Instalando $package..."
        sudo apt-get update -qq
        sudo apt-get install -y -qq "$package"
    fi
}

# 1. Verificar dependencias básicas
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 no está instalado."
    exit 1
fi

# 2. Instalar dependencias de sistema necesarias para las herramientas
echo "Verificando dependencias de sistema..."
install_apt_package "elinks"
install_apt_package "imagemagick"

# 3. Instalación condicional de LaTeX
echo ""
read -p "LaTeX es un paquete muy pesado. ¿Deseas instalarlo para habilitar el soporte de compilación de LaTeX? (y/n): " install_latex
if [[ "$install_latex" =~ ^[Yy]$ ]]; then
    echo "[INSTALL] Instalando LaTeX (esto puede tardar un tiempo)..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq texlive-latex-extra
else
    echo "[SKIP] Saltando instalación de LaTeX."
fi

# Get project root (donde se ejecute el script)
PROJECT_ROOT=$(pwd)
echo "Proyecto en: $PROJECT_ROOT"

# 4. Crear/Recrear entorno virtual
echo "Preparando entorno virtual..."
python3 -m venv "$PROJECT_ROOT/venv"

# 5. Instalar/Actualizar dependencias de Python
echo "Instalando dependencias de Python..."
"$PROJECT_ROOT/venv/bin/pip" install --upgrade pip > /dev/null
"$PROJECT_ROOT/venv/bin/pip" install -e . > /dev/null

# 6. Instalar Wasmer Runtime
echo "Instalando Wasmer Runtime..."
if ! command -v wasmer &> /dev/null; then
    curl https://get.wasmer.io -sSfL | sh
else
    echo "[OK] Wasmer ya está instalado. Saltando..."
fi

# 7. Crear enlace simbólico
echo "Configurando comando 'paser'..."
mkdir -p "$HOME/.local/bin"
ln -sf "$PROJECT_ROOT/venv/bin/paser" "$HOME/.local/bin/paser"

echo ""
echo "✓ Instalación exitosa!"
echo "Asegúrate de tener '$HOME/.local/bin' en tu PATH."
