# TODO

- [x] Allow `/models` to interrupt Gemini requests, rate-limit waits, and retry backoff so the user can change models without restarting the application.

## Auditoría de mantenimiento de `src/`

Revisión: 2026-11-01. Alcance: CLI, ciclo de conversación y ejecución de herramientas, validación, proveedores, MCP, persistencia, formatos y tests asociados. Este documento propone trabajo; no se modificó la implementación. Las referencias corresponden al estado auditado.

El problema principal es la divergencia entre contratos: las herramientas se describen, validan e invocan desde estructuras distintas; los adaptadores repiten lógica con diferencias de estado y errores; algunos tests verifican solamente que algo no falle. Conviene corregir comportamientos observables y agregar regresiones antes de extraer abstracciones.

### Evidencia y límites de la revisión

- Se usó una copia de `src/` y `tests/` en `/tmp`, con las dependencias instaladas del proyecto, sin copiar credenciales ni la configuración de usuario del proyecto. No se hicieron llamadas reales a proveedores, GitHub o servidores MCP.
- Entorno: Node `v26.5.0`, npm `11.17.0`. `npm test` quedó bloqueado y se interrumpió. La ejecución explícita de los otros 21 archivos `*.test.js` terminó con 21 archivos aprobados, sin fallos reportados; ese resultado no equivale a buena cobertura.
- `tests/gitTools.test.js` tampoco terminó al ejecutarlo con un límite de 5 segundos en un repositorio temporal inicializado. La inspección muestra que `git apply -` espera stdin que el wrapper no escribe.
- ESLint no produjo un informe dentro del límite de 45 segundos en la copia temporal; se interrumpió por timeout. No se afirma que lint esté aprobado ni se atribuye todavía la demora a un defecto concreto. Queda pendiente diagnosticarla antes de establecer su baseline.
- Se reprodujeron con scripts locales: argumentos de Zod descartados, `mkdir` desconocido para el parser, argumentos de `bin` incompatibles con su firma, error de `/rewrite`, forma incorrecta de la opción negativa de Commander, exportación GitHub incompatible, recuperación asíncrona omitida, acceso al proceso desde `run`, lectura mediante symlink fuera de la raíz y búsqueda binaria sin terminar con un patrón de dos bytes.
- Las integraciones externas quedan pendientes de pruebas con transportes simulados. No se evaluó disponibilidad actual de modelos ni APIs remotas. Las observaciones de flujo identificadas por lectura se distinguen de las reproducciones cuando corresponde.

### Orden de ejecución

| Etapa | Objetivo | Tareas |
| --- | --- | --- |
| 1 | Evitar pérdida de datos y establecer pruebas seguras | T01–T03 |
| 2 | Reparar contratos y funciones rotas | T04–T11 |
| 3 | Estabilizar estado, integración y persistencia | T12–T18 |
| 4 | Reducir duplicación y sostener la calidad | T19–T22 |

P0: pérdida de datos o aislamiento incorrecto. P1: errores funcionales, bloqueos o historial/contexto incorrecto. P2: mantenimiento y consistencia. P3: higiene y documentación. Cada tarea debe cerrarse con evidencia de su criterio de aceptación; dividir las tareas amplias en cambios pequeños revisables.

### Etapa 1 — Datos y pruebas seguras

- [x] **T01 · P0 · Aislar los tests del estado real del usuario.**
  - Evidencia: `tests/mementoManager.test.js:8` usa `.paser-mini/log/memento.log` bajo el cwd y lo elimina en `before` y `after`. `tests/gitTools.test.js` modifica archivos del checkout; varias suites usan nombres temporales fijos y `fileTools.test.js` depende del archivo creado por un test anterior.
  - Trabajo: inyectar rutas/almacenamiento en los componentes que lo necesiten; usar `mkdtemp`, fixtures independientes y limpieza registrada aun cuando falle una aserción. Probar Git en un repositorio desechable. Sustituir la notificación real por un ejecutor simulado.
  - Aceptación: correr la suite dos veces y en paralelo conserva intactos los archivos centinela del proyecto/usuario y no requiere sonido, red ni credenciales. Hacer esta tarea antes de usar `npm test` sobre el checkout habitual.
  - Progreso (2026-11-02): `MementoManager` acepta `{ logDir }` con la ruta por defecto intacta; `NotificationTools` acepta `{ executor }` con el ejecutor real por defecto; `GitTools` acepta `{ cwd, timeoutMs }`. Tests reescritos: `mementoManager` usa `mkdtemp`, `notificationTools` inyecta un stub (ya no invoca audio), `fileTools` crea un directorio único por corrida y cada test prepara su propio fixture, `gitTools` opera sobre un repositorio desechable en `mkdtemp`.
  - Estado inicial: la primera implementación se entregó sin ejecutar `npm test`; las verificaciones posteriores se registran abajo y al final de este documento.
  - Revisión 1 (2026-11-02): la afirmación "código completo" era falsa. `loadTools`, `tool_boundary`, `perfTools`, `zipTools` y `astTools` seguían usando rutas fijas compartidas (`tests/temp_*`), que colisionan entre corridas simultáneas. Reescritos con `mkdtemp`, instancia propia por test e imports de módulo dentro de cada test. Estado corregido a "implementación incompleta" solo por la evidencia de ejecución; el trabajo de fixtures ya está aplicado.
  - Nota de diseño: los fixtures viven dentro de `tests/` porque `PathValidator` acota toda operación a la raíz del proyecto. Una corrida interrumpida puede dejar `tests/tmp-*`; la limpieza usa `after`, que no se ejecuta si el proceso muere. Moverlos fuera exigiría una raíz configurable (cambio mayor de T03).
  - Evidencia de ejecución (2026-11-02, copia desechable `/tmp/paser-final`, idéntica al árbol de trabajo verificada con `diff -r`): `node --test 'tests/**/*.test.js'` ejecutado 2 veces secuencial y 2 veces simultánea sobre la misma copia. Los cuatro: **exit 0, 100 tests, 23 suites, 0 fallos**. Centinelas plantados antes de las corridas (`.paser-mini/log/memento.log`, `tests/sentinel-fixture.txt`): `md5sum -c` coincide en ambos tras las cuatro corridas. Fixtures residuales tras las corridas: **0**. Artefactos en la raíz: ninguno. El log de memoria real del proyecto no fue modificado (`git status --porcelain .paser-mini/` vacío).

