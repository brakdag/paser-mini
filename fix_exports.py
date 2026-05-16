import os
import re

def process_files(file_list_path):
    with open(file_list_path, 'r') as f:
        files = [line.strip() for line in f if line.strip()]

    # Mapping of filename (without ext) to export name
    export_map = {}

    # Step 1: Change to default exports
    for file_path in files:
        if not os.path.exists(file_path):
            continue
            
        with open(file_path, 'r') as f:
            content = f.read()
            
        # Match "export class Name" or "export const Name"
        match = re.search(r'export (class|const|function) (\w+)', content)
        if match:
            export_type = match.group(1)
            export_name = match.group(2)
            export_map[os.path.basename(file_path).replace('.js', '')] = export_name
            
            # Replace
            if export_type == 'class':
                new_content = content.replace(f'export class {export_name}', f'class {export_name}')
                new_content += f'\n\nexport default {export_name};\n'
            elif export_type == 'const':
                new_content = content.replace(f'export const {export_name}', f'const {export_name}')
                new_content += f'\n\nexport default {export_name};\n'
            elif export_type == 'function':
                new_content = content.replace(f'export function {export_name}', f'function {export_name}')
                new_content += f'\n\nexport default {export_name};\n'
            else:
                continue

            with open(file_path, 'w') as f:
                f.write(new_content)

    # Step 2: Update imports
    # This part is complex. For now, let's just do a simple search and replace 
    # based on the filenames and exported names found.
    
    # We need to search all .js files in src/
    for root, dirs, filenames in os.walk('src'):
        for filename in filenames:
            if filename.endswith('.js'):
                full_path = os.path.join(root, filename)
                with open(full_path, 'r') as f:
                    content = f.read()
                
                updated_content = content
                for file_base, export_name in export_map.items():
                    # Look for: import { ExportName } from './.../file_base'
                    import_pattern = re.compile(rf'import\s*{{\s*{export_name}\s*}}\s*from\s*[\'"].*?{file_base}[\'"]')
                    if import_pattern.search(updated_content):
                        updated_content = re.sub(import_pattern, f'import {export_name} from "./{file_base}"', updated_content)
                
                if updated_content != content:
                    with open(full_path, 'w') as f:
                        f.write(updated_content)

process_files('files_to_fix.txt')
