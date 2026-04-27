# xml tool no cerrados.

## que suele ocurrir.

A veces el la ia envía tangs xml de tools, no cerrados, inclusive el json tambien
se encuentra no cerrado, esto larga error si se coloca en el history o en
el mismo mensaje, entonces hay que revisar si hay un mensaje invalido, que contiene
erro no debe grabarse en el history, ni responder nada, debe desecharse, si
mostrar una notificación quizá en el chat, como el error 502 etc, que no
aparece en el chat, si parece para saber que apareció pero no debe quedar
grabado en el chat, porque después se rompe todo sino.

## ERROR XML no cerrado.

En este caso deberíamos chequear que o está cerrado y cerrarlo pero tambien
puede ocurrir que, el JSON esté corrupto.

## EL JSON que está dentro del XML ESTÉ CORRUPTO.

En este caso, si no puede recuperarse el mensaje se emite error para que lo
vea el usuario y listo. El el función con error no debe responderse.

## Posibles soluciones.

Sanitizar esos llamados corruptos, cerrar el tag al final del mensaje si no se
ha cerrado, y tratar de arreglar el JSON. Devolver en todo caso error.