- [~] **T02 · P0 · Corregir el aislamiento anunciado por `run`.** (parcial: prefijo y plazo corregidos y verificados; aislamiento real NO implementado)
  - Evidencia: `src/tools/evalTools.js:79` expone funciones del anfitrión al contexto; `console.log.constructor("return process.version")()` devuelve la versión del proceso real. El timeout de `vm.runInContext` no pone un plazo al posterior `await result` (`:152`). La comprobación de rutas por prefijo (`:58`) también acepta directorios hermanos cuyo nombre comienza igual.
  - Trabajo: definir si se permite ejecutar código con los permisos del usuario o si se necesita aislamiento real. Para este último, usar un proceso/entorno separado con permisos, tiempo y recursos limitados; centralizar la política de acceso y actualizar la descripción de la herramienta. No resolverlo solamente ocultando `process` o con una carrera entre promesas que deje la ejecución viva.
  - Aceptación: pruebas en proceso desechable de acceso al anfitrión, rutas hermanas, symlinks, promesa que nunca termina y trabajo asíncrono posterior al plazo. La ejecución se termina efectivamente y no deja procesos activos.
  - Progreso (2026-11-02): corregida la comprobación por prefijo a `path.relative` (ya no acepta `<root>-evil`); el `await` posterior a `vm.runInContext` está acotado por plazo (5 s) y falla con `ASYNC_TIMEOUT`. El JSDoc afirmaba "secure sandbox" y ahora declara el modelo real: `vm` NO es un límite de seguridad y el código corre con permisos del usuario.
  - Revisión 1 (2026-11-02): el plazo no era fiable. `timer.unref()` permitía que Node terminara antes de que el plazo se disparara cuando ningún otro recurso mantenía vivo el bucle, abandonando la promesa sin resolverla. Eliminado el `unref`; el temporizador permanece referenciado hasta que la carrera se resuelve y luego se limpia. Regresión añadida en `tests/evalTools.deadline.test.js`: subproceso sin handles activos que debe alcanzar el manejador de plazo y salir con código 0.
  - Evidencia de ejecución (2026-11-02): `tests/evalTools.deadline.test.js` pasa (subproceso sin handles activos alcanza `ASYNC_TIMEOUT` a los ~5 s y sale con código 0). `tests/evalTools.test.js` cubre directorio hermano con prefijo, traversal y código síncrono bloqueante. El aislamiento real sigue sin implementar y sin verificar.
  - Decisión de diseño (2026-11-02): NO se implementó aislamiento real. El criterio de aceptación exige verificar terminación efectiva y ausencia de procesos activos en un proceso desechable; eso no puede comprobarse sin ejecución, y publicar un límite de seguridad sin probarlo sería precisamente la garantía falsa que esta tarea denuncia. Requiere: proceso hijo separado, límites de recursos, y pruebas de terminación. La herramienta queda documentada como "ejecuta código como el usuario".

