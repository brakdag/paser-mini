# Análisis del Proyecto: Paser Mini

## Resumen
Paser Mini es un agente autónomo minimalista diseñado para entornos Linux/Debian, basado en el modelo Gemini de Google. Su arquitectura se centra en el patrón ReAct (Reasoning and Acting) para ejecutar tareas de forma eficiente con un uso mínimo de recursos.

## Componentes Principales
- **Core Engine (`paser/core/`)**: Orquestador central que gestiona el ciclo de chat, la ejecución de herramientas y la prevención de bucles infinitos.
- **Infraestructura (`paser/infrastructure/`)**: Capa de abstracción para la API de Gemini, manejo de errores y persistencia de sesiones.
- **Toolbox (`paser/tools/`)**: Conjunto de herramientas esenciales para manipulación de archivos, búsqueda, análisis estático (Pyright) y ejecución de instancias delegadas.

## Filosofía de Desarrollo
- **Minimalismo**: Eliminación de dependencias pesadas para una instalación rápida.
- **Seguridad**: Acceso a archivos restringido al directorio raíz mediante `get_safe_path`.
- **Calidad de Código**: Enfoque en estándares PEP 8, tipado estricto y principios SOLID.

## Flujo de Trabajo
1. El usuario interactúa a través de una interfaz de terminal (`rich` + `prompt_toolkit`).
2. El `ChatManager` procesa la entrada y, si es necesario, invoca herramientas mediante el `ToolParser`.
3. Las herramientas ejecutan operaciones locales y devuelven resultados al modelo para completar el razonamiento.
4. La respuesta final se presenta al usuario.

## Comandos Clave
- `/s`: Guardar snapshot.
- `/t`: Ver conteo de tokens.
- `/models`: Configurar modelo y temperatura.

## Consideraciones de Desarrollo
- El sistema mantiene estado interno; se recomienda iniciar nuevas instancias para verificar cambios en el código.
- Se utiliza `run_instance` para delegar tareas de prueba a agentes secundarios.