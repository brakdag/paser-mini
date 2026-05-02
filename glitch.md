# Reporte de Glitch: Discrepancia en la Percepción de Erroos

## ⚠️ Descripción del Problema
Existe una desconexión crítica entre lo que el Agente (Clara) percibe y lo que el Usuario observa durante la ejecución de herramientas.

### Comportamiento Observado
1. **El Agente recibe un `OK`**: El orquestador envía un `TOOL_RESPONSE` con `status: "success"` y `data: "OK"` al agente.
2. **El Usuario ve un Error**: En la interfaz de usuario, aparece un mensaje de `⚠️ Glitch detectado` (ej. `Validation error: Missing required argument: 'args'` o `Tool 'tool_name' not found`).

## 🔍 Análisis de Causa Raíz (Hipótesis)
El error ocurre en la **capa de validación o en el orquestador** (antes de que la herramienta se ejecute o inmediatamente después de un fallo de parsing). El problema es que el orquestador **no está propagando el error al agente** a través del canal de respuesta de la herramienta (`TOOL_RESPONSE`). En su lugar, el error se queda atrapado en la capa de visualización del usuario.

## 🚨 Impacto
- **Ceguera del Agente**: El agente asume que la acción fue exitosa y continúa su razonamiento basándose en un estado falso.
- **Fallo de Autonomía**: El ciclo de feedback (Error $\rightarrow$ Corrección) se rompe, impidiendo que el agente pueda corregir su propio uso de las herramientas.
- **Riesgo de Bucles**: Puede llevar a bucles infinitos de razonamiento erróneo al intentar operar sobre un estado que no se actualizó como se esperaba.

## ✅ Requerimiento Técnico
Cualquier error de validación, parsing o ejecución detectado por el orquestador **debe** ser devuelto al agente mediante el formato estándar: `ERR: <mensaje de error>` dentro del `TOOL_RESPONSE`. El agente no debe recibir un `OK` si la validación falló.