- [~] **T03 · P0 · Hacer consistente la política de rutas y operaciones destructivas.** (validador corregido y verificado; herramientas secundarias pendientes)
  - Evidencia: `src/utils/pathValidator.js:14` comprueba rutas léxicas, pero permite un symlink interno hacia un archivo externo; también rechaza nombres válidos como `..cache`. `FileTools.remove(".")` no tiene una protección explícita de la raíz. `binaryTools`, `astTools`, `zipTools`, `inspectTools` y `utilTools.seeImage` acceden a rutas sin pasar por esta política.
  - Trabajo: definir una raíz explícita estable, comprobar el destino real y, para creaciones, el ancestro existente; definir tratamiento de symlinks y carreras según el aislamiento elegido. Proteger la raíz y metadatos críticos al borrar/mover. Aplicar la política a entradas y salidas de todas las herramientas de archivos, sin confundirla con el permiso explícito de ejecutar shell.
  - Aceptación: matriz de lectura/escritura/copia/borrado con rutas externas, hermanas, symlinks, destinos todavía inexistentes y nombres válidos que empiezan con puntos. Probar borrado de raíz solamente en fixtures temporales.
  - Progreso (2026-11-02): `pathValidator` resuelve el destino real con `realpathSync` sobre el ancestro existente más cercano (valida también destinos por crear), usa `path.relative` en vez de `startsWith("..")` (acepta `..cache`), rechaza bytes nulos y entradas vacías, y expone `getRoot()`/`isRoot()`. `fileTools.remove` y `rename` rechazan operar sobre la raíz. Nueva `tests/pathValidator.test.js` cubre la matriz: traversal, hermano con prefijo, symlink que escapa, symlink interno válido, destino inexistente, nulo/vacío y borrado de raíz.
  - Revisión 1 (2026-11-02): el validador aceptaba symlinks colgantes. `realpathSync` devuelve `ENOENT` tanto para un componente ausente como para un enlace cuyo destino no existe, así que el código anterior retrocedía al ancestro y reconstruía una ruta "segura" sin inspeccionar el destino; escribir a través del enlace creaba el archivo fuera de la raíz. Reemplazado por un recorrido componente a componente con `lstat`/`readlink` que sigue los enlaces aunque su destino no exista, con límite de 40 saltos para detectar bucles. Regresiones añadidas: enlace colgante a archivo externo, a directorio externo inexistente, escape relativo, bucle de enlaces, y enlace colgante interno válido.
  - Corregido también: el test de borrado de raíz usaba `assert.throws` sobre una operación asíncrona; ahora usa `await assert.rejects` y comprueba que la raíz desechable sigue existiendo.
  - Revisión 2 (2026-11-02): el resolutor colapsaba `..` léxicamente con `path.resolve` antes de resolver el enlace intermedio. Para `bridge/../outside.txt`, donde `bridge` apunta a un directorio externo, el núcleo resuelve `bridge` primero y `..` significa el padre externo, no el padre léxico; la validación aceptaba y la escritura creaba el archivo fuera. Reemplazado por una cola de segmentos procesada contra el prefijo ya resuelto: `..` se aplica al prefijo resuelto, nunca a una cadena con enlaces sin resolver, y los destinos de enlace se empujan a la cola en vez de resolverse textualmente. Regresiones: enlace compuesto relativo, compuesto absoluto con `..`, compuesto encadenado por dos enlaces, más los casos previos. Limitación documentada en el JSDoc: es check-then-use; un cambio concurrente del sistema de archivos entre validación y apertura aún puede redirigir la operación.
  - Evidencia de ejecución (2026-11-02): `tests/pathValidator.test.js` — **19 tests, 19 pasan**. Reproducción previa verificada: el caso compuesto era aceptado y creaba `/tmp/probe-ext3/outside.txt`; tras la corrección, los tres variantes compuestas se rechazan y el centinela externo no se crea. Los casos válidos (enlace interno, enlace colgante interno, ruta nueva anidada, nombre `..cache`, bucle de enlaces) siguen pasando.
  - Pendiente: aplicar la política en `binaryTools`, `astTools`, `zipTools`, `inspectTools` y `utilTools.seeImage`, que siguen accediendo a rutas sin pasar por `PathValidator`.

### Etapa 2 — Comportamientos rotos y contratos

- [ ] **T04 · P1 · Mantener los argumentos normalizados y su posición.**
  - Evidencia: `src/core/smartParser.js:150` valida, pero retorna `finalArgs` en lugar de `validation.correctedArgs`; `doc()` y `eslint()` pierden defaults, y `url("example.com")` pierde la transformación del esquema. `executionEngine.js:100` usa `Object.values(args)`, por lo que claves omitidas o reordenadas alteran la posición.
  - Trabajo: consumir la salida validada y construir la lista posicional desde la definición explícita de parámetros, conservando huecos. Rechazar argumentos sobrantes y expresiones no soportadas; `parseCall` actualmente toma solo la primera sentencia y descarta argumentos sin clave.
  - Aceptación: pruebas a través de parser → engine → función simulada para defaults, transformaciones, opcionales intermedios, orden de claves, argumentos extra y múltiples sentencias; ningún argumento cambia de significado al validar.

- [ ] **T05 · P1 · Unificar el catálogo de herramientas y reparar firmas incompatibles.**
  - Evidencia: `registry.js`, `registry_positional.json`, `schemas.js` y las firmas reales mantienen información duplicada. `mkdir` y `reloadSchemas` están en el mapa ejecutable pero no en el registro posicional (`schemas.js` declara `reloadTools`). `concat` promete concatenar un archivo fuente, pero su implementación agrega el segundo argumento como texto. `diff(path)` invoca una función que ignora la ruta.
  - Evidencia adicional: `bin` pasa `outputFile`, `pattern`, `hexString` y `type` como argumentos separados, pero `handleHexCommand` espera un objeto `options` en la séptima posición. Una llamada de conversión válida para el parser falla al buscar `hexString`.
  - Trabajo: definir una descripción única por herramienta con nombre, esquema, orden, función y descripción; usar adaptadores explícitos para firmas especiales durante la migración. Resolver cada discrepancia conservando o documentando el comportamiento elegido.
  - Aceptación: todo nombre anunciado es parseable, validable e invocable; todo nombre ejecutable está anunciado o marcado como interno. Contratos verificables para `bin`, `concat`, `diff`, `mkdir` y recarga de esquemas, sin ejecutar efectos externos.

