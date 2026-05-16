#!/bin/bash

# Validar que se pasen exactamente 2 argumentos
if [ "$#" -ne 2 ]; then
    echo "Uso: $0 <lineas_por_archivo> <archivo_a_dividir>"
    exit 1
fi

LINEAS=$1
ARCHIVO=$2

# Validar que el archivo exista
if [ ! -f "$ARCHIVO" ]; then
    echo "Error: El archivo '$ARCHIVO' no existe."
    exit 1
fi

# Validar que el primer argumento sea un número
if ! [[ "$LINEAS" =~ ^[0-9]+$ ]]; then
    echo "Error: El número de líneas debe ser un entero positivo."
    exit 1
fi

# Dividir el archivo
# -l: número de líneas
# -d: usar sufijos numéricos en lugar de alfabéticos
# --additional-suffix: añade una extensión a los archivos resultantes
split -l "$LINEAS" -d --additional-suffix=.txt "$ARCHIVO" "parte_"

echo "Archivo '$ARCHIVO' dividido exitosamente en partes de $LINEAS líneas."