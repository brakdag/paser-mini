import json
import os
import shutil

def convert_hybrid_to_json(input_path, output_path):
    data = []
    
    try:
        with open(input_path, 'r') as f:
            content = f.read()
        
        # Dividimos por el marcador 'FILE:'
        parts = content.split('FILE:')
        
        for part in parts:
            part = part.strip()
            if not part:
                continue
            
            # La parte se divide en: ruta_del_archivo + resto_del_contenido
            lines = part.split('\n', 1)
            if len(lines) < 2:
                continue
                
            file_path = lines[0].strip()
            json_content = lines[1].strip()
            
            if not json_content.startswith('{'):
                continue
                
            try:
                # Usamos raw_decode para extraer el objeto y detenernos al terminarlo
                decoder = json.JSONDecoder()
                obj, index = decoder.raw_decode(json_content)
                
                # Inyectamos la metadata
                obj['source_file'] = file_path
                data.append(obj)
            except Exception as e:
                print(f"Error parsing JSON for file {file_path}: {e}")
                
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Successfully converted {input_path} to {output_path}")
        return True
    except Exception as e:
        print(f"Critical error: {e}")
        return False

if __name__ == '__main__':
    original = 'spelling_report.json'
    tmp_original = '/tmp/spelling_report_original.json'
    tmp_standard = '/tmp/spelling_report_standard.json'
    
    shutil.copy2(original, tmp_original)
    print(f"Copied original to {tmp_original}")
    
    if convert_hybrid_to_json(tmp_original, tmp_standard):
        print("Conversion complete.")
    else:
        print("Conversion failed.")