- [ ] **T06 · P1 · Reparar la recuperación de errores asíncronos sin borrar historial previo.**
  - Evidencia: `src/core/turnProcessor.js:101` y `:144` retornan `this.api.send(...)` dentro de `try` sin esperarlo: sus `catch` no capturan el rechazo. Además, `gemini/adapter.js` transforma errores de dominio a `APIError` y ya elimina el mensaje fallido; agregar solamente `await` puede dejar una segunda eliminación en el procesador.
  - Trabajo: establecer un responsable único del rollback; preservar tipo/causa de errores de dominio, transporte e interrupción; esperar la promesa donde corresponda recuperar. Evitar recuperaciones por texto del mensaje.
  - Aceptación: errores de safety, respuesta vacía, red e interrupción en solicitud inicial y tras herramientas; historial anterior intacto, mensaje fallido retirado una sola vez y recuperación observada en UI. Conservar las regresiones existentes de `/models`.

- [ ] **T07 · P1 · Evitar bloqueo y resultados falsos en búsqueda binaria.**
  - Evidencia: `src/tools/binaryTools.js:80` busca en todo el buffer en vez de los bytes leídos y actualiza el offset con `bytesRead - (patternLength - 1)`. Con archivo `[1,2,3]` y patrón `0102`, al final deja de avanzar y no termina dentro de 2 segundos.
  - Trabajo: implementar solapamiento entre bloques sin retroceder el cursor de lectura; validar hexadecimal no vacío, tamaño, rangos y recursos. Usar `bytesRead` también en inspección/extracción; la columna ASCII reemplaza actualmente caracteres imprimibles por puntos.
  - Aceptación: casos en EOF, archivo vacío, patrón mayor que el bloque/archivo, coincidencia entre bloques y patrón ausente; sin duplicados ni bytes de relleno, con terminación garantizada. Cambiar el esquema `bin` por variantes según `action` para exigir los campos necesarios.

- [~] **T08 · P1 · Escribir y cerrar stdin en `git apply`.** (corregido y verificado; caso de plazo sin cubrir)
  - Evidencia: `src/tools/gitTools.js:20` pasa `{ input }` a `execFile` asíncrono, pero no escribe en `child.stdin`; `git apply -` queda esperando. `tests/gitTools.test.js` además exige `assert.ok(result)`, aunque Git puede terminar correctamente con stdout vacío.
  - Trabajo: manejar stdin explícitamente y su cierre, errores de escritura, salida y timeout; conservar código de salida y separar confirmación de stdout. Revisar `restore` con separador de opciones antes de la ruta.
  - Aceptación: aplicar un parche en repositorio temporal, comprobar contenido exacto, rechazar parche inválido y terminar por plazo un proceso que no responde; el éxito no depende de texto en stdout.
  - Progreso (2026-11-02): `#run` ya no pasa `{ input }` a `execFile` (opción inexistente); escribe y cierra `child.stdin` explícitamente, propaga errores de escritura, aplica `timeout` y `maxBuffer`, y define el éxito por código de salida, no por stdout. `restoreFile` inserta `--` antes de la ruta. La suite cubre: parche válido con contenido exacto y stdout vacío aceptado, parche inválido rechazado, parche ausente rechazado, `restore` sobre archivo modificado y árbol limpio sin cambios.
  - Evidencia de ejecución (2026-11-02): `tests/gitTools.test.js` pasa dentro de la suite (parche válido con contenido exacto, stdout vacío aceptado, parche inválido rechazado, parche ausente rechazado, `restore` sobre archivo modificado, árbol limpio sin cambios), sobre un repositorio desechable en `mkdtemp`.
  - Pendiente: el caso "proceso que no responde termina por plazo" no está cubierto por un test; requiere un binario auxiliar que ignore stdin.

- [ ] **T09 · P1 · Reparar `--no-system-instruction` y `/rewrite`.**
  - Evidencia: Commander entrega `{ systemInstruction: false }`, mientras `systemPromptManager.js:70` consulta `noSystemInstruction`: el modo puro solicitado no se activa. `commandHandlers/session.js:21` usa `chatManager.toolTracker`, pero el tracker vive en `chatManager.engine`; además elimina dos mensajes antes de fallar.
  - Trabajo: normalizar opciones CLI antes de construir contexto y desacoplar modo puro de que el prompt sea una cadena vacía. Hacer la reescritura mediante una operación de turno que incluya sus llamadas de herramientas y no asuma siempre dos mensajes.
  - Aceptación: flag negativo produce prompt/herramientas esperados sin inicializar MCP; `/rewrite` funciona sobre conversación simple y con herramientas, y no altera historial si no puede completarse.

