# Plan de Separación de Lógica y Capa de Presentación (UI)

## 1. Objetivo
Desacoplar completamente la lógica de negocio, la orquestación del agente y la gestión de comandos de la implementación específica de la interfaz de usuario (actualmente basada en consola/terminal). El objetivo es que el núcleo del programa sea agnóstico a la salida, permitiendo en el futuro cambiar la UI (ej. a una interfaz web o GUI) sin modificar la lógica interna.

## 2. Análisis de "Fugas" de UI Actuales
Tras la exploración del proyecto, se han identificado los siguientes puntos donde la lógica está acoplada a la salida estándar:

- **`paser/core/commands.py`**: Es el punto más crítico. Contiene múltiples llamadas directas a `print()` para informar sobre el guardado de snapshots, conteo de tokens y cambios de configuración.
- **`paser/core/chat_manager.py`**: Aunque utiliza la clase `TerminalUI`, todavía contiene llamadas a `print("\n")` para manejar el espaciado visual.
- **`paser/main.py`**: Contiene `print()` directos durante la ejecución de unit tests y espaciados.
- **`paser/core/terminal_ui.py`**: Actualmente es una implementación concreta. No existe una interfaz abstracta que defina el contrato de comunicación entre la lógica y la UI.

## 3. Estrategia de Implementación

### Fase 1: Definición del Contrato (Abstracción)
- **Crear `paser/core/ui_interface.py`**: Definir una Clase Base Abstracta (ABC) llamada `UserInterface`.
- **Definir métodos obligatorios**:
    - `display_message(text: str)`
    - `display_error(message: str)`
    - `display_info(message: str)`
    - `display_thought(text: str)`
    - `request_input(prompt: str) -> str`
    - `display_tool_status(tool_name: str, success: bool, detail: str)`
    - `display_panel(title: str, message: str)`

### Fase 2: Refactorización de la Implementación Concreta
- Hacer que `TerminalUI` herede formalmente de `UserInterface`.
- Asegurar que todos los métodos de la interfaz estén implementados en `TerminalUI`.

### Fase 3: Inyección de Dependencias y Limpieza
- **`CommandHandler`**: Modificar el constructor para recibir una instancia de `UserInterface`. Reemplazar todos los `print()` por llamadas a `self.ui.display_info()` o `self.ui.display_message()`.
- **`ChatManager`**: Reemplazar los `print("\n")` por un método en la interfaz (ej. `ui.add_spacing()`) o delegar la gestión del formato al método de renderizado de la UI.
- **`main.py`**: Inyectar la instancia de la UI en todos los componentes necesarios y eliminar los `print()` residuales.

### Fase 4: Validación y Pruebas
- Verificar que no existan llamadas a `print` o `sys.stdout.write` fuera de la carpeta `paser/core/terminal_ui.py` (o el nuevo módulo de UI).
- Implementar una `MockUI` (UI de prueba) para ejecutar tests unitarios sin necesidad de interactuar con la terminal.

## 4. Mapa de Dependencias Final Esperado
`Main` $ightarrow$ `UserInterface` (Instancia de `TerminalUI`)
`Main` $ightarrow$ `ChatManager` (Recibe `UserInterface`)
`ChatManager` $ightarrow$ `CommandHandler` (Recibe `UserInterface`)
`ChatManager` $ightarrow$ `GeminiAdapter` (Lógica pura, usa `logging`)
`CommandHandler` $ightarrow$ `UserInterface` (Para feedback al usuario)

## 5. Notas para el Desarrollador
- **No modificar la lógica de los comandos**, solo la forma en que emiten la información.
- **Mantener la compatibilidad** con los keybindings de Vim ya implementados en la capa de UI.
- **Priorizar el uso de `logging`** para depuración técnica y la `UserInterface` solo para información destinada al usuario final.