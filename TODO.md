# TODO

bug: Adaptador GEMINI error lleva a cierre ctrl+c,
Cuando ocurre un error y el adaptador entra en backoff de reconexión no devulve el foco a la aplicación o sea no permite cambiar de modelo, conectar con otro proveedor, queda anclado a un servicio no disponible. Obligando a reiniciar la aplicación.