- [ ] **T10 · P1 · Hacer ejecutable y finito el modo GitHub.**
  - Evidencia: `src/main.js:47` importa `{ GitHubModeOrchestrator }`, pero el módulo exporta únicamente `default`. Por lectura, una vez corregido eso, el modelo se inicializa con el literal `"model"`, faltan los contextos de herramientas configurados en `main`, y `ChatManager.run` entra en un bucle de `requestInput()` que devuelve siempre `""` en `githubUI.js:28`.
  - Trabajo: compartir inicialización de sesión, tomar el modelo de configuración/proveedor y ofrecer procesamiento de un turno para este modo. Definir un contrato de UI que contemple publicaciones asíncronas y esperar su finalización. Revisar paginación de issues/comentarios e idempotencia del procesamiento.
  - Aceptación: importar y ejecutar el modo con cliente GitHub falso, procesar una issue y terminar sin polling activo; comentar y retirar etiqueta en éxito y error; no publicar nada durante tests.

- [ ] **T11 · P1 · Corregir el presupuesto de contexto y evitar pérdida silenciosa.**
  - Evidencia: `src/infrastructure/baseAdapter.js:161` y `:233` duplican recorte con mediciones diferentes. El presupuesto de payload mide `content`, pero luego intenta recortar `parts`. Si el sistema solo ya excede el presupuesto, o ningún fragmento individual alcanza el excedente, no garantiza el límite. Hay recortes destructivos del último mensaje que pueden cortar instrucciones o código.
  - Trabajo: una política común de presupuesto sobre contenido normalizado, reserva de salida validada y adaptación posterior por proveedor. Conservar unidades de conversación coherentes; rechazar/informar explícitamente un input imposible de enviar. Tratar el conteo por caracteres como estimación, no como garantía exacta de tokens. Alinear el indicador de UI con límite deshabilitado y evitar doble conteo del sistema.
  - Aceptación: pruebas con sistema mayor que el presupuesto, límite menor que reserva, varios `parts`, medios y overhead de formato. Ningún envío fuera del presupuesto estimado sin diagnóstico ni truncamiento silencioso del input vigente.

### Etapa 3 — Estado e integraciones

- [ ] **T12 · P1 · Acotar reintentos, errores y cancelación.**
  - Evidencia: reintentos en `ApiCommunicator`, `RetryHandler` y, en Z.AI, también `axios-retry`; las clasificaciones de error difieren. `RetryHandler.execute` espera incluso después del último intento. Solo Gemini propaga actualmente la señal del comunicador hasta la solicitud y sus esperas.
  - Trabajo: fijar una capa responsable de reintentos y un presupuesto total de intentos/tiempo; conservar particularidades por proveedor como políticas. Propagar cancelación donde se ofrezca interrupción, respetar demoras del servidor y no repetir efectos no idempotentes sin una decisión explícita.
  - Aceptación: con reloj/transporte simulados, contar solicitudes reales para 429, 503, error de red y error permanente; sin espera final inútil, multiplicación de intentos ni respuesta tardía que modifique historial tras cancelar.

- [ ] **T13 · P1 · Definir fin de turno y estado de ejecución coherentes.**
  - Evidencia: `toolTracker.recordSuccess` borra el contador: una llamada exitosa idéntica puede repetirse indefinidamente hasta el límite externo. `ToolExecutor` cuenta errores de parsing, pero pierde el `success` de la ejecución. `TurnProcessor` resetea tracker, no detector de repetición; `ExecutionEngine.turnCount/maxTurns/stopRequested` no controlan su bucle.
  - Trabajo: distinguir repeticiones sin progreso, errores de argumentos y fallos de herramientas; unificar presupuesto de acciones/tiempo y fin/cancelación. Definir cuándo se reinicia el detector y retirar campos sin efecto. Garantizar cierre de monitoreo aunque fallen UI o formato del resultado.
  - Aceptación: herramientas que siempre devuelven lo mismo, fallan o generan errores de parser terminan de forma previsible; turnos independientes no se contaminan; interrupción impide iniciar la siguiente herramienta.

- [ ] **T14 · P1 · Reconfigurar una sesión de forma completa.**
  - Evidencia: `chatManager.js:115` cambia referencias del adaptador, pero no reaplica rendering/immersion ni actualiza los contextos singleton de `SystemTools`/`MemoryTools`. `updateSystemContext` modifica prompt y tools, pero no sincroniza `engine.strictPureMode`. El historial tiene formas distintas según proveedor.
  - Trabajo: una operación de reconfiguración que actualice identidades, modos, prompt, permisos y contextos; decidir explícitamente si se conserva o reinicia historial al cambiar proveedor y convertirlo cuando corresponda. Evitar estados parcialmente modificados si falla la creación del adaptador.
  - Aceptación: cambiar proveedor tras activar Fountain/immersion y ejecutar `reset` opera sobre el nuevo adaptador; cambiar entre modo puro y herramientas actualiza política y catálogo; fallo de conexión deja una sesión utilizable.

