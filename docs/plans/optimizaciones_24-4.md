# Optimización de rendimiento (24-04-2026)

## 1️⃣ NvidiaAdapter (`paser/infrastructure/nvidia/adapter.py`)
- **max_tokens**: usar un valor dinámico (256‑512) en vez de 1024 para reducir consumo y latencia.
- **Historial**: truncar a los últimos ~10 mensajes o recortar cuando el total supere ~4000 tokens.
- **Conteo de tokens**: reemplazar la heurística `len(text)//4` por la tokenización oficial de Gemini/tiktoken.
- **check_availability**: cachear resultados con TTL (p.ej. 5 min) para evitar llamadas API repetidas.

## 2️⃣ SmartParser (`paser/core/smart_parser.py`)
- Compilar una única expresión regular y usar `re.finditer` para extraer todas las `<TOOL_CALL>` en una pasada (evita O(n²)).
- Validar rápidamente la presencia de `{}` antes de `json.loads` y limitar los re‑intentos.

## 3️⃣ MementoDB (`paser/infrastructure/memento/database.py`)
- Configurar `row_factory` solo una vez en `__init__`.
- Añadir índices en columnas frecuentemente consultadas (`key`, `role`).
- Activar WAL (`PRAGMA journal_mode=WAL;`) para mejorar concurrencia de lecturas/escrituras.
- Reutilizar cursors/prepared statements para inserciones y consultas repetidas.

## 4️⃣ Otros
- Reducir logging a nivel `DEBUG` en producción.
- Crear directorios una sola vez al iniciar la aplicación.
- Limitar profundidad de `list_dir` recursivo.

---

**Próximos pasos**
1. Implementar los cambios en `NvidiaAdapter`.
2. Refactorizar `smart_parser.py`.
3. Mejorar `MementoDB` con índices y WAL.
4. Ejecutar pruebas y medir mejora de tiempo de respuesta.
