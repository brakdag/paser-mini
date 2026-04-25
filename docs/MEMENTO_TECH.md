# Memento: Documentación Técnica y Operativa

## 1. Arquitectura del Grafo Cognitivo
El sistema utiliza una base de datos SQLite (`agent_memory.db`) para persistir el estado del agente más allá de la ventana de contexto.

### Esquema de Datos
- **nodes**: `id` (PK), `timestamp`, `role`, `type` ('tattoo', 'snapshot', 'fractal'), `content`, `teaser`, `weight`, `is_vital`.
- **edges**: `source_id`, `target_id`, `relation_type` ('parent', 'child', 'associative').

### Escala Fractal ($\phi$)
Los bloques de memoria siguen una escala basada en el número áureo ($\phi \approx 1.618$):
- **L0 (Teaser)**: ~280 bytes.
- **L1 (Fragment)**: 6-9 KB.
- **L2 (Context)**: 10-15 KB.
- **L3 (Root)**: 16-25 KB.

## 2. Guía Operativa para el Agente

### El Despertar (Mirror Effect)
Al iniciar, ejecutar `pull_memory()` sin argumentos para cargar:
1. Protocolo de Memoria.
2. Tattoos Vitales.
3. Root Summary.

### Ciclo de Trabajo
- **Verificación**: Antes de actuar, `pull_memory(key=X)` para evitar redundancias.
- **Captura**: `push_memory(scope="fractal", value="[Insight]", pointers=[...])`.
- **Context Jump (80% - 100%)**:
    1. **Distillation**: Extraer Knowledge Assets.
    2. **Bridge**: Generar Bridge Block (resumen de alta densidad).
    3. **Leap**: Hard Reset (limpiar historial, re-anclar con Bridge Block).

### Navegación
- **Analytical**: `pull_memory(key=X)` -> `direction="down"`.
- **Narrative**: `pull_memory(direction="prev")` (ID Chain).
- **Discovery**: Seguir enlaces en el footer "Referenced by".

## 3. Seguridad y Conflictos
- **Inconsistencias**: Si un Tattoo contradice una observación, emitir `CRITICAL_INCONSISTENCY` y pausar.
- **Circuit Breakers**: Si se detectan ciclos (A->B->A) o exceso de introspección, forzar re-anclaje con el Root Summary.