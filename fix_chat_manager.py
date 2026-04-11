import os

file_path = 'paser/core/chat_manager.py'

with open(file_path, 'r') as f:
    lines = f.readlines()

# Identificar el rango de GITHUB_TOOLS y limpiar
# Basado en la lectura anterior, hay basura entre la línea 75 y 85
new_lines = []
skip = False
for i, line in enumerate(lines):
    # Mantener todo hasta GITHUB_TOOLS
    if 'GITHUB_TOOLS = {' in line:
        new_lines.append(line)
        new_lines.append('        "list_issues": ("Listando issues", "󰍃"),\n')
        new_lines.append('        "create_issue": ("Creando issue", "󰉋"),\n')
        new_lines.append('        "close_issue": ("Cerrando issue", "󰆵"),\n')
        new_lines.append('        "edit_issue": ("Editando issue", "󰑐"),\n')
        new_lines.append('    }\n')
        skip = True
        continue
    
    if skip and 'CODE_TOOLS = {' in line:
        skip = False
        new_lines.append('\n')
        new_lines.append(line)
        continue
        
    if not skip:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print('Fix applied successfully.')