# 🛠️ Paser Mini: Tool Validation Suite

Este documento sirve como benchmark para validar la operatividad de las herramientas del agente. El objetivo es ejecutar cada desafío y confirmar que la herramienta responde según lo esperado.

## 📋 Instrucciones para el Agente
1. Lee cada desafío secuencialmente.
2. Ejecuta las herramientas necesarias para completar la tarea.
3. Verifica el resultado.
4. Si una herramienta falla, reporta el error exacto y el argumento utilizado.

---

## 🧪 Desafíos de Validación

### 1. Operaciones de Archivos (Básico)
- [ ] **Creación y Lectura**: Crea un archivo llamado `test_agent_val.txt` con el contenido "Validación de herramientas exitosa". Luego, léelo para confirmar que el contenido es correcto.
- [ ] **Modificación**: Usa `replace_string` para cambiar "exitosa" por "completada" en `test_agent_user.txt`.
- [ ] **Limpieza**: Elimina el archivo `test_agent_val.txt`.

### 2. Exploración y Búsqueda
- [ ] **Mapeo de Directorio**: Lista el contenido de la carpeta `src/core/schemas` y cuenta cuántos archivos `.json` hay.
- [ ] **Búsqueda Global**: Busca la cadena "Paser Mini" en todo el proyecto y enumera los archivos donde aparece.
- [ ] **Patrones de Archivo**: Busca todos los archivos que terminen en `.js` dentro de `src_js/core`.

### 3. Manipulación de JSON
- [ ] **Estructura**: Crea un archivo `test_data.json` con un objeto anidado (ej: `{"user": {"id": 1, "meta": {"role": "admin"}}}`).
- [ ] **Acceso**: Usa `get_json_node` para extraer el valor de `user.meta.role`.
- [ ] **Actualización**: Usa `update_json_node` para cambiar el rol a "super-admin" y verifica el cambio.

### 4. Memoria y Contexto (Memento)
- [ ] **Almacenamiento**: Guarda en la memoria (`push_memory`) la siguiente información: `{"key": "test_secret", "value": "Paser-12345"}`.
- [ ] **Recuperación**: Recupera la información usando `pull_memory` con la clave `test_secret`.

### 5. Herramientas de Desarrollo
- [ ] **Análisis de Código**: Ejecuta `analyze_pyright` sobre cualquier archivo `.py` del proyecto y reporta si hay errores.
- [ ] **Ejecución de Script**: Crea un script simple de Python que imprima "Hello from Paser" y ejecútalo usando `run_python`.

### 6. Flujo de Trabajo Complejo (Stress Test)
- [ ] **El Desafío del Auditor**: 
    1. Busca todos los archivos en `src_js/` que contengan la palabra "TODO" o "FIXME".
    2. Crea un archivo llamado `audit_report.md`.
    3. Escribe en ese archivo una lista de los archivos encontrados y la línea aproximada.
    4. Lee el reporte final para confirmar que la auditoría se completó.
    5. Elimina el reporte.

---

## 🚩 Matriz de Resultados
| Categoría | Estado | Notas |
| :--- | :---: | :--- |
| Archivos | ⚪ | |
| Búsqueda | ⚪ | |
| JSON | ⚪ | |
| Memoria | ⚪ | |
| Dev Tools | ⚪ | |
| Flujo Complejo | ⚪ | |
