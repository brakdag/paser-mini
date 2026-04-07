# 🚀 Plan de Implementación: Paser

## 🎯 Navegador de Código (LSP-like) - ✅ Completado
Implementar un sistema de navegación de código que permita a la IA realizar saltos a definiciones, búsqueda de referencias y listado de símbolos.

- [x] **Crear `paser/tools/code_navigator.py`**: Desarrollar script basado en `ast`.
- [x] **Implementar `get_definition`**: Buscar declaración de función/clase.
- [x] **Implementar `get_references`**: Buscar ocurrencias de un símbolo.
- [x] **Implementar `list_symbols`**: Extraer definiciones de un archivo.
- [x] **Validación de Integración**: Verificado el funcionamiento mediante llamadas a herramientas en `test_nav.py`, `main.py` y `utils.py`.

---

## 📋 Tareas Pendientes

### 📣 Manejo de Conectividad de Red
**Problema**: El programa se cierra abruptamente (crash) cuando no hay conexión a internet al intentar contactar la API de Gemini.

**Objetivo**: Implementar un manejo de excepciones robusto para fallos de red.

**Requerimientos**:
- [ ] Identificar el punto de falla en la llamada a la API (probablemente en `main.py` o el cliente de Gemini).
- [ ] Capturar la excepción de red (ej. `requests.exceptions.ConnectionError` o similar de la SDK de Google).
- [ ] Mostrar un mensaje claro al usuario: "⚠ Error: No se ha detectado conexión a internet. Por favor, verifica tu red."
- [ ] 

### ✅ Implementación de Comando `/t` (Contexto)
- [x] Investigar si la API de Gemini permite obtener el conteo de tokens actual.
- [x] Implementar la lógica del comando `/t` en `commands.py`.
- [x] Validar la salida del comando.