- [ ] **T15 · P1 · Conservar el resultado completo de herramientas y medios.**
  - Evidencia: `historyNormalizer.normalizeContent` convierte arrays con `.join("\n")`; los resultados mixtos que arma `TurnProcessor` pueden convertirse en `[object Object]`. `McpManager` aplana contenido a `text`, descarta imágenes/recursos y no conserva `isError`; el engine considera éxito cualquier retorno que no lance excepción.
  - Trabajo: acordar un resultado interno con estado y bloques de contenido; adaptar cada proveedor/UI según capacidades. Separar estados especiales Fountain/QR del resultado general sin perder el error remoto.
  - Aceptación: dos herramientas que devuelven texto e imagen, un error MCP y contenido no textual mantienen orden, datos y estado hasta el adaptador. Un proveedor sin soporte devuelve una explicación explícita.

- [ ] **T16 · P2 · Sincronizar caché de prompt, catálogo y conexiones MCP.**
  - Evidencia: `systemPromptManager.js:86` busca archivos `src/...` relativos al cwd aunque el programa puede instalarse globalmente. La caché compara mtimes pero no las identidades de las rutas ni `fileSystemInstruction`; guarda la fecha dentro del prompt. `Object.assign(AVAILABLE_TOOLS, mcpTools)` incorpora entradas globales que desconectar MCP no elimina de ese mapa.
  - Trabajo: separar raíz de aplicación, proyecto y estado; clave de caché con rutas/opciones/contenido relevantes y fecha construida al usarla. Derivar catálogo desde conexiones activas, limpiar al desconectar y validar nombres normalizados sin colisiones. Aplicar configuración `env` de servidores stdio y recuperar correctamente fallos de descubrimiento/conexión.
  - Aceptación: iniciar desde otro cwd, cambiar entre archivos con mismo mtime y reiniciar con otro catálogo MCP actualiza prompt y herramientas; desactivar/eliminar servidor retira su ejecución y esquema. Pruebas sin procesos MCP reales.

- [ ] **T17 · P2 · Corregir búsqueda web, headers e invalidación.**
  - Evidencia: `webTools.js:264` divide por `/s+/` (letras «s»), incompatible con la descripción de búsqueda exacta; una búsqueda `test` devolvió tres ventanas de los fragmentos resultantes. `fetch_headers` es global en `ConfigManager`, pero WebTools lee solo el JSON local. La caché usa solo URL: cambiar headers no vuelve a solicitar el recurso.
  - Trabajo: precisar si la búsqueda es una frase literal o términos y aplicar ese contrato; inyectar configuración/cliente HTTP, incluir headers relevantes en la identidad de caché y permitir caducidad/recarga. Acotar descarga y tipos de respuesta, y usar temporales exclusivos para PDF.
  - Aceptación: frases con «s», espacios y caracteres especiales; misma URL con headers distintos; headers globales; JSON/no texto, timeout y descarga demasiado grande, todos mediante HTTP simulado.

- [~] **T18 · P2 · Hacer confiable la persistencia y el índice de archivos.** (IDs/referencias de memoria corregidos y verificados; concurrencia, config e ignore pendientes)
  - Evidencia: `mementoManager` calcula ID por cantidad de líneas y hace lectura/modificación/escritura sin serializar; contenido multilínea y llamadas concurrentes pueden desordenar IDs/ranks o perder actualizaciones. `ConfigManager` escribe JSON directamente y migra al construirlo. `LoadTools.#isIgnored` compara cadenas literales, sin semántica de globs, negaciones o reglas anidadas de `.gitignore`; tampoco excluye `.git` por defecto ni limita el total de un lote.
  - Trabajo: separar almacenamiento de lógica, serializar actualizaciones de memoria y usar registros estructurados/IDs estables; escrituras atómicas de configuración y migración explícita. Para indexar, adoptar semántica de ignore probada, exclusiones internas, límites acumulados y diagnóstico de archivos cambiados/desaparecidos. Delimitar si se soportan múltiples procesos.
  - Aceptación: escrituras concurrentes y memorias multilínea conservan IDs/referencias; un archivo inválido no se sobrescribe silenciosamente. Fixtures de ignore con `*.log`, negación y reglas anidadas; lotes grandes y archivos eliminados no abortan sin diagnóstico ni producen salida ilimitada.
  - Progreso parcial (2026-11-02): IDs y memorias multilínea corregidos en `mementoManager`. El ID se deriva de las cabeceras `[ID: n]` reales, no de la cantidad de líneas (una memoria multilínea inflaba el contador y dejaba huecos: se reproducía `1, 3`). Los saltos de línea y barras invertidas se escapan al escribir, de modo que cada memoria ocupa exactamente una línea y el rank de una memoria multilínea sigue siendo referenciable. Regresiones con fixture propio: IDs consecutivos, contenido escapado, y rank sobre entrada multilínea.
  - Revisión 2 (2026-11-02): `Math.max(...ids)` expandía todos los registros como argumentos; con un log grande lanzaba por límite de argumentos y el `catch` circundante devolvía `1`, reutilizando un ID existente. Reproducido: log de 300.000 registros seguido de `pushMemory` reportaba `entry #1`. Corregido con acumulación iterativa sobre `RegExp.exec` (sin materializar el array). Además, solo `ENOENT` se trata como log vacío; cualquier otro fallo de lectura se propaga.
  - Evidencia de ejecución (2026-11-02): `tests/mementoManager.test.js` — **7 tests, 7 pasan**. Incluye log de 300.000 registros que produce `#300001` sin IDs duplicados, fallo `EISDIR` que rechaza en vez de elegir 1, y directorio nuevo que produce `#1`.
  - Pendiente: serialización de actualizaciones concurrentes (lectura-modificación-escritura sin bloqueo), escrituras atómicas de `ConfigManager`, semántica de `.gitignore` en `LoadTools` y límites de lote.

