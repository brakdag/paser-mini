# Auditoría de código — 2026-11-09

Se confirmaron **seis defectos mediante reproducciones locales** y se definió una tarea adicional de deuda de tipos. El backlog vigente está en [TODO.md](../../../TODO.md). La implementación auditada no se modificó.

## Estado y método

- Base: `011d981bc119dfb64f58fddd37b9603185a5878e` (`finished task`), Node **v26.5.0**, Linux. `git status --short` estaba vacío al comenzar: no había cambios locales que incorporar al análisis.
- Se consultaron [el historial anterior](../../work-history-2026-11-09.md), README, operaciones, contratos de resultados y documentación de tipos como antecedentes. Los cierres previos no se tomaron como prueba de ausencia de defectos.
- Se realizó lectura dirigida del arranque/cierre, sesiones y reconfiguración, turnos e historial, parser/esquemas/ejecución, MCP, persistencia, política de rutas, herramientas de archivos, JSON, binarios, Git, web e inspección y contratos compartidos de proveedores. Se contrastaron los hallazgos con los tests existentes y la suite completa. No es una comprobación formal de todas las rutas posibles.
- El requisito previo de **GPT-6 Astra / ultra high en una nueva sesión** no se puede cambiar ni acreditar desde esta sesión. Este informe registra la auditoría técnica realizada y esa limitación; no certifica la selección solicitada.
- No se consultaron servicios reales ni se publicaron comentarios en GitHub. Los transportes de modelo, metadata, GitHub y MCP del reproductor son simulados. La única shell de la reproducción imprime `partial` y sale con código 7.

## Evidencia reproducible

Desde el repositorio, con sus dependencias ya instaladas:

```sh
node docs/audits/2026-11-09/reproduce.mjs
```

[reproduce.mjs](reproduce.mjs) crea un proyecto temporal, ejecuta el código real mediante imports, inyecta configuración y transportes y elimina únicamente ese fixture al finalizar. El hijo recibe una lista acotada de variables de entorno sin credenciales ni configuración de usuario. No escribe en los logs ni en la configuración reales.

**Es un reproductor del estado defectuoso, no una suite de aceptación.** Sus aserciones exigen los comportamientos incorrectos observados; un arreglo puede hacerlo fallar. [observed.jsonl](observed.jsonl) conserva la salida de esta auditoría, con código de salida **0**:

| Caso | Estímulo controlado | Observación confirmada |
| --- | --- | --- |
| A01 | Demorar metadata de Cerebras mientras `runOnce` recibe una pregunta | Primer payload con roles `["user"]`; el prompt de sistema aparece después |
| A02 | Limitar solicitudes a 1 al reescribir y errores a 1 en una issue | Reescritura informa éxito sin restaurar historia; GitHub genera comprobante de completado y omite el segundo intento |
| A03 | Reemplazar `TOKEN` por `cost=$$; matched=$&` | Archivo resultante contiene `cost=$; matched=TOKEN` |
| A04 | Ejecutar `printf partial; exit 7` a través del engine real | `success: true`, `isError: false`, salida con exit 7 |
| A05 | Anunciar una segunda página MCP mediante `nextCursor` | Una sola consulta; faltan herramienta y esquema de la segunda página |
| A06 | Segundo turno mientras el primero espera transporte | Se rechaza el segundo pero se libera la bandera; se acepta cambiar el prompt durante el primero |

A01 comprueba `runOnce` directamente; la afectación del arranque interactivo se deduce de sus llamadas al mismo método sin espera. A06 demuestra una recarga concurrente del prompt; no se afirma haber reproducido todas las consecuencias posibles de reemplazar el proveedor durante ese intervalo. A05 usa el contrato de paginación del SDK instalado, verificado en su código; no depende de suponer el comportamiento de un servidor remoto concreto.

## Controles ejecutados

| Control | Resultado actual | Alcance de la evidencia |
| --- | --- | --- |
| `npm run check`, fase lint | Aprobado, cero avisos/errores | `src`, `tests`, `scripts` según configuración vigente |
| `npm run check`, fase typecheck | Aprobado frente al inventario: **170 diagnósticos admitidos** | No equivale a `tsc` sin errores |
| Primera suite dentro del sandbox | **702 tests, 655 aprobados, 47 fallos**, exit 1 | Incluyó `spawnSync EPERM`, denegación de socket `NETLINK_ROUTE` de Bubblewrap y fallos derivados de subprocesos; no se usa como evidencia de 47 defectos de producto |
| `npm test`, repetición autorizada fuera del sandbox | **702 tests, 33 suites, 702 aprobados, 0 fallos, 0 omitidos**, exit 0 | Proyecto temporal y HOME temporal creados por `scripts/test.js`, sin credenciales heredadas; duración informada **105654.374099 ms** |
| Reproductor A01–A06 | **6 casos confirmados**, exit 0 | Código real, casos deterministas y transportes simulados |
| `git diff --check` | Aprobado | Integridad de los cambios de documentación |

