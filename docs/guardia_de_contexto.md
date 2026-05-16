# Protocolo: Guardia de Contexto

Este documento establece las reglas de compromiso para mantener la integridad de la ventana de contexto y la estabilidad del proyecto.

## 1. El Patrón de Ramificación Efímera (Branch & Discard)
Para evitar la intoxicación del contexto, la depuración de errores se tratará mediante un proceso de ramificación temporal:
- **Ramificación (Branching)**: Ante un error, se crea una rama lógica de trabajo para intentar la reparación.
- **Resolución o Descarte**: 
    - Si la rama tiene éxito, la solución se integra a la línea principal.
    - Si la rama falla o se vuelve tóxica, la rama se destruye por completo.
- **Retorno a la Pureza**: Tras el descarte, se vuelve al punto exacto anterior al error. El error desaparece de la historia de la línea principal, como si nunca hubiera existido, manteniendo la ventana de contexto limpia.

## 2. Higiene de la Ventana de Contexto
La ventana de contexto debe permanecer libre de ruido y entropía:
- **Prohibición de Acumulación**: No se permite avanzar a una nueva funcionalidad si existe un error pendiente o no resuelto.
- **Eliminación de la Toxicidad**: Si se detecta un bucle de error o una espiral de complejidad, se debe realizar un "reset" inmediato de la sesión de trabajo.

## 3. Principios de Ingeniería de Software

### Protocolo de Unificación Lingüística
Para evitar la entropía causada por el uso de múltiples idiomas:
- **Código en Inglés**: Todo el código (variables, funciones, comentarios, logs) debe ser estrictamente en inglés.
- **Traducción y Corrección Lingüística**: Cualquier término en español que se filtre al código debe ser traducido al inglés. Asimismo, cualquier error ortográfico o gramatical en comentarios, logs o mensajes de sistema debe ser corregido para mantener la pureza de la información.
- **Comunicación de Alto Nivel**: La interacción con el usuario se mantiene en español, pero el output técnico debe ser puramente inglés.

### Protocolo de Privacidad de Diagnóstico (Muro de Información)
Para evitar la contaminación del razonamiento por errores de infraestructura:
- **Aislamiento de Capas**: El modelo principal (razonamiento) tiene prohibido el acceso a los logs de error y detalles de infraestructura.
- **Acceso Restringido**: Solo los agentes de reparación (efímeros) tienen permiso para acceder a los datos de diagnóstico.
- **Canal de Diagnóstico Paralelo**: Los errores de sistema deben viajar por un canal separado, nunca inyectándose en el flujo de conversación del modelo principal.

### Protocolo de Neutralidad de Interacción (Vibe Check)
Para gestionar la carga emocional y mantener la fricción mínima:
- **Detección de Carga Emocional**: Identificar entradas con alta negatividad o lenguaje no profesional.
- **Traducción a Lenguaje de Trabajo**: Convertir la frustración del usuario en requerimientos técnicos neutros. El sistema no responde a la emoción, responde a la necesidad subyacente.
- **Preservación de la Calma**: El sistema mantiene un tono profesional, estable y desprovisto de reactividad emocional, evitando la escalada de conflictos.

### Principios Operativos
- **Atomicidad**: Los cambios deben ser mínimos, incrementales y verificables.
- **Verificación de la Causa Raíz**: No se proponen soluciones para síntomas; se diagnostica la causa antes de actuar.
- **Cero Suposiciones**: La arquitectura se construye exclusivamente sobre requerimientos explícitos del usuario. La interpretación de la intención es un riesgo de seguridad y estabilidad.
- **Base de Verdad**: La base de código estable es el único referente. Cualquier cambio debe ser validado contra la base antes de ser aceptado.

---
*Protocolo establecido para garantizar la integridad de la inteligencia y la estabilidad del sistema.*