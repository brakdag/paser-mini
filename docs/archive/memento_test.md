# Plan de Pruebas: Sistema de Memoria Memento

## 1. Objetivo
Verificar el funcionamiento end-to-end del ciclo de vida de la memoria: Sincronización $\rightarrow$ Distilación $\rightarrow$ Puente $\rightarrow$ Salto (Leap).

## 2. Configuración del Entorno de Prueba
- **Modelo**: gemma-3-27b-it (Modelo 11).
- **Límite de Ventana**: 1,500 tokens.
- **Límite de RPM**: 10.
- **Comando de Configuración**: `/w 1500 10`.

## 3. Procedimiento de Prueba

### Fase 1: El Despertar (Sincronización)
1. Iniciar instancia.
2. Ejecutar `pullMemory()` (Efecto Espejo).
3. Verificar que el agente reconoce su identidad y misión.

### Fase 2: Llenado de Contexto
1. Solicitar al agente que lea archivos extensos del proyecto (ej. `README.md`, `paser/core/chat_manager.py`).
2. Monitorear el uso de tokens mediante `getTokenCount()`.
3. Continuar la interacción hasta alcanzar el 80% de la capacidad.

### Fase 3: Distilación (80% $\rightarrow$ 95%)
1. Al llegar al 80%, el agente debe iniciar la extracción de **Activos de Conocimiento**.
2. Ejecutar `pushMemory(scope='fractal', ...)` para guardar puntos clave.

### Fase 4: El Puente (95% $\rightarrow$ 100%)
1. Al llegar al 95%, el agente debe generar un **Bloque Puente (Bridge Block)**.
2. Guardar el puente mediante `pushMemory` con el teaser `BRIDGE: [Resumen de Sesión]`.

### Fase 5: El Salto (Leap)
1. Forzar el llenado al 100% o ejecutar un Hard Reset manual.
2. Verificar que el historial se limpie (`history = []`).
3. Verificar que la nueva sesión inicie cargando el **Bloque Puente** y las **Instrucciones del Sistema**.

## 4. Criterios de Aceptación
- [ ] El agente no pierde el hilo de la tarea tras el Salto.
- [ ] Los tokens se cuentan correctamente y disparan las alertas.
- [ ] `refresh_session()` elimina cualquier rastro de la sesión anterior (sin ghosting).
- [ ] La navegación narrativa (`direction='prev'`) permite volver a nodos anteriores al salto.

## 5. Notas sobre Archivos
**Pregunta**: ¿Cómo se recuperan los archivos de la memoria?
**Respuesta**: El sistema Memento no guarda el archivo completo en la DB (para evitar saturarla), sino que guarda **referencias y resúmenes**. 
- **Guardado**: El agente hace un `pushMemory` con el resumen del archivo y la ruta del mismo.
- **Recuperación**: El agente usa `pullMemory` $\rightarrow$ encuentra la ruta del archivo $\rightarrow$ usa `readFile` para leer el contenido actualizado del disco.