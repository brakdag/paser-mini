# Plan: Golpe de Puño (Emergency Stop)

## 🎯 Objetivo
Implementar un mecanismo de interrupción de emergencia que permita al usuario detener la autonomía del agente en tiempo real mediante la tecla `Esc`, permitiendo una intervención manual inmediata antes de reanudar la ejecución.

## 🛠️ Descripción Técnica

### 1. El Problema
Actualmente, cuando el agente entra en el loop de `ChatManager.execute`, el programa está procesando respuestas del LLM y ejecutando herramientas. En este estado, el hilo principal no está esperando un input del usuario a través de `prompt_toolkit`, por lo que las teclas presionadas no son procesadas hasta que el agente termina su ciclo o encuentra un error.

### 2. La Solución: Escucha Asíncrona
Para lograr un "Golpe de Puño" real, implementaremos un listener de teclado en un hilo separado o mediante una tarea de `asyncio` que monitoree la tecla `Esc` de forma global en la terminal.

### 3. Flujo de Trabajo
1. **Detección:** Un listener detecta la pulsación de la tecla `Esc`.
2. **Interrupción:** Se activa la bandera `self.stop_requested = True` en el `ChatManager`.
3. **Frenado:** El loop de `execute` verifica `stop_requested` en cada iteración. Al detectarlo, detiene la ejecución de la herramienta actual (si es posible) o aborta la siguiente llamada.
4. **Feedback Visual:** La `TerminalUI` imprime un mensaje disruptivo: `🛑 [GOLPE DE PUÑO] - AGENTE DETENIDO`.
5. **Intervención:** El sistema invoca inmediatamente a `ui.request_input("> Intervención Manual: ")`.
6. **Reanudación:** El mensaje del usuario se envía al LLM como una instrucción correctiva y el agente retoma su autonomía desde ese nuevo estado.

## 📅 Pasos de Implementación

- [ ] **Fase 1: Infraestructura de Input**
    - Investigar e implementar un listener de teclado no bloqueante (usando `pynput` o `termios` para Linux).
    - Integrar el listener en `main.py` para que se inicie al lanzar la aplicación.

- [ ] **Fase 2: Modificación del Core (`ChatManager`)
    - Refinar la comprobación de `stop_requested` dentro del loop de herramientas.
    - Implementar la lógica de "Intervención Manual" que rompe el loop y solicita input.

- [ ] **Fase 3: Interfaz de Usuario (`TerminalUI`)
    - Crear el método `display_emergency_stop()` para mostrar el aviso de detención.
    - Asegurar que el spinner de herramientas se detenga inmediatamente al presionar `Esc`.

- [ ] **Fase 4: Pruebas y Validación**
    - Probar la interrupción durante una tarea larga (ej. leer muchos archivos).
    - Validar que la autonomía se recupere correctamente tras la intervención.

## ⚠️ Consideraciones
- **Dependencias:** Si se usa `pynput`, se deberá actualizar `pyproject.toml`.
- **Sincronización:** El listener debe comunicarse con el `ChatManager` de forma segura entre hilos (Thread-safe).