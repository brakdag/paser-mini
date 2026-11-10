# TODO

Auditoría técnica realizada el **2026-11-09** sobre `011d981bc119dfb64f58fddd37b9603185a5878e`. El árbol estaba limpio al comenzar. Se registran **seis defectos reproducidos y una tarea de deuda de tipos**; en esa auditoría no se modificó la implementación ni se cerraron estas tareas.

[Informe, alcance y controles](docs/audits/2026-11-09/README.md) · [Reproductor aislado](docs/audits/2026-11-09/reproduce.mjs) · [Resultados observados](docs/audits/2026-11-09/observed.jsonl).

La indicación anterior pedía una nueva sesión con **GPT-6 Astra / ultra high**. Esta sesión no permite cambiar ni acreditar esa selección; la auditoría técnica aquí registrada **no acredita el cumplimiento de ese requisito de modelo/razonamiento**.

El [historial anterior](docs/work-history-2026-11-09.md) se conserva como antecedente. Los identificadores A01–A07 pertenecen a este ciclo y no reabren automáticamente los cierres T01–T23.

Se agregan **cuatro funcionalidades propuestas y aceptadas por el usuario**, F01–F04, con alcance mínimo. Su aprobación correspondía al backlog; quedaron implementadas en el cierre del 2026-11-10.

**Cierre 2026-11-10:** A01–A07 y F01–F04 completadas. `npm run check` aprobado: 817 pruebas, cero fallos; inventario de tipos reducido de 170 a 150 diagnósticos admitidos, sin nuevas exenciones. [Cambios, regresiones y límites comprobados](docs/work-history-2026-11-10.md) · [Uso de las nuevas funcionalidades](docs/cli-composition.md).

## Prioridad y orden

P1: comportamiento incorrecto con impacto en datos, instrucciones o resultado del trabajo. P2: integración, concurrencia programática, mantenimiento o evolución funcional acotada. No se confirmó un P0 nuevo en el alcance revisado.

| Tarea | Prioridad | Clasificación | Resultado auditado que se corrigió |
| --- | --- | --- | --- |
| A01 | P1 | Defecto reproducido | Primer envío de Cerebras sin prompt de sistema |
| A02 | P1 | Defecto reproducido | Turno detenido por límites tratado como completado |
| A03 | P1 | Defecto reproducido | `replace` altera el texto literal con dólares |
| A04 | P1 | Defecto reproducido | `execute` informa éxito ante un exit distinto de cero |
| A05 | P2 | Defecto reproducido | Descubrimiento MCP omite páginas posteriores |
| A06 | P2 | Defecto reproducido | Un turno solapado libera el bloqueo del turno activo |
| A07 | P2 | Deuda confirmada | Contratos de tipos inconsistentes en interfaces compartidas |

El orden aplicado priorizó A01–A04, seguido de A05–A07 y las funcionalidades. `observed.jsonl` conserva los defectos originales; el reproductor actual exige los resultados corregidos y sale con código 0 al cumplir sus regresiones.

## Tareas

