# Plan de Verificación: Fix Sandbox Arguments

## Problema detectado
`wasmer run` fallaba porque los argumentos de Python (como `-m`) se interpretaban como argumentos de `wasmer` al no haber un separador `--` y al no colocar las opciones de `wasmer` al principio.

## Cambios realizados en `paser/tools/instance_tools.py`
1. Se movieron las opciones de `wasmer` (`--mapdir`) antes del comando `python`.
2. Se añadió el separador `--` después de `python` para asegurar que todos los argumentos posteriores se pasen al proceso de Python.

## Instrucciones para probar
1. Reiniciar la aplicación `paser-mini` para cargar el nuevo código desde el disco.
2. Ejecutar el siguiente comando en una nueva instancia:
   ```bash
   paser-mini -m "test sandbox" --sandbox
   ```
   (O usar la herramienta `run_instance` con `sandbox=True` sobre cualquier script `.py`)
