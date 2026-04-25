# Memento: Sistema de Memoria a Largo Plazo

## 1. Filosofía y Metodología
El sistema Memento soluciona la amnesia de los LLMs mediante la **Cognición Externalizada**.
- **Tape Recorder (Sesión)**: Volátil, ruidoso, FIFO.
- **Notebook (Memento)**: Curado, persistente, crítico.
- **Regla de Oro**: No resumas la historia; extrae la esencia. ¿Es esta información vital para la supervivencia del proyecto?

### Jerarquía de Memoria
1. **Vital Tattoos (La Piel)**: Verdades inmutables (identidad, restricciones). Se leen al iniciar.
2. **Root Summary (El Espejo)**: Estado de alto nivel del proyecto.
3. **Fractal Nodes (El Grafo)**: Chunks atómicos vinculados por citas y threads temporales.

## 2. Protocolo de Perspectivas y Roles
La memoria no es monolítica, es una colección de **Perspectivas Basadas en Roles**.
- **Shift de Perspectiva**: Al cambiar de rol, no sobreescribas; cita el registro histórico.
- **Auditoría de Transición**: Al cambiar de rol, revisa los "Tattoos" vitales y evalúa conflictos. Si hay contradicción, marca `CRITICAL_INCONSISTENCY` y solicita intervención humana.

## 3. Mapa de Documentación y Ejecución
| Sección | Foco |
| :--- | :--- |
| **Metodología** | Fundamentos conceptuales y analogía del tatuaje. |
| **Protocolo** | Reglas de comportamiento, roles y auditoría. |
| **Implementación** | Arquitectura técnica (SQLite, Grafo Cognitivo). |
| **Operación** | Flujos de trabajo (Snapshot, Flush, Bootstrapping). |

## 4. Mantenimiento
1. **Compress**: Resumir cada 500 tokens.
2. **Append**: Añadir a `CHRONOLOGY.log`.
3. **Reset**: Limpiar contexto interno, manteniendo solo el resumen y la misión.