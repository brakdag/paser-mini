# 📋 Tablero Kanban de Passer

## 📝 TODO (Pendientes)
- [x] ID-001: Sustituir `eval()` por una alternativa segura en `calculadora_basica` (Riesgo: Crítico - RCE).
- [x] ID-002: Implementar `get_safe_path` en la herramienta `analizar_codigo_con_pyright` (Riesgo: Alto - Path Traversal).
- [x] ID-003: Modificar `ChatManager` para procesar múltiples bloques `<TOOL_CALL>` por turno (Riesgo: Medio - Eficiencia).
- [x] ID-004: Añadir un límite de iteraciones (`max_turns`) al bucle autónomo en `ChatManager` (Riesgo: Medio - Estabilidad).
- [ ] ID-005: Implementar escritura atómica de archivos usando archivos temporales (Riesgo: Bajo - Robustez).
- [ ] ID-006: Migrar `system_instruction` al parámetro nativo de la configuración de Gemini (Riesgo: Bajo - Efectividad).
- [ ] ID-007: Implementar herramienta de modificación selectiva de archivos para evitar errores de sobrescritura en archivos existentes (Riesgo: Bajo - Robustez).

## 🚧 IN PROGRESS (En curso)
- [x] ID-000: Análisis exhaustivo de estructura y seguridad del proyecto.

## ✅ DONE (Terminado)
- [x] ID-Setup: Implementación de arquitectura ReAct básica.
- [x] ID-Setup: Implementación de sistema de seguridad de rutas (`get_safe_path`).
- [x] ID-Setup: Integración de UI con `rich` y streaming.