### Etapa 4 — Estructura y controles de mantenimiento

- [ ] **T19 · P2 · Extraer duplicación real entre adaptadores.**
  - Evidencia: `zenmux/adapter.js` y `poolside/adapter.js` son casi idénticos; difieren sobre todo en identidad, URL, modelos y `lastPayload`. Groq/Cerebras y otros repiten historia, normalización, petición y errores. Hay tres representaciones de historial (`content`, `text`, `parts`) y modelos por defecto en `main`, factory y adaptadores.
  - Trabajo: después de T06/T11/T12/T14/T15, incorporar pruebas de contrato comunes y extraer por composición transporte compatible, estado y políticas reutilizables. Mantener capacidades específicas de Gemini/Cohere/multimodal en sus adaptadores; no imponer un payload universal a proveedores distintos. Centralizar defaults locales sin asumir disponibilidad remota.
  - Aceptación: para cada proveedor, transportes falsos verifican payload, roles, reinicio, rollback, medios y configuración. Cambiar la política común de errores o historial requiere una implementación central y no copias divergentes.

- [ ] **T20 · P2 · Unificar arranque, cierre y propiedad de recursos.**
  - Evidencia: logger, input, prompt y MCP son singletons con efectos de importación o estado global. `main.gracefulShutdown` solo se usa en señales; `/exit` llama `process.exit(0)` directamente y no espera MCP/logs. `shutdownStreams` existe pero no se llama desde ese cierre. `TerminalInput` no resuelve la entrada pendiente ante EOF. `SearchTools.searchText` deja vivo el timer de 80 segundos al terminar; la sesión inspect carece de un cierre integrado en la aplicación.
  - Trabajo: un propietario de sesión/recursos con dependencias explícitas, cierre idempotente y plazo; usarlo en salida normal, comandos, señales y fallos. Limpiar timers/listeners/procesos y terminar readline. Revisar manejadores globales de excepciones que solamente registran y continúan en estado incierto.
  - Aceptación: pruebas en subprocesos con EOF, salida normal, `/exit`, SIGINT y error fatal; sin procesos huérfanos, esperas residuales ni logs pendientes. Importar lógica de dominio no debe crear archivos de sesión por sí solo.

- [ ] **T21 · P2 · Reemplazar tests vacíos y establecer controles ejecutables.**
  - Evidencia: `jsonTools.test.js`, `githubTools.test.js` y `webTools.test.js` usan `assert.ok(true)`; `sample.test.js` prueba aritmética. `tail` verifica solo que contenga una línea, no la cantidad/semántica; AST prueba estrategias internas y mínimos de resultados. La búsqueda por tokenizer no equivale siempre a nodos AST (p. ej. booleanos y sintaxis incompleta).
  - Trabajo: reemplazar placeholders por fixtures locales y clientes falsos, incluyendo regresiones de T04–T18. Acordar comportamiento de `tail` con salto final y más de 64 KiB, y semántica AST frente a tokens. No usar cantidad de tests o snapshots de implementación como sustituto de aserciones sobre resultados.
  - Tooling: agregar scripts reproducibles de lint y chequeo JS; `jsconfig.json` activa `checkJs`, pero falta un script que lo ejecute. Revisar ESLint plano frente a `.eslintrc.json`, dependencias de plugins importadas transitivamente, versión de Node soportada y estado del lockfile. `analysis` invoca `npx pyright` para un proyecto JS, y `doc` invoca JSDoc sin dependencia declarada: evitar instalaciones implícitas en ejecución y usar herramientas declaradas adecuadas al lenguaje.
  - Aceptación: suite completa finita y aislada, sin tests vacíos; lint y tipos con baseline revisada, scripts y CI que detecten regresiones relevantes. Priorizar errores reales y contratos; no mezclar miles de cambios de estilo con fixes funcionales.
  - Diagnóstico de lint (2026-11-02, ejecutado): ESLint funciona pero tarda ~13-17 s por archivo; la suite completa `npx eslint src tests` excede 120 s y se interrumpe. Es la causa del timeout que la auditoría dejó sin atribuir, no un defecto de configuración. Los 18 archivos modificados se lintearon individualmente: **exit 0, 0 errores, 0 avisos**. Baseline de archivos no modificados: 0 errores. Reglas que sí importan aquí: `no-continue`, `prefer-template`, `jsdoc/tag-lines`, `jsdoc/require-jsdoc`.
  - Diagnóstico de tipos (2026-11-02, ejecutado): `npx tsc --noEmit -p jsconfig.json` falla con `TS1109` en `tests/errores/syntaxError.js`, archivo de fixture con error de sintaxis intencional (commit `32effa4`, no modificado). Excluyéndolo, el chequeo se bloquea por falta de `@types/node` (no instalado), produciendo 29 errores de ruido de módulos y globales. Único error real de tipado en el código tocado: `parseInt(tail, 10)` con `tail: string|number` en `fileTools`, **preexistente en HEAD** (idéntico en `git show HEAD:src/tools/fileTools.js`). No se declara el chequeo de tipos como aprobado.

