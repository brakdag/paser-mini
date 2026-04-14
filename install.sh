#!/bin/bash
set -e

echo "Iniciando instalación de Paser Mini..."

# 1. Verificar que estamos en la raíz del proyecto
if [ ! -f "pyproject.toml" ]; then
    echo "Error: Debes ejecutar este script desde la raíz del proyecto (donde está pyproject.toml)."
    exit 1
fi

# 2. Verificar dependencias básicas
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 no está instalado."
    exit 1
fi

PROJECT_ROOT=$(pwd)
echo "Proyecto en: $PROJECT_ROOT"

# 3. Crear/Recrear entorno virtual
echo "Preparando entorno virtual..."
python3 -m venv "$PROJECT_ROOT/venv"

# 4. Instalar/Actualizar dependencias de Python
echo "Instalando dependencias de Python..."
"$PROJECT_ROOT/venv/bin/pip" install --upgrade pip > /dev/null

if "$PROJECT_ROOT/venv/bin/pip" install -e . ; then
    echo "[OK] Dependencias instaladas correctamente."
else
    echo "[ERROR] Falló la instalación de dependencias via pip."
    exit 1
fi

# 5. Verificar que el binario fue creado (buscamos paser_mini)
BINARY_PATH="$PROJECT_ROOT/venv/bin/paser_mini"
if [ ! -f "$BINARY_PATH" ]; then
    echo "[ERROR] El ejecutable 'paser_mini' no fue creado en $BINARY_PATH."
    echo "Verifica que pyproject.toml tenga la sección [project.scripts] correcta."
    exit 1
fi

# 6. Configurar enlace simbólico (lo exponemos como paser-mini)
echo "Configurando comando 'paser-mini'..."
mkdir -p "$HOME/.local/bin"

# Eliminar enlace existente
rm -f "$HOME/.local/bin/paser-mini"

ln -sf "$BINARY_PATH" "$HOME/.local/bin/paser-mini"

echo ""
echo "✓ Instalación de Paser Mini exitosa!"
echo "Asegúrate de tener '$HOME/.local/bin' en tu PATH."
echo "Prueba ejecutando: paser-mini"