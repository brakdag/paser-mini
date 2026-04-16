# Plan de Implementación: Tool de Ejecución de Instancia (Self-Testing)

## 🎯 Objetivo
Implementar una herramienta que permita al agente lanzar una nueva instancia de `paser-mini` en el mismo entorno virtual. Esto permitirá validar cambios en el código en tiempo real, ya que el agente actual opera sobre una versión cargada en memoria y no detectaría errores de sintaxis o importación introducidos en archivos modificados hasta que se reinicie.

## 🛠️ Especificaciones Técnicas

### 1. Comportamiento de la Tool
- **Nombre:** `run_instance`
- **Función:** Debe ejecutar el binario `paser-mini` o el script `paser/main.py` utilizando el intérprete de Python del entorno virtual actual.
- **Interactividad:** La herramienta debe ceder el control de la terminal (`stdin`, `stdout`, `stderr`) al nuevo proceso para que el usuario humano pueda interactuar con la nueva instancia como un REPL.
- **Finalización:** Una vez que el usuario cierre la instancia secundaria (vía `/q` o `exit`), el control debe regresar a la instancia principal del agente.

### 2. Componentes a Modificar/Crear

#### A. Nueva Herramienta (`paser/tools/instance_tools.py`)
- Crear un nuevo módulo para herramientas de gestión de instancias.
- Implementar la función `run_instance()` utilizando el módulo `subprocess` de Python.
- Asegurar que se utilice el path correcto al entorno virtual (`venv`).

#### B. Registro de la Herramienta (`paser/tools/registry.py`)
- Importar `run_instance` desde el nuevo módulo.
- Agregar `run_instance` al diccionario `AVAILABLE_TOOLS`.

#### C. Catálogo de Herramientas (`paser/tools/registry_positional.json`)
- Agregar la definición de la herramienta (nombre, descripción y parámetros) para que el LLM sepa cómo y cuándo utilizarla.

## 🚀 Pasos de Ejecución

1. **Fase de Desarrollo:**
   - [ ] Crear `paser/tools/instance_tools.py` con la lógica de ejecución de subprocesso.
   - [ ] Registrar la herramienta en `paser/tools/registry.py`.
   - [ ] Actualizar `paser/tools/registry_positional.json`.

2. **Fase de Validación:**
   - [ ] Ejecutar el agente principal.
   - [ ] Solicitar al agente que lance una nueva instancia mediante la tool `run_instance`.
   - [ ] Verificar que la nueva instancia inicie correctamente y sea interactiva.
   - [ ] Cerrar la instancia secundaria y confirmar que el agente principal recupera el control.

3. **Fase de Stress Test:**
   - [ ] Introducir un error deliberado en `paser/main.py`.
   - [ ] Intentar lanzar la instancia para confirmar que el error es visible y reportado por el sistema.

## ⚠️ Consideraciones Importantes
- **Bloqueo de Event Loop:** Dado que `subprocess.run` es bloqueante, la herramienta debe ejecutarse de manera que no congele la UI del agente principal, aunque en este caso es deseado que el usuario tome el control total de la terminal.
- **Rutas:** Utilizar `os.getcwd()` o el contexto del proyecto para localizar el ejecutable de Python dentro de `venv/bin/python`.