- [ ] **T22 · P3 · Simplificar nombres, documentación y código sin efecto.**
  - Evidencia: múltiples variantes de `path/filepath/file_path/filePath`, alias y nombres inconsistentes; campos de control sin uso en el engine; comentarios que prometen seguridad, precisión de tokens o recarga «desde disco» que el comportamiento no garantiza. `reloadSchemas` reutiliza el módulo ESM ya importado. Hay archivos de log bajo `src/core/.paser-mini/` y configuración de lint duplicada.
  - Trabajo: estandarizar nombres en contratos nuevos con compatibilidad de transición; retirar duplicaciones y parámetros muertos tras comprobar referencias. Corregir comentarios/JSDoc para explicar restricciones y decisiones. Documentar instalación, ejecutables del sistema, configuración global/local, efectos de herramientas y política de historial. Revisar qué artefactos generados se deben excluir, sin borrar logs de usuario como parte del refactor.
  - Aceptación: documentación y ayuda coinciden con contratos probados, una ruta de configuración de calidad, sin estados/alias obsoletos conservados únicamente por comentarios heredados.

### Criterio de cierre por cambio

1. Reproducir el problema en un fixture aislado y comprobar el resultado esperado.
2. Implementar el cambio mínimo; extraer lógica común cuando las regresiones protejan sus variantes.
3. Ejecutar las pruebas afectadas y los controles acordados; verificar la suite completa al integrar.
4. Documentar cambios de contrato o compatibilidad y actualizar este checklist con la evidencia.

No se propone una reescritura completa ni una migración de lenguaje como requisito. Primero estabilizar contratos y datos; luego reducir las copias y responsabilidades que hoy dificultan modificar el sistema con confianza.

### Correcciones verificadas tras la revisión de `report_2_response.md` — 2026-11-02

- [x] Corregido `tail` para distinguir una ventana sin líneas de una línea vacía completa. La regresión con un prefijo de 300.000 bytes y `\n\n` fallaba antes del arreglo; ahora devuelve la última línea vacía y sigue rechazando pedir también la línea que supera el límite. Se preservan líneas vacías consecutivas y se aclara el contrato del terminador final.
- [x] Corregidos los fixtures de cobertura: el enlace absoluto conserva literalmente `..` después del enlace intermedio y comprueba el bloqueo de escritura; el destino externo queda dentro de un directorio temporal propio. El caso de ventana de `tail` solicita ahora la línea de 70 KiB que obliga a ampliar la lectura.
- [x] Sustituido el byte NUL literal de `pathValidator.js` por `\0`; el comportamiento se conserva y Git vuelve a mostrar un diff textual.
- [x] La prueba del plazo usa salida síncrona del subproceso para observar `ASYNC_TIMEOUT` sin depender de la entrega asíncrona de stdout. Sigue exigiendo salida normal y rechaza el camino de éxito inesperado.
- [x] Corregida una carrera adicional detectada al ejecutar dos suites simultáneas: el glob tolera que una carpeta descendiente desaparezca después de listar su padre. Una regresión determinista fallaba con `ENOENT` antes del arreglo; ahora conserva los resultados restantes. Otra prueba confirma que errores de permisos se propagan.

Verificación en la copia desechable `/tmp/paser-fixes-9sk7tz6f`, con los archivos modificados iguales a los del proyecto:

- `npm test`: dos corridas secuenciales y dos simultáneas sobre la misma copia; las cuatro terminaron con código 0. Centinelas de memoria y proyecto intactos; ningún fixture `tests/tmp-*` restante.
- `node --test --test-isolation=none 'tests/**/*.test.js'`: **104 tests, 23 suites, 104 aprobados, 0 fallos**, código 0.
- ESLint sobre los siete archivos JS modificados en este cierre: **0 errores, 0 advertencias**, código 0.
- Evidencia temporal: `/tmp/paser-fixes-final-summary.json`, `/tmp/paser-fixes-final-counted.log`, `/tmp/paser-fixes-final-{sequential1,sequential2,parallel1,parallel2}.log` y `/tmp/paser-fixes-lint.json`.

Este cierre cubre los pendientes de la última revisión. Las partes todavía abiertas de T02, T03, T08, T18 y las demás tareas del plan conservan sus criterios de aceptación.
