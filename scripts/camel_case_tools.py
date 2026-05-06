import os
import json
import re

def to_camel_case(snake_str):
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def refactor():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    registry_path = os.path.join(root_dir, 'src/tools/registry_positional.json')
    
    with open(registry_path, 'r') as f:
        catalog = json.load(f)
    
    # Create mapping
    mapping = {item[0]: to_camel_case(item[0]) for item in catalog}
    
    # Directories to process
    dirs_to_process = ['src', 'src_js', 'docs']
    
    for d in dirs_to_process:
        dir_path = os.path.join(root_dir, d)
        if not os.path.exists(dir_path): continue
        
        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.endswith(('.py', '.js', '.json', '.md')):
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content = content
                    # Replace tool names. We sort by length descending to avoid partial replacements
                    # (e.g., replacing 'read_file' before 'read_file_advanced')
                    sorted_tools = sorted(mapping.keys(), key=len, reverse=True)
                    for snake in sorted_tools:
                        camel = mapping[snake]
                        new_content = new_content.replace(snake, camel)
                    
                    if new_content != content:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f'Refactored: {file}')

if __name__ == '__main__':
    refactor()