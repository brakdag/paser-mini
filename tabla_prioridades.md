# Tabla de Prioridades - Operación Absolute Zero

## 🔴 PRIORIDAD CRÍTICA: Bloqueadores y Riesgos de Estabilidad
*Componentes que causan latencia sistémica, bloquean el Event Loop, arriesgan el crash o ignoran la arquitectura base (Rating F/D).*

| Componente | Problema Crítico | Impacto | Rating |
|---|---|---|---|
| `schemaValidator.js` | I/O Sincrónico en cada validación | Latencia extrema / Bloqueo | F |

| `logger.js` | `appendFileSync` sistémico | Jitter y Latencia | F |
| `SessionLogger.js` | `appendFileSync` sistémico | Bloqueo de Event Loop | F |
| `configManager.js` | `readFileSync`/`writeFileSync` | Bloqueo de Event Loop | F |
| `transportLayer.js` | Wrapper redundante / Ignorado por adapters | Ghost Layer / Fricción | F |
| `chatManager.js` | God Object / Tokenización ficticia | Punto único de fallo | F |
| `gemini_adapter.js` | Bypass de Infraestructura / Estado Fragmentado | Inconsistencia Sistémica | D- |
| `cohere_adapter.js` | Bypass de Infraestructura / Estado Fragmentado | Inconsistencia Sistémica | D |
| `groq_adapter.js` | Duplicación Extrema / Bypass de Infraestructura | Redundancia / Inconsistencia | D |
| `openrouter_adapter.js` | Duplicación Extrema / Bypass de Infraestructura | Redundancia / Inconsistencia | D |
| `turnProcessor.js` | Método Monolítico / Recuperación frágil | Inestabilidad / Complejidad | D |
| `smartParser.js` | Parser manual frágil / I/O Sincrónico | Fallos de parsing / Bloqueo | D |
| `systemPromptManager.js` | Configuración vía Regex / I/O Sincrónico | Fragilidad total de config | D |
| `executionEngine.js` | Pesadilla de Mapeo / Errores en string | Mantenimiento imposible | D |
| `payloadMapper.js` | Capa de grasa / Mapeo manual | Cuello de botella | D |
| `conversationState.js` | Fuga de lógica de presentación en estado | Violación de SoC | D |
| `FountainAdapter.js` | Mutación destructiva del historial | Pérdida de datos | D |
| `autoCorrector.js` | Lógica de 'parche' / Regex frágiles | Comportamiento impredecible | D |

## 🟡 PRIORIDAD MEDIA: Ineficiencias y Ruido
*Componentes funcionales pero mal diseñados o con overhead innecesario (Rating C/C-).*

| Componente | Problema Crítico | Impacto | Rating |
|---|---|---|---|
| `nvidia_adapter.js` | Cliente de Red Custom / Tokenización Ficticia | Inconsistencia de Transporte | C |
| `TerminalRenderer.js` | Layout fuerza bruta / Regex Overload | CPU Waste | C- |
| `terminalUI.js` | Anti-patrón de Wrapper / Fuga de lógica | Overhead de stack | C- |
| `repetitionDetector.js` | Tokenización ingenua | Falsos negativos | C- |
| `githubModeOrchestrator.js` | Fuga de abstracción / Procesamiento lineal | Lentitud / Acoplamiento | C- |
| `ApiCommunicator.js` | Bucle de recuperación recursivo | Desperdicio de tokens | C |
| `commandHandler.js` | Tabla de rutas manual | Falta de escalabilidad | C |
| `baseAdapter.js` | Simulación de interfaz en runtime | Fragilidad de contrato | C |
| `githubUI.js` | I/O Fire-and-Forget | Race Conditions | C |

## 🟢 PRIORIDAD BAJA: Peso Muerto y Refactorización
*Componentes con bajo impacto o redundancias menores (Rating B/B-).*

| Componente | Problema Crítico | Impacto | Rating |
|---|---|---|---|
| `diagnostic_schemas.js` | Código de debug en producción | Peso muerto | D |
| `exceptions.js` | Capa de re-exportación redundante | Ruido de módulo | C |
| `schemaRegistry.js` | Wrapper redundante | Ruido de módulo | C |
| `validationResult.js` | Sobre-ingeniería (DTO como clase) | Boilerplate innecesario | C |
| `providerManager.js` | Registro hardcodeado | Rigidez | B- |
| `schemas.js` | Duplicación de datos de herramientas | Mantenimiento manual | B- |
| `TerminalInput.js` | Gestión manual de colas | Falta de elegancia | B- |
| `toolTracker.js` | Generación de keys ineficiente | CPU Waste (mínimo) | B |

## 📋 Cumplimiento QMS (ISO 9001)
*Gaps normativos que deben cerrarse para formalización.*

| Cláusula | Descripción | Prioridad | Estado |
|---|---|---|---|
| 4.2 | Identificación de Partes Interesadas | **Alta** | 🔴 Missing |
| 5.2 | Política de Calidad Formal | **Alta** | 🔴 Missing |
| 6.2 | Objetivos de Calidad Medibles | **Alta** | 🔴 Missing |
| 8.7 | Proceso de Salidas No Conformes | **Alta** | 🔴 Missing |
| 10.2 | Bucle de Acciones Correctivas | **Alta** | 🔴 Missing |
| 4.1 | Contexto de la Organización | **Media** | 🟡 Partial |
| 4.3 | Alcance del QMS | **Media** | 🟡 Partial |
| 4.4 | Interacciones de Procesos y KPIs | **Media** | 🟡 Partial |
| 7.5 | Control de Información Documentada | **Media** | 🟡 Partial |
| 8.3 | Revisión y Validación de Diseño | **Media** | 🟡 Partial |
| 8.6 | Liberación de Productos | **Media** | 🟡 Partial |
| 9.1 | Monitoreo y Medición | **Media** | 🟡 Partial |