- [x] **A01 · P1 · Esperar la inicialización del adaptador en los dos modos de ejecución.**
  - **Cierre 2026-11-10:** Inicialización esperada en ambos modos; cancelación de arranque, plazo total de 10 s y metadata Cerebras con timeout de 5 s. Regresiones en `tests/auditBacklog.test.js` y reproductor A01.
  - **Problema observable:** con la consulta de metadata de Cerebras pendiente, `runOnce()` ya envía el primer mensaje y termina sin haber incorporado el prompt de sistema. La ruta interactiva usa la misma inicialización sin espera. Afecta instrucciones y catálogo enviados al modelo, no solo una estadística de contexto.
  - **Evidencia:** [chatManager.js:288](src/core/chatManager.js#L288) descarta la promesa de `startChat`; los consumidores están en las líneas 299 y 323. [cerebras/adapter.js:88](src/infrastructure/cerebras/adapter.js#L88) espera `_syncContextLimit()` antes de `updateSystemInstruction` (líneas 94–96). Reproducción **A01**: el primer payload contiene únicamente el rol `user`; el mensaje `system` aparece al liberar la metadata simulada.
  - **Alcance propuesto:** hacer explícito y esperable el contrato de inicialización; propagarlo por `run()` y `runOnce()`, incluidos rechazo y cierre durante el arranque. Mantener coherencia con `switchProvider()`, que ya espera `startChat`. Acordar una salida finita/cancelable para la espera de metadata al introducir la espera en el arranque.
  - **Aceptación:** con inicialización demorada no hay generación previa a su resolución; el primer payload de ambos modos contiene el prompt correcto. Un rechazo se comunica al propietario de la sesión sin promesa rechazada huérfana ni envío posterior; salida durante la espera termina dentro del plazo documentado. Probar adaptadores síncronos y asíncronos con transportes falsos.

- [x] **A02 · P1 · Propagar el resultado incompleto de un turno detenido por límites.**
  - **Cierre 2026-11-10:** `TurnLimitError` se propaga; la terminal sigue disponible, rewrite restaura historial/objetivo/tracking y GitHub permite reintentar sin comprobante falso. Regresiones de los cinco límites, continuidad interactiva y reproductor A02.
  - **Problema observable:** agotar solicitudes, acciones, tiempo o errores resuelve el turno como si hubiera terminado. `/rewrite` informa éxito y pierde el historial anterior; GitHub publica un comprobante de finalización que impide reintentar la misma entrada, aunque no haya respuesta final.
  - **Evidencia:** [turnProcessor.js:54](src/core/turnProcessor.js#L54) absorbe `TurnLimitError`. [chatManager.js:395](src/core/chatManager.js#L395) registra el turno y [chatManager.js:424](src/core/chatManager.js#L424) solo restaura la reescritura si recibe una excepción. [githubModeOrchestrator.js:89](src/core/githubModeOrchestrator.js#L89) omite entradas con comprobante, publicado después de `runOnce` en la línea 104. Reproducción **A02** con límites de 1: reescritura `true` sin restauración y un solo procesamiento ante dos intentos de la misma issue fallida.
  - **Alcance propuesto:** comunicar un resultado explícito de turno incompleto o propagar el error hasta sus consumidores. Separar el aviso visible de la decisión de éxito; conservar los efectos externos ya realizados. Revisar `/rewrite`, `runOnce`, el bucle interactivo y la publicación de comprobantes.
  - **Aceptación:** los límites de solicitudes, acciones, errores y duración y la detención por repetición nunca generan un comprobante de éxito ni un anuncio de reescritura exitosa. La reescritura restaura historial, objetivo anterior y seguimiento correspondiente; una issue incompleta vuelve a ser elegible y libera su etiqueta. La terminal sigue disponible y no programa más acciones del turno detenido. Una ejecución realmente completada sigue generando un único comprobante.

- [x] **A03 · P1 · Conservar literalmente el texto de reemplazo de `replace`.**
  - **Cierre 2026-11-10:** Reemplazo mediante callback literal; pruebas exactas de dólares, Unicode y saltos de línea, sin alterar `sed`. Regresiones en `tests/auditBacklog.test.js` y suite de archivos.
  - **Problema observable:** editar archivos con cadenas como `$$` o `$&` escribe bytes distintos de los solicitados, sin error. Por ejemplo, reemplazar `TOKEN` por `cost=$$; matched=$&` produce `cost=$; matched=TOKEN`.
  - **Evidencia:** [fileTools.js:37](src/tools/fileTools.js#L37) pasa una cadena como segundo argumento de `String.replace`, activando sus sustituciones; [fileTools.js:216](src/tools/fileTools.js#L216) persiste ese resultado. El catálogo lo describe como reemplazo de cadena en [toolDefinitions.js:39](src/infrastructure/toolDefinitions.js#L39). Reproducción **A03** conserva resultado esperado y real en JSONL.
  - **Alcance propuesto:** realizar inserción literal en `replace`, conservando rechazo de búsqueda ausente o ambigua. Mantener por separado la semántica de sustitución regular de `sed`.
  - **Aceptación:** pruebas de contenido exacto con `$$`, `$&`, `` $` `` y `$'`, Unicode y saltos de línea; el texto de reemplazo se guarda sin interpretación. Búsqueda ausente o repetida deja el archivo intacto; las regresiones existentes de `sed` mantienen su contrato.

- [x] **A04 · P1 · Conservar el estado de fallo de `execute` cuando existe stdout.**
  - **Cierre 2026-11-10:** Errores estructurados con salida parcial, exit code, señal y timeout. Matriz con/sin stdout y shell real; el engine conserva fallo para tracking y monitoreo.
  - **Problema observable:** `printf partial; exit 7` devuelve `success: true` e `isError: false`. El modelo y el monitoreo reciben éxito, y la racha de errores se reinicia aunque el proceso haya fallado. La clasificación depende de que haya stdout.
  - **Evidencia:** [systemTools.js:177](src/tools/systemTools.js#L177) convierte el error en una cadena normal cuando `e.stdout` no está vacío. [executionEngine.js:83](src/core/executionEngine.js#L83) interpreta ese retorno como éxito; [toolExecutor.js:49](src/core/toolExecutor.js#L49) usa el estado para contabilizar errores. Reproducción **A04**, con shell local inocua y sin escrituras, observa exit 7 y éxito simultáneamente.
  - **Alcance propuesto:** retornar un resultado de error compatible con `toolResult` o lanzar un error que preserve salida y metadata. Conservar exit code, señal, timeout y stdout/stderr sin decidir el éxito por el contenido textual.
  - **Aceptación:** códigos distintos de cero, señales y timeouts se reportan como fallo con y sin stdout; las salidas parciales siguen disponibles. Monitoreo, tracking y límite de errores reciben el mismo estado. Código 0, incluso con stderr, conserva su tratamiento de éxito.

- [x] **A05 · P2 · Completar el descubrimiento paginado de herramientas MCP.**
  - **Cierre 2026-11-10:** Paginación completa y catálogo atómico; límite de 100 páginas, detección de cursores repetidos, colisiones y cierre. Regresiones en `tests/mcpManager.test.js`.
  - **Problema observable:** un servidor que entrega `nextCursor` conecta correctamente pero solo expone las herramientas de la primera página. Las demás faltan del catálogo y de sus esquemas.
  - **Evidencia:** [McpManager.js:228](src/infrastructure/McpManager.js#L228) llama una única vez a `listTools()` y publica esa página en las líneas 253–258. En el SDK instalado, `dist/esm/client/index.js:565` devuelve una sola respuesta y `dist/esm/types.js:617,1283` admite `nextCursor` en `ListToolsResultSchema`. Reproducción **A05**: solo se solicita cursor `null`; `mcp_fixture_second` queda ausente pese a anunciarse `page-2`.
  - **Alcance propuesto:** recorrer cursores antes de publicar la conexión; validar colisiones entre todas las páginas y acotar respuestas con cursores repetidos o listas interminables. Preservar cierre, limpieza y reintento ante fallo de descubrimiento.
  - **Aceptación:** un fixture de dos o más páginas expone todos sus nombres y esquemas y permite invocar la herramienta de la última página. Fallo o colisión en una página posterior no publica un catálogo parcial. Cursores repetidos y cierre durante paginación terminan de forma finita y limpian el cliente.

- [x] **A06 · P2 · Mantener la propiedad del bloqueo durante turnos superpuestos.**
  - **Cierre 2026-11-10:** Rechazo de superposición antes de modificar estado; bloqueo retenido hasta éxito, fallo o cancelación del propietario. Regresiones en `tests/auditBacklog.test.js`.
  - **Problema observable:** una segunda llamada programática a `processTurn()` se rechaza, pero su `finally` pone `_turnInProgress` en `false` mientras el primer turno continúa. Desde ese momento se acepta una recarga del prompt durante la petición activa. El bucle CLI ordinario es secuencial; el caso confirmado corresponde a invocaciones superpuestas de la API de sesión.
  - **Evidencia:** [chatManager.js:388](src/core/chatManager.js#L388) no comprueba `_turnInProgress` antes de adquirir/modificar el estado; lo libera incondicionalmente en la línea 399. El rechazo ocurre más abajo en [turnProcessor.js:47](src/core/turnProcessor.js#L47). La reconfiguración confía en esa bandera en [chatManager.js:188](src/core/chatManager.js#L188). Reproducción **A06**: manager inactivo, processor activo y prompt cambiado antes de resolver la primera petición.
  - **Alcance propuesto:** rechazar la superposición antes de modificar historial o banderas, o identificar al propietario del turno para que solo este lo libere. Coordinar la exclusión con reescritura y reconfiguración.
  - **Aceptación:** al rechazar un segundo turno, el primero conserva su bandera, control, historial y objetivo de reescritura. Prompt, modelo y temperatura no pueden cambiar hasta que termine. Éxito, error y cancelación liberan el bloqueo exactamente una vez y permiten un turno posterior.

- [x] **A07 · P2 · Reducir deuda de tipos en contratos compartidos de sesión y adaptadores.**
  - **Cierre 2026-11-10:** Tanda de contratos completada: doce constructores, timestamps, UI y configuración. Inventario actual: 150 diagnósticos (46 en producción, 104 en tests), sin entradas nuevas. Deuda remanente documentada en `docs/typechecking.md`.
  - **Problema observable:** el control incremental pasa con **170 diagnósticos admitidos: 65 en `src/` y 105 en tests**. No es un defecto funcional demostrado por sí mismo. Persisten firmas incompatibles de timestamps y UI, opciones de constructor que el tipo base no acepta y fronteras de configuración sin estrechar. La tabla de seguimiento aún remite a tareas cerradas, sin un trabajo vigente para esas interfaces.
  - **Evidencia:** [typecheck-baseline.json:5](typecheck-baseline.json#L5), [línea 33](typecheck-baseline.json#L33) y [línea 89](typecheck-baseline.json#L89); [conversationState.js:45](src/infrastructure/conversationState.js#L45), las firmas de `injectMessage` de NVIDIA y el constructor base en [baseAdapter.js:28](src/infrastructure/baseAdapter.js#L28). [docs/typechecking.md:39](docs/typechecking.md#L39) remite a T11–T20. Inventario actual de producción: TS2339 ×44, TS2353 ×12, TS2345 ×6, TS2416 ×2 y TS2322 ×1.
  - **Alcance propuesto:** primera tanda acotada a opciones de los doce constructores, timestamp de `ConversationState`/NVIDIA, retorno síncrono/asíncrono de entrada de terminal y lectura de configuración en `ChatManager`. Documentar además inicialización y resultado de turno al resolver A01/A02. Mantener los errores HTTP/OS y mocks restantes inventariados para tandas posteriores, sin exigir migración de lenguaje.
  - **Aceptación:** desaparecen del inventario los diagnósticos de esas firmas y lecturas concretas; se retiran únicamente las entradas resueltas y se actualiza su documentación. Sin nuevas exenciones, `@ts-nocheck`, `any` generalizado ni reducción del alcance de `checkJs`. Pasan las pruebas de identidad/timestamps/UI/reconfiguración y `npm run check`; las pruebas de A01/A02 siguen verificando comportamiento, ya que anotar una promesa no obliga por sí solo a esperarla.

## Funcionalidades propuestas — minimalismo

Incorporar capacidades pequeñas y componibles, evaluadas de a una. Mantener la conversación y las herramientas simples: estas tareas no introducen gestión de proyectos, sistemas de workflows ni nuevas capas de aprobación. La propuesta de `recall` fue excluida por el usuario.

| Tarea | Prioridad | Funcionalidad | Alcance inicial |
| --- | --- | --- | --- |
| F01 | P2 | Composición con Unix | stdin como documento, stdout limpio y salida al completar un turno |
| F02 | P2 | Endpoint compatible configurable | URL, modelo y credencial opcional en una integración genérica |
| F03 | P2 | Respuesta progresiva | Mostrar texto mientras llega, conservando el contrato de herramientas |
| F04 | P2 | Atajos personales de texto | Expandir una instrucción habitual desde un archivo sencillo |

- [x] **F01 · P2 · Usar Paser en pipelines de Unix.**
  - **Cierre 2026-11-10:** Opción `--pipeline` implementada. CLI real verificada con pipe, archivo redirigido, Unicode, entrada vacía, límite, fallo e interrupción; stdout limpio y EPIPE cubierto.
  - **Necesidad y antecedente:** procesar documentos desde scripts y encadenar la respuesta con otras herramientas. [TerminalInput.js:40](src/core/TerminalInput.js#L40) consume stdin por líneas como entradas interactivas; [cliOptions.js:11](src/core/cliOptions.js#L11) ofrece un mensaje inicial, sin un modo dedicado a documento completo y salida limpia.
  - **Alcance mínimo:** un modo explícito de pipeline que lea stdin hasta EOF como un documento, admita una instrucción mediante `--message`, ejecute un turno y termine. stdout contiene la respuesta; avisos y errores van a stderr. La opción implementada es `--pipeline`. Ejemplo de uso esperado: pasar `notas.txt` por stdin para resumirlo y redirigir la respuesta a otro archivo.
  - **Aceptación:** un fixture multilínea con Unicode llega íntegro como contenido, sin interpretar sus líneas como comandos de la CLI. stdout no incluye prompts, banners, spinners ni secuencias ANSI. Al completar el turno sale con código 0; fallo o interrupción produce un código distinto de cero y diagnóstico en stderr. Probar redirección, pipe cerrado y entrada vacía; el modo interactivo conserva su comportamiento. Integrar el resultado de turno de A02 para evitar éxitos falsos.

- [x] **F02 · P2 · Conectar un endpoint compatible mediante configuración.**
  - **Cierre 2026-11-10:** Proveedor `COMPATIBLE` con URL/modelo y credencial de entorno opcional. Verificados dos endpoints simulados, rutas prefijadas y configuración inválida; ejemplos en `docs/cli-composition.md`.
  - **Necesidad y antecedente:** usar un servidor propio o local sin crear un adaptador específico por servicio. [providerManager.js:112](src/infrastructure/providerManager.js#L112) resuelve un catálogo cerrado; [compatibleChat.js:55](src/infrastructure/compatibleChat.js#L55) ya concentra el transporte de chat completions reutilizable.
  - **Alcance mínimo:** una integración genérica con URL base, nombre de modelo y referencia a una credencial del entorno, opcional para servidores locales. Definir el protocolo de chat completions soportado y reutilizar historial, presupuesto y cancelación existentes. La selección explícita del modelo basta para la primera versión.
  - **Aceptación:** dos endpoints simulados con URLs y modelos distintos funcionan sin modificar código. Las rutas respetan la URL base, incluida una ruta prefijada; autenticación opcional y configuración inválida tienen comportamiento comprobable. Errores, cancelación y reintentos conservan el contrato compartido; no se vuelcan credenciales en logs. Documentar un ejemplo local y otro autenticado, junto con los límites de compatibilidad.

- [x] **F03 · P2 · Mostrar la respuesta a medida que llega.**
  - **Cierre 2026-11-10:** SSE en transporte compatible con preview transitorio en terminal, respuesta completa como alternativa y una única publicación final. Verificados fragmentación, herramientas, cancelación, error, truncación, reintento y límite de evento.
  - **Necesidad y antecedente:** reducir la espera sin información durante respuestas largas. [compatibleChat.js:71](src/infrastructure/compatibleChat.js#L71) espera el cuerpo completo antes de devolver contenido; el turno publica luego la respuesta final.
  - **Alcance mínimo:** incorporar entrega incremental de texto en el transporte compatible y su presentación en terminal. Mantener respuesta completa como alternativa para adaptadores que todavía no implementen streaming; extender el soporte por proveedor en cambios independientes.
  - **Aceptación:** con un transporte simulado demorado, el usuario ve texto antes del último fragmento y la respuesta no se duplica al terminar. Fragmentos partidos en medio de Unicode o marcas schwa se ensamblan correctamente; ninguna herramienta se ejecuta a partir de argumentos incompletos ni dos veces. Historial y registro conservan una única respuesta completa cuando el envío termina correctamente. Cancelación, error y reintento no mezclan fragmentos de intentos distintos ni confirman como completa una respuesta interrumpida. Si F01 está disponible, su stdout conserva el contrato de salida limpia.

- [x] **F04 · P2 · Definir atajos personales para instrucciones habituales.**
  - **Cierre 2026-11-10:** Atajos desde `.paser-mini/config/shortcuts.json`, releídos en cada comando personalizado. Expansión literal única, nombres reservados y errores comprobados; la terminal conserva espacios del texto añadido.
  - **Necesidad y antecedente:** reutilizar textos frecuentes, como una instrucción de corrección, con una invocación breve. [commandHandler.js:32](src/core/commandHandler.js#L32) define comandos internos; falta una expansión configurable de texto del usuario.
  - **Alcance mínimo:** leer un mapa sencillo de nombre a texto, por ejemplo `.paser-mini/config/shortcuts.json`. `/corregir texto` expande la instrucción configurada y agrega literalmente el texto suministrado. Una sola expansión, sin ejecución de código, encadenamiento ni plantillas programables.
  - **Aceptación:** un archivo con dos atajos permite enviar las instrucciones esperadas con y sin texto adicional; Unicode y saltos de línea se preservan. Los nombres no pueden reemplazar comandos internos y la expansión no vuelve a interpretarse como otro comando. JSON inválido, valores no textuales y nombres desconocidos muestran un diagnóstico claro. Sin archivo de atajos, el uso habitual funciona igual. Documentar formato y momento de carga.

## Criterios de cierre aplicados

Para A01–A07, convertir su evidencia en una regresión que falle antes del arreglo y pase después; registrar el cambio, controles y límites comprobados. Para F01–F04, verificar el alcance mínimo y los criterios de aceptación de la funcionalidad. Ejecutar las pruebas afectadas y `npm run check` al integrar. Actualizar el reproductor de auditoría si un arreglo cambia su resultado, conservando `observed.jsonl` como evidencia fechada del estado original.

El cierre y los controles ejecutados quedan registrados en [el informe del 2026-11-10](docs/work-history-2026-11-10.md). La evidencia original de auditoría se conserva sin cambios.
