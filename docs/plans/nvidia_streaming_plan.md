# Plan: Implementación de Streaming para NVIDIA Adapter

## Objetivo
Implementar el streaming de respuestas para el `NvidiaAdapter` para mejorar la experiencia de usuario (UX) y reducir la latencia percibida.

## Pasos
1. **Modificar `adapter.py`**:
   - Cambiar `stream` a `True` en el payload de la solicitud.
   - Implementar el procesamiento de `response.iter_lines()`.
   - Parsear los eventos `data: {...}` (formato SSE).
   - Extraer el campo `choices[0].delta.content`.

2. **Integración con `ChatManager`**:
   - Asegurar que el `ChatManager` pueda manejar el generador de streaming de manera consistente con el `GeminiAdapter`.

## Consideraciones
- La API de NVIDIA utiliza el estándar OpenAI para streaming.
- Se debe manejar el cierre de la conexión y posibles errores de red durante el stream.
- Mantener la compatibilidad con el historial de chat (concatenar el texto completo al finalizar el stream).

## Estado
- [ ] Pendiente de implementación.