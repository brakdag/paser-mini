# Plan: Gestión Dinámica de Contexto y Rate Limiting

## Objetivo
Optimizar el uso de la API (Free Tier: 15 RPM) mediante un Rate Limiter adaptativo y gestión de contexto FIFO.

## Especificaciones
- **Comando**: `/window <tokens> <sleep_seconds>` (Nota: `sleep_seconds` ahora actúa como override manual o modo de espera forzada).
- **Rate Limiter Adaptativo**:
  - Implementar una ventana deslizante de 60 segundos.
  - Permitir hasta 15 RPM (Request Per Minute).
  - Si se alcanza el límite, calcular el tiempo de espera necesario para liberar el slot más antiguo (evitando esperas innecesarias).

## Estrategia de Gestión de Contexto (FIFO)
- **Mecanismo**: Purga automática de mensajes antiguos cuando el total de tokens supera `context_window_limit`.

## Impacto en Arquitectura
- **`paser/core/chat_manager.py`**:
  - Añadir `self.request_timestamps: List[float]`.
  - Implementar `_wait_for_rate_limit()` que calcule el delta necesario.
  - Integrar `_enforce_context_limit()` antes de cada llamada a `assistant.send_message`.
