import os
import json
import re

def to_camel_case(snake_str):
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def map_type(prop_name, prop_def, required_list):
    json_type = prop_def.get('type')
    
    if json_type == 'string':
        zod_type = 'z.string()'
    elif json_type == 'number':
        zod_type = 'z.number()'
    elif json_type == 'integer':
        zod_type = 'z.number().int()'
    elif json_type == 'boolean':
        zod_type = 'z.boolean()'
    elif json_type == 'array':
        items = prop_def.get('items', {})
        item_type = map_type(None, items, []) # Recursive call for array items
        zod_type = f'z.array({item_type})'
    else:
        zod_type = 'z.any()'

    if prop_name and prop_name not in required_list:
        zod_type += '.optional()'
    
    return zod_type

def migrate():
    # Paths relative to the scripts/ directory
    src_dir = '../src/core/schemas'
    dest_dir = '../src_js/core/schemas'
    
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)

    files = [f for f in os.listdir(src_dir) if f.endswith('.json')]
    
    for filename in files:
        with open(os.path.join(src_dir, filename), 'r') as f:
            schema = json.load(f)
        
        # Generate JS filename and variable name
        base_name = filename.replace('.json', '')
        camel_name = to_camel_case(base_name)
        js_filename = f'{camel_name}Schema.js'
        var_name = f'{camel_name}Schema'
        
        properties = schema.get('properties', {})
        required = schema.get('required', [])
        
        prop_lines = []
        for prop_name, prop_def in properties.items():
            zod_type = map_type(prop_name, prop_def, required)
            prop_lines.append(f'  {prop_name}: {zod_type},')
        
        props_str = '\n'.join(prop_lines)
        
        # Use triple quotes for the content template to avoid SyntaxError
        content = f"""import {{ z }} from 'zod';\n\nexport const {var_name} = z.object({{\n{props_str}\n}}).strict();\n"""
        
        with open(os.path.join(dest_dir, js_filename), 'w') as f:
            f.write(content)
        
        print(f'Migrated {filename} -> {js_filename}')

if __name__ == '__main__':
    migrate()