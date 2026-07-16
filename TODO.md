## Plan: Integración de Model Context Protocol (MCP)

### Objetivo
Incorporar el estándar MCP para permitir que el agente consuma herramientas externas (servidores MCP locales o remotos) inyectándolas dinámicamente en el ciclo ReAct sin acoplar código innecesario.

### Fases de Implementación

1. **Instalación de Dependencias**
   - [x] Añadir el SDK oficial: `npm install @modelcontextprotocol/sdk`

2. **Configuración (Config Manager)**
   - [x] Crear soporte para un archivo `mcp_config.json` (o sección en `.env`) para definir qué servidores MCP cargar (ej. stdio para procesos locales, sse para remotos).

3. **Infraestructura MCP (McpManager)**
   - [x] Crear `src/infrastructure/McpManager.js`.
   - [x] Implementar la lógica para inicializar servidores MCP definidos en la config usando el SDK.
   - [x] Obtener la lista de herramientas (tools) expuestas por los servidores MCP al arrancar.

4. **Registro Dinámico de Herramientas (Schema Registry)**
   - [x] Adaptar `schemaRegistry.js` y `smartParser.js` para aceptar esquemas definidos por MCP (en formato JSON Schema) y transformarlos para que el validador nativo los acepte, o validarlos dinámicamente en tiempo de ejecución.
   - [x] Asegurar que las herramientas MCP se incluyan en el System Prompt para que el modelo sepa que existen y su sintaxis.

5. **Distribución y Ejecución (Execution Engine)**
   - [x] Modificar `executionEngine.js`: Si la herramienta solicitada tiene el prefijo `mcp_` o pertenece al mapa de herramientas remotas, enrutar la llamada a través del cliente MCP en lugar del mapa de herramientas local.

6. **Consumo de MCPs Estándar del Ecosistema**
   - [x] Crear archivo de configuración `mcp.json` usando el formato estándar de Anthropic (definiendo `command` y `args`).
   - [x] Configurar un servidor MCP oficial estándar (ej. `npx @modelcontextprotocol/server-memory`).
   - [x] Ejecutar una sesión del agente demostrando que consume herramientas del servidor externo real sin necesidad de programarlas internamente.