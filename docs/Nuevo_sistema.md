# Nuevo Sistema: Arquitectura de Flujo Único y Transparente

## Objetivo

Construir un sistema de comunicación donde la representación visual (lo que el usuario ve en el chat) y el registro de datos (`session.log`) sean una única fuente de verdad, eliminando la discrepancia entre la identidad del usuario y el contenido de los mensajes.

## Principios de Diseño

1. **Transparencia Total:** Lo que se ve en la interfaz debe ser lo que se registra en el log.
2. **Identidad Dinámica (IRC-Style):** El sistema utiliza el formato estándar de IRC `[TIMESTAMP] <NICK> MESSAGE`. La identidad es fluida: el usuario y el modelo pueden cambiar su nick en cualquier momento para reforzar su rol o estado.
3. **Filtro de Ruido en la Visualización:** Las llamadas a herramientas se procesan en el flujo, pero se omiten exclusivamente en la capa de renderizado para mantener la limpieza visual.
4. **Arquitectura de Adaptadores:** Uso de módulos independientes para Gemini y Nvidia, permitiendo la intercambiabilidad sin afectar el núcleo del sistema.
5. **Soberanía de Datos:** El `session.log` es un espejo fiel de la experiencia del usuario, incluyendo los nicks y timestamps, pero sin el ruido técnico de las llamadas a herramientas.
6. **Transparencia Total:** Lo que se ve en la interfaz debe ser lo que se registra en el log.
7. **Filtro de Ruido en la Visualización:** Las llamadas a herramientas (`tool_calls`) y sus respuestas técnicas se procesarán en el flujo, pero se omitirán exclusivamente en la capa de renderizado para mantener la limpieza visual.
8. **Identidad Consistente:** El `request`, el `session.log` y la interfaz deben utilizar el mismo identificador de usuario sin transformaciones intermedias.
9. **Arquitectura de Adaptadores:** Uso de módulos independientes para Gemini y Nvidia, permitiendo la intercambiabilidad sin afectar el núcleo del sistema.

## Estructura Propuesta

- `/core`: Motor de eventos y gestión de estado.
- `/identity`: Subcapa de IRC (Gestión de Nicks, Inyección y Parsing de Identidad).
- `/adapters`: Implementaciones de modelos (Gemini, Nvidia, etc.).
- `/io`: Gestión de entrada/salida (Chat UI, `session.log`, `requests`).
- `/filters`: Lógica de limpieza de ruido para la visualización.
- `/core`: Motor de eventos y gestión de estado.
- `/adapters`: Implementaciones de modelos (Gemini, Nvidia, etc.).
- `/io`: Gestión de entrada/salida (Chat UI, `session.log`, `requests`).
- `/filters`: Lógica de limpieza de ruido para la visualización.

## Roadmap de Implementación

- [ ] Definición del esquema de objeto de mensaje único.
- [ ] Implementación del motor de eventos básico.
- [ ] Migración de adaptadores existentes.
- [ ] Desarrollo del renderizador con filtro de ruido.
- [ ] Pruebas de consistencia (UI vs Log).