La repetición usó exactamente la misma implementación, sin arreglos ni cambios de timeout entre corridas. No se repitieron lint ni tipos porque sus fases ya habían pasado. La suite actual tiene 702 casos; los 687 citados en el historial corresponden a una verificación anterior.

Logs auxiliares de esta sesión: `/tmp/paser-audit-20261109-check.log`, `/tmp/paser-audit-20261109-tests-unrestricted.log` y `/tmp/paser-audit-20261109-reproductions.log`. Son temporales; los resultados relevantes quedan conservados en este informe y en `observed.jsonl`, y los comandos permiten repetirlos.

No se ejecutó Node 24 real ni una instalación limpia, ni se verificaron disponibilidad de modelos, credenciales, generación remota o notificaciones dinámicas de un servidor MCP real. La matriz 24/26 de [checks.yml](../../../.github/workflows/checks.yml) es configuración de CI, no evidencia de una ejecución de CI en esta auditoría. La aprobación de las 702 pruebas existentes no cubre los seis escenarios adicionales: todos se reprodujeron contra el código que pasó la suite.

## Revisión de límites documentados

| Área | Código y contrato revisados | Decisión para este ciclo |
| --- | --- | --- |
| Rutas y mutaciones | `pathValidator.js`, consumidores y política de README: comprobación seguida de uso, sin protección completa ante cambios concurrentes o hardlinks | No se crea una tarea de aislamiento total a partir de una garantía que no se ofrece. No se reprodujo una evasión nueva fuera de esos límites |
| `run` | `evalTools.js`: Bubblewrap, montajes, procesos y plazos; README limita cuotas por proceso y advierte sobre hardlinks/sockets Unix del proyecto | La suite fuera del sandbox verifica sus casos actuales. Cuotas agregadas y aislamiento de esos inodos siguen fuera del contrato; no se trasladó T02 automáticamente |
| Contexto | `contextBudget.js` y `baseAdapter.js`: estimación, mínimo blando y truncamiento explícito | Un payload que excede un presupuesto imposible no es por sí solo una regresión. La política actual difiere de algunas notas históricas de T11; se usa el contrato vigente de operaciones |
| Persistencia | `configManager.js`, `mementoManager.js`: reemplazo de configuración por archivo y cola de memoria por proceso | Concurrencia entre procesos y transacción de memoria ante fallos de disco están excluidas explícitamente. No se reabrió T18 por esas limitaciones |
| Efectos y recuperación | Operaciones, `rewriteLastTurn`, turnos y batch GitHub | Los efectos ya realizados no se revierten. Eso no autoriza informar un turno incompleto como exitoso: se registra A02 |
| Recursos y cierre | Lifecycle, logger, inspector, registro de herramientas y MCP | Se verificó la suite existente. No se midió el crecimiento de RAM por backpressure de `session.log`; sus llamadas a `write` no esperan `drain` (`logger.js:197,209`). La hipótesis de crecimiento significativo requiere una prueba con escritor lento y medición antes de asignarle impacto o una tarea de corrección |

Las limitaciones conocidas se evaluaron contra el alcance solicitado. Ampliarlas puede ser una decisión de producto futura; no se presentan como defectos nuevos confirmados.

## Revisión de tipos

La lectura del inventario y la ejecución del control actual coinciden:

| Área | Entradas agrupadas | Ocurrencias de diagnóstico |
| --- | --- | --- |
| `src/` | 41 | 65 |
| `tests/` | 61 | 105 |
| `scripts/` | 0 | 0 |
| Total | 102 | 170 |

En producción hay 44 ocurrencias TS2339, 12 TS2353, 6 TS2345, 2 TS2416 y 1 TS2322. Se contrastaron expresiones y código, sin regenerar la baseline. No se encontró que estos 170 diagnósticos equivalgan a 170 defectos funcionales. A07 define una tanda concreta de firmas y fronteras de configuración, con revisión del inventario; los errores extendidos de transporte/OS y mocks quedan identificados para trabajo posterior.

Las interfaces ampliamente declaradas como `object` y las promesas descartadas no quedan protegidas solo porque el inventario se mantenga estable. Los defectos A01 y A02 justifican describir mejor esos contratos al corregirlos, pero las anotaciones deben acompañarse de las pruebas de comportamiento indicadas. No se propone desactivar `checkJs`, ampliar exenciones ni migrar todo el proyecto a TypeScript.

## Entrega y seguimiento

Los seis defectos tienen una reproducción verificable; A07 es deuda confirmada, explícitamente separada de un fallo de ejecución. La hipótesis de backpressure queda sin impacto demostrado ni ticket de corrección. Cada tarea de [TODO.md](../../../TODO.md) contiene prioridad, problema, archivos/líneas del commit auditado, alcance y aceptación.

Los cambios de esta auditoría son `TODO.md` y los tres archivos de este directorio. No se realizaron fixes, commits ni publicaciones externas. Al resolver una tarea, conservar esta evidencia fechada y agregar la prueba de regresión correspondiente al flujo normal de calidad.
