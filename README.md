# Paser (Sistema Autónomo de Function Calling - ReAct Pattern)

<div align="center">
  <img src="https://via.placeholder.com/200x200.png?text=Gorrión+Mascota" alt="Paser Mascot" width="200"/>
</div>

**Paser** (originalmente llamado "Passer", por *Passer domesticus*) es un agente autónomo utilizando el modelo Gemini de Google (vía `google-genai` SDK) que emplea el patrón **ReAct (Reasoning and Acting)** para ejecutar funciones locales de forma transparente para el usuario.

El cambio de nombre de "Passer" a "Paser" simplifica la escritura en la terminal, manteniendo la raíz del nombre original y el significado vinculado al gorrión, un ave muy común en el sur mendocino.

## 🚀 Características Principales

1.  **Function Calling Local (Manual):**
    *   No utiliza herramientas nativas de la SDK de Google.
    *   Utiliza *System Instruction* para obligar al modelo a emitir llamadas estructuradas (`<TOOL_CALL>`).
    *   El script actóa como un *middleware* que intercepta estas llamadas, ejecuta la función local, y devuelve el resultado en formato `<TOOL_RESPONSE>` al historial del modelo.

2.  **Seguridad y Control de Archivos:**
    *   Todas las operaciones de archivo (leer, escribir, borrar) están restringidas al directorio de trabajo actual definido por `PROJECT_ROOT` mediante una función de validación de rutas segura (`get_safe_path`).
    *   Borrado de archivos requiere confirmación interactiva (`y/n`).

3.  **Configuración Dinámica:**
    *   **Temperatura:** Permite ajustar la creatividad del modelo al seleccionar un modelo (`/models`).
    *   **Pensamientos:** Permite alternar la visibilidad de los pensamientos del modelo (líneas que comienzan con `*`) mediante el comando `/thinking`.
    *   **Directorio de Trabajo:** Permite cambiar el directorio de trabajo del agente mediante `/cd <ruta>`.

## 📋 Seguimiento del Proyecto

El seguimiento de tareas, errores y nuevas características se gestiona a través de los **Issues** de GitHub. Puedes ver el estado actual del desarrollo [aquí](https://github.com/brakdag/paser/issues).

## 🛠️ Comandos en la Consola

*   `:q` - Salir de la sesión.
*   `/models` - Listar modelos disponibles, cambiar modelo y configurar temperatura.
*   `/thinking` - Alternar la visibilidad de los pensamientos del modelo (inicia activado).
*   `/cd <ruta>` - Cambiar el directorio de trabajo del agente.

## ⚙️ Requisitos

*   Python 3.x
*   Librería `google-genai`
*   Librería `html2text`
*   Variable de entorno `GEMINI_API_KEY` configurada con tu clave de API de Google AI Studio.

## 💻 Ejecución

Una vez instalado, puedes ejecutar la aplicación simplemente usando:

```bash
paser
```

## 🛠️ Herramientas Disponibles

*   `obtener_hora_actual(zona_horaria)`
*   `calculadora_basica(operacion)`
*   `leer_archivo(path)`
*   `escribir_archivo(path, contenido)`
*   `borrar_archivo(path)`
*   `listar_archivos(path)`
*   `buscar_en_internet(query)`: Búsqueda vía DuckDuckGo.
*   `leer_url(url)`: Lectura de contenido de páginas web.
*   `obtener_directorio_actual()`: Devuelve la ruta absoluta del directorio de trabajo actual.
