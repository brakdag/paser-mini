# Plan de Acción - Proyecto Passer

## 1. Estado Actual
El proyecto Passer es un sistema autónomo de Function Calling basado en el patrón ReAct. Se han implementado las funcionalidades básicas de interacción con el modelo Gemini, un sistema de seguridad para el manejo de rutas (`get_safe_path`) y un conjunto de herramientas locales. Según `TODO.md`, las vulnerabilidades críticas (RCE en calculadora, Path Traversal) ya han sido mitigadas.

## 2. Objetivos a Corto Plazo
- **Verificación de Seguridad**: Realizar una auditoría de código en `passer/tools/tools_functions.py` y `passer/core/chat_manager.py` para confirmar que las mitigaciones de seguridad están operativas.
- **Ampliación de Pruebas**: Implementar tests unitarios y de integración en la carpeta `/tests` para cubrir todos los casos de borde de las herramientas.
- **Optimización de Prompting**: Refinar la `system_instruction` para mejorar la precisión de las llamadas a herramientas y reducir alucinaciones.

## 3. Objetivos a Medio Plazo
- **Memoria Persistente**: Implementar un sistema de memoria a largo plazo (ej. base de datos SQLite o almacenamiento de vectores) para que el agente recuerde interacciones pasadas entre sesiones.
- **Nuevas Herramientas**:
    - Herramienta de ejecución de comandos de sistema controlada (sandbox).
    - Integración con APIs externas adicionales.
    - Herramienta de búsqueda avanzada en archivos (grep-like).
- **Interfaz de Usuario**: Mejorar la experiencia de consola o implementar una interfaz web básica.

## 4. Objetivos a Largo Plazo
- **Soporte Multi-Modelo**: Adaptar `gemini_adapter.py` para soportar otros LLMs (Claude, GPT-4) manteniendo la misma interfaz de herramientas.
- **Orquestación de Agentes**: Permitir que Passer pueda delegar tareas a otros agentes especializados.

## 5. Cronograma Sugerido
1. Semana 1: Auditoría y Testing.
2. Semana 2: Optimización de prompts y nuevas herramientas básicas.
3. Semana 3: Implementación de memoria persistente.
4. Semana 4: Refactorización para soporte multi-modelo.