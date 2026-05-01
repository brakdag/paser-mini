import json
import os
import shutil
import re

def sanitize_filename(filename):
    # Reemplaza caracteres no permitidos por guiones bajos
    return re.sub(r'[\\/:*?"<>|]', '_', filename) + '.json'

def extract_entries(input_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    try:
        with open(input_path, 'r') as f:
            content = f.read()
        
        parts = content.split('FILE:')
        count = 0
        
        for part in parts:
            part = part.strip()
            if not part:
                continue
            
            lines = part.split('\n', 1)
            if len(lines) < 2:
                continue
                
            source_file_path = lines[0].strip()
            json_content = lines[1].strip()
            
            if not json_content.startswith('{'):
                continue
                
            try:
                decoder = json.JSONDecoder()
                obj, index = decoder.raw_decode(json_content)
                
                # Generar un nombre de archivo basado en la ruta original
                new_filename = sanitize_filename(source_file_path)
                target_path = os.path.join(output_dir, new_filename)
                
                with open(target_path, 'w') as f_out:
                    json.dump(obj, f_out, indent=2)
                
                count += 1
            except Exception as e:
                print(f"Error extracting object for {source_file_path}: {e}")
                
        print(f"Successfully extracted {count} JSON files to '{output_dir}/'")
        return True
    except Exception as e:
        print(f"Critical error: {e}")
        return False

if __name__ == '__main__':
    input_file = 'spelling_report.json'
    output_directory = 'extracted_json'
    
    if extract_entries(input_file, output_directory):
        print("Extraction process finished.")
    else:
        print("Extraction process failed.")