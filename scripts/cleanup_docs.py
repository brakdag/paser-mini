import os
import shutil

def cleanup():
    # Obtener la raíz del proyecto (padre de scripts/)
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    root_docs = os.path.join(root_dir, 'docs')
    deprecated_dir = os.path.join(root_docs, 'deprecated')
    
    if not os.path.exists(deprecated_dir):
        os.makedirs(deprecated_dir)
    
    # Archivos que ya no están alineados con la visión actual o son análisis obsoletos
    to_deprecate = [
        'project_analysis.md',
        'TODO.md'
    ]
    
    for file_name in to_deprecate:
        src = os.path.join(root_docs, file_name)
        dst = os.path.join(deprecated_dir, file_name)
        if os.path.exists(src):
            shutil.move(src, dst)
            print(f'Moved {file_name} to deprecated/')
        else:
            print(f'File {file_name} not found, skipping')

if __name__ == '__main__':
    cleanup()