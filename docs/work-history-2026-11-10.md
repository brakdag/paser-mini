# Cierre del backlog A01–A07 y F01–F04 — 2026-11-10

Base de trabajo: `899095e6077caa0dcf6fda2b49e83f4fbdf7f268`, árbol inicialmente limpio.
La evidencia original de auditoría corresponde a `011d981bc119dfb64f58fddd37b9603185a5878e`.
Antes de modificar implementación se ejecutó el reproductor de auditoría: confirmó
los seis defectos originales. `observed.jsonl` se conserva sin cambios. El
reproductor ahora exige los resultados corregidos; su nueva salida está en
[fixed-2026-11-10.jsonl](audits/2026-11-09/fixed-2026-11-10.jsonl).

## Correcciones

| Tarea | Resultado | Evidencia de regresión |
| --- | --- | --- |
| A01 | Ambos modos esperan inicialización. Metadata Cerebras usa timeout de 5 s y señal; la espera de sesión tiene plazo de 10 s y cancelación. No hay generación tras fallo o cierre de arranque. | `auditBacklog.test.js`: metadata demorada en ambos modos, adaptadores síncronos, rechazo, cierre y plazo con adaptador que ignora cancelación; reproductor A01 |
| A02 | Los límites y la repetición rechazan el turno. El modo interactivo permite continuar. Reescritura restaura historial, objetivo y tracking; GitHub no publica comprobante y permite reintentar. | Pruebas de límites actualizadas para exigir rechazo; regresiones de rewrite para cinco causas; continuación interactiva; reproductor A02 con dos intentos de la misma issue |
| A03 | `replace` inserta la cadena mediante callback literal; `sed` conserva semántica regular. | Bytes exactos de cuatro formas de dólar, Unicode y saltos de línea; búsqueda ausente y repetida no modifican el archivo; suite de archivos |
| A04 | `execute` retorna `isError` y metadata de exit, señal, timeout y salidas parciales. El engine registra el mismo fallo que reciben monitoreo y límites. | Shell real exit 7 con stdout y exit 0 con stderr; matriz de fallo sin/con stdout y señales/timeouts simulados; pruebas compartidas de resultados |
| A05 | Descubrimiento MCP recorre cursores y publica atómicamente. Rechaza colisiones, cursores repetidos y más de 100 páginas; limpia la conexión fallida. | Invocación y esquema de última página; fallo, colisión, ciclo, páginas interminables y cierre; suite de ciclo de vida MCP |
| A06 | Superposición se rechaza antes de alterar estado; solo el turno propietario libera su bandera. Reescritura/reconfiguración respetan exclusión. | Historial/control intactos y prompt/temperatura bloqueados durante el turno; liberación tras éxito, fallo y cancelación, y turno posterior |
| A07 | Contratos de constructor, timestamps, UI y configuración alineados. Inicialización esperable y resultados incompletos documentados. | Inventario reducido de 170 a 150 diagnósticos (46 producción, 104 tests), sin nuevas entradas ni exenciones; pruebas de contratos y sesión |

## Funcionalidades

| Tarea | Resultado mínimo | Evidencia |
| --- | --- | --- |
| F01 | `--pipeline` consume stdin hasta EOF, combina instrucción opcional, ejecuta un turno y publica solo la respuesta completa en stdout. Diagnósticos a stderr; fallos y señales devuelven estado no cero. | CLI real con pipe, archivo redirigido, Unicode, líneas con comandos, stdin vacío, error de transporte, límite de duración e interrupción durante stdin/generación; EPIPE simulado al publicar |
| F02 | Proveedor `COMPATIBLE` con URL base, modelo explícito y referencia opcional a variable de credencial. Reutiliza transporte, historial, contexto, cancelación y reintentos. | Dos URL/modelos simulados, ruta prefijada, auth opcional, validación de configuración y ausencia de credencial en payload; contratos compartidos incluyendo proveedor nuevo |
| F03 | Transporte compatible lee SSE; terminal presenta una vista transitoria de progreso y luego una respuesta final. Otros transportes mantienen respuesta completa. | UTF-8 y schwa fragmentados, texto visible antes de `[DONE]`, herramientas una sola vez al finalizar, rollback ante interrupción/error/truncación, intento fallido separado del reintento, eventos sobredimensionados |
| F04 | Mapa JSON de atajos de texto; expansión única sin ejecutar comandos, leída de nuevo para cada uso personalizado. | Dos atajos, texto adicional literal, Unicode y saltos, expansión que comienza con comando sin redispatch, nombres reservados/desconocidos y archivos inválidos o ausentes |

Uso y límites de las funcionalidades: [cli-composition.md](cli-composition.md).
El inventario de tipos restante y sus siguientes grupos se conserva en
[typechecking.md](typechecking.md); A07 cierra su tanda definida, sin pretender
eliminar toda la deuda de tipos del repositorio.

## Verificación final

`npm run check` aprobado sobre el código final:

- Lint: cero errores y cero avisos.
- Tipos: 150 diagnósticos existentes admitidos, sin nuevos diagnósticos.
- Pruebas: **817 aprobadas, 33 suites, cero fallos, canceladas u omitidas**; duración informada **120402.022636 ms**.
- Reproductor A01–A06: seis regresiones aprobadas, exit 0.
- `git diff --check`: aprobado.

Una ejecución integral anterior aprobó 816 pruebas. La última suma una regresión
del recorrido real de TerminalInput para conservar los espacios del payload de
atajos tanto en entrega directa como al encolar la entrada.

Las pruebas usan proyecto y HOME temporales mediante `scripts/test.js`; no heredan
credenciales. La primera ejecución dentro del sandbox falló por restricciones de
subprocesos (`EPERM`) y de sockets de Bubblewrap. La verificación definitiva se
realizó fuera del sandbox con autorización. Las regresiones dirigidas finales
previas al control integral pasaron (80 pruebas).

No se contactaron proveedores ni se publicaron comentarios o comprobantes reales
en GitHub. Se probó Node v26.5.0; Node 24 y servidores remotos reales no se
verificaron en esta sesión. Los efectos externos de herramientas no se revierten
al fallar un turno, conforme al contrato existente. No se hicieron commits ni
publicaciones externas.
