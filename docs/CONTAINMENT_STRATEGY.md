# Estrategia de Contención y Ejecución: Paser Mini

## Objetivo

Proveer un entorno de ejecución (sandbox) para agentes de IA que permita la libertad de acción mediante la herramienta `sh`, pero con límites estrictos para prevenir comportamientos erráticos o destructivos en el sistema anfitrión.

## Capas de Seguridad (Contención)

### 1. Control de Procesos (Anti-Bucle Infinito)

- **Límite de CPU:** Restricción de ciclos de CPU para evitar que un proceso en bucle sature el procesador.
- **Timeouts:** Implementación de límites de tiempo por comando ejecutado a través de la herramienta `sh`.

### 2. Control de Recursos (Anti-Crash de RAM)

- **Memoria Limitada:** Definición de un `mem_limit` estricto en el `docker-compose.yml`. Si el agente intenta un proceso que exceda este límite, el contenedor se reiniciará o detendrá sin afectar la RAM del sistema anfitrión.
- **Swap Limit:** Restricción del uso de memoria virtual para evitar latencia en el sistema.

### 3. Control de Red (Anti-Deriva de Internet)

- **Aislamiento de Red:** Configuración por defecto de `network_mode: none` para evitar que el agente realice peticiones no autorizadas o se pierda en la red.
- **Acceso Selectivo:** Solo se habilitará la red si la tarea específica lo requiere, y bajo una configuración de proxy o firewall controlada.

## Arquitectura de Implementación

### Herramienta: `sh`

- El agente no ejecutará comandos directamente en el host.
- Los comandos serán enviados al contenedor de Node.js mediante `docker exec` o una interfaz de socket.
- El volumen de proyecto será montado como `read-write` para permitir la persistencia de archivos, pero el resto del sistema será `read-only`.

### Stack Tecnológico

- **Runtime:** Docker / Docker Compose.
- **Base:** Imagen oficial de Node.js (usuario `node`).
- **Orquestación:** `docker-compose.yml` como fuente de verdad de las restricciones.
