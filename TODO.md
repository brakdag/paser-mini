# 📋 Tablero Kanban de Passer

## 📝 TODO (Pendientes)
- [ ] **ID-009:** Implementar confirmación interactiva para operaciones destructivas (borrado, sobrescritura masiva).
- [ ] **ID-010:** Agregar comando `/history` para ver historial de herramientas ejecutadas en la sesión actual.
- [ ] **ID-011:** Mejorar manejo de errores de API (reintentos automáticos, backoff exponencial).
- [ ] **ID-012:** Implementar sesiones persistentes (guardar/recuperar historial entre ejecuciones).
- [ ] **ID-013:** Soporte para archivos binarios (imágenes, PDFs) con herramientas de conversión.
- [ ] **ID-014:** Agregar herramienta `buscar_reemplazar_global` para reemplazos en múltiples archivos.
- [ ] **ID-015:** Implementar límite de tamaño de archivo para lectura (evitar OOM con archivos gigantes).
- [ ] **ID-016:** Agregar comando `/export` para guardar la conversación completa (Markdown/JSON).
- [ ] **ID-023:** Registrar `reemplazar_bloque_texto` en `passer/tools/registry.py`.
- [ ] **ID-024:** Corregir redundancia de código en `passer/core/chat_manager.py`.
- [ ] **ID-025:** Mejorar robustez del parser de `<TOOL_CALL>` en `AutonomousExecutor`.
- [ ] **ID-026:** Implementar estrategia de gestión de contexto (summarization/sliding window).

## 🚧 IN PROGRESS (En curso)
- [ ] **ID-017:** Refactorizar `tools_functions.py` para usar logging estructurado en vez de prints.

## ✅ DONE (Terminado)
- [x] ID-001: Sustituir `eval()` por alternativa segura usando `ast` en `calculadora_basica` (RCE).
- [x] ID-002: Implementar `get_safe_path` para validación de rutas seguras (Path Traversal).
- [x] ID-003: Modificar `ChatManager` para procesar múltiples bloques `<TOOL_CALL>` por turno (batch processing).
- [ ] **ID-004:** Añadir límite de iteraciones (`max_turns`) para evitar bucles infinitos ❌ **DESECHADO**: Bloqueaba conversaciones normales. Se confía en `RepetitionDetector`.
- [x] ID-005: Implementar escritura atómica de archivos usando archivos temporales.
- [x] ID-006: Configurar `system_instruction` correctamente en Gemini (con `types.GenerateContentConfig`).
- [x] ID-007: Implementar herramientas de modificación selectiva (`modificar_linea`, `reemplazar_texto`, `reemplazar_bloque_texto`).
- [x] ID-000: Análisis exhaustivo de estructura y seguridad del proyecto.
- [x] ID-Setup: Implementación de arquitectura ReAct completa (bucle de ejecución con feedback loop).
- [x] ID-Setup: Implementación de sistema de seguridad de rutas (`get_safe_path`).
- [x] ID-Setup: Integración de UI con `rich` (paneles, colores, markdown, spinner).
- [x] ID-018: Crear `AutonomousExecutor` con bucle ReAct completo y detector de repeticiones.
- [x] ID-019: Añadir comandos interactivos: `/clear`, `/thinking`, `/cd`, `/models` con persistencia.
- [x] ID-020: Implementar todas las pruebas unitarias y de integración (13 pruebas pasando).
- [x] **ID-021:** Sistema de notificación visual para operaciones de archivos (feedback con iconos y nombres).
- [x] **ID-022:** Spinner animado ("Pensando...") mientras el modelo procesa; el prompt solo vuelve tras completar la ejecución.