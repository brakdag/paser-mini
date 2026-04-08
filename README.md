# Paser (Sistema Autónomo de Function Calling - ReAct Pattern)

<div align="center">
  <img src="assets/mascot.png" alt="Paser Mascot" width="200"/>
</div>

**Paser** (originalmente llamado "Passer", por _Passer domesticus_) es un agente autónomo utilizando el modelo Gemini de Google (vía `google-genai` SDK) que emplea el patrón **ReAct (Reasoning and Acting)** para ejecutar funciones locales de forma transparente para el usuario.

El cambio de nombre de "Passer" a "Paser" simplifica la escritura en la terminal, manteniendo la raíz del nombre original y el significado vinculado al gorrión, un ave muy común en el sur mendocino.

## 📦 Instalación

Puedes elegir entre clonar el repositorio (para desarrollo) o ejecutar el script de instalación directamente:

### Opción 1: Instalación rápida (Recomendada)

```bash
curl -fsSL https://raw.githubusercontent.com/brakdag/paser/main/install.sh | bash
```

### Opción 2: Clonar desde el repositorio (Para desarrollo)

```bash
git clone https://github.com/brakdag/paser.git && cd paser && chmod +x install.sh && ./install.sh
```

### 3. Configura tu clave de API

```bash
export GOOGLE_API_KEY="tu_clave_api_aquí"
```

## 🚀 Ejecución

Una vez instalado, puedes ejecutar la aplicación simplemente usando:

```bash
paser
```

## 🛠️ Características Principales

1.  **Function Calling Local (Manual):**
    - No utiliza herramientas nativas de la SDK de Google.
    - Utiliza _System Instruction_ para obligar al modelo a emitir llamadas estructuradas (`<TOOL_CALL>`).
    - El script actúa como un _middleware_ que intercepta estas llamadas, ejecuta la función local, y devuelve el resultado en formato `<TOOL_RESPONSE>` al historial del modelo.

2.  **Seguridad y Control de Archivos:**
    - Todas las operaciones de archivo (leer, escribir, borrar) están restringidas al directorio de trabajo actual definido por `PROJECT_ROOT` mediante una función de validación de rutas segura (`get_safe_path`).
    - Borrado de archivos requiere confirmación interactiva (`y/n`).

3.  **Configuración Dinámica:**
    - **Temperatura:** Permite ajustar la creatividad del modelo al seleccionar un modelo (`/models`).
    - **Pensamientos:** Permite alternar la visibilidad de los pensamientos del modelo (líneas que comienzan con `*`) mediante el comando `/thinking`.
    - **Directorio de Trabajo:** Permite cambiar el directorio de trabajo del agente mediante `/cd <ruta>`.
    - Tokens en ventana de contexto: /t retorna en un mensaje el numero de tokens.

## 🔧 Herramientas Disponibles

### 📂 Archivos y Directorios

- `read_file(path)`, `read_files(paths)`, `read_lines(...)`, `read_head(...)`: Lectura de archivos.
- `write_file(path, contenido)`, `update_line(...)`, `replace_text(...)`, `replace_block(...)`: Escritura y edición.
- `list_dir(path)`, `make_dir(path)`, `rename_path(origen, destino)`, `remove_file(path)`: Gestión de rutas.
- `global_search(query)`, `glob_search(pattern)`, `global_replace(path, search_text, replace_text, extensiones)`: Búsqueda y reemplazo masivo.

### 🔡 Navegación de Código

- `list_symbols(file_path)`: Lista todas las clases y funciones definidas en un archivo.
- `get_definition(symbol_name, file_path)`: Localiza la línea y columna donde se define un símbolo.
- `get_references(symbol_name, file_path)`: Busca todas las referencias a un símbolo en el archivo.

### 🌐 Utilidades y Web

- `web_search(query)`, `fetch_url(url)`: Acceso a información externa.
- `get_time(zona_horaria)`, `calculate(operacion)`, `get_cwd()`: Herramientas básicas.

### 💻 Sistema y Notificaciones

- `analyze_pyright(path)`: Análisis estático de Python.
- `notify_user()`: Notificación simple al usuario.
- `set_timer(seconds, message)`: Programación de tareas.
- `is_window_in_focus(action)`: Verificación de estado de la terminal.

