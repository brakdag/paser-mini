# TRABAJO A REALIZAR.

## Especificaciones de trabajo.

- El código siempre debe estar alineado con ./docs/cleanCode.md
- Archivo modificado debe verificarse con eslint.
- El trabajo terminado debe marcarse como terminado.
- Para comprobar todo trabajo es necesario reiniciar el sistema, porque los
  archivos no se cargan al vuelo a la ram, persisten tentonces es necesario hacerlo.

## Lista de trabajos a realizar.

[] Agregar tool "sed", para permitir uso de expresiones regulares para editar archivo.
archivos ej: sed 's/:free$//' openrouter.txt > openrouter_clean.txt

Esto sería sed(":free$","");

quizá internamente para mayor seguridad en vez de invocar el comando sed de la
terminal podríamos usar

string.replace(/:free$/gm, '');

Cuando se puso el mismo nombre de archivo en la entrada y la salida se obtuvo
archivo vacío,(cuidado)

Esto va a permitir mayor flexibilidad que usar "replace" para editar archivos,
pero debe ser una tool distinta porque ciertos modelos pueden hacer desastre
con esto porque hace modificaciones múltiples y ese pensamiento múltiple a veces
no lo tienen bien claro todos los modelos de IA.

[] Simplicacción de tool_call.

Actualmente utilizamos un símbolo al comienzo y otro al final de tool call.

ejemplo: @read("file.txt")#

hay redundancia porque si admitimos que el simbolo @ es una llamada una
función javascript el ")" nos indica el fin de la llamada. Se puede rastrear
y extraer las llamadas sin necesidad del simbolo # hay modelos que no pueden
cambiar este simbolo por otro y ya está hardcodeado en su memorial usan el tag
tool_call