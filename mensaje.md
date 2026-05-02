# Memoria de Diagnóstico: Glitch de Percepción

## Resumen de la Intervención
- **Problema**: Discrepancia entre la percepción del Agente (recibía `OK` o nada) y el Usuario (veía `⚠️ Glitch detectado`). El orquestador abortaba el turno ante errores de parsing/validación.
- **Causa Raíz**: En `src/core/chat_manager.py`, el bucle de ejecución de herramientas usaba un `return` prematuro cuando `call_data is None`, rompiendo el ciclo ReAct y descartando otras herramientas válidas en el mismo turno.
- **Solución**: Se modificó el manejo de `call_data is None` para generar un `<TOOL_RESPONSE>` con `status: "error"`, añadirlo a `combined_tool_responses` y usar `continue` para permitir que el resto del turno proceda.

## Estado del Sistema
- **Componente afectado**: `ChatManager.execute`.
- **Resultado**: El agente ahora recibe feedback estructurado de errores y no se interrumpe el procesamiento de herramientas válidas en un mismo turno.

*Fin del registro de Clara Sterling.*