import os
import json
import shutil

def setup_js():
    # Eliminar rastro de TS si existe
    if os.path.exists('src_ts'):
        shutil.rmtree('src_ts')
    if os.path.exists('tsconfig.json'):
        os.remove('tsconfig.json')

    # Directorios para JS
    dirs = [
        'src_js/core/command_handlers',
        'src_js/core/schemas',
        'src_js/core/logging',
        'src_js/infrastructure/gemini',
        'src_js/infrastructure/nvidia',
        'src_js/infrastructure/memento',
        'src_js/tools',
        'src_js/config'
    ]
    
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # package.json simplificado
    package_json = {
        'name': 'paser-mini-js',
        'version': '0.1.0',
        'description': 'Paser Mini migrated to pure JavaScript',
        'main': 'src_js/main.js',
        'type': 'module',
        'scripts': {
            'start': 'node src_js/main.js'
        },
        'dependencies': {
            'zod': '^3.22.0',
            'commander': '^11.0.0',
            'chalk': '^5.3.0',
            'ora': '^7.0.0',
            'better-sqlite3': '^9.0.0',
            'axios': '^1.6.0'
        }
    }

    with open('package.json', 'w') as f:
        json.dump(package_json, f, indent=2)

if __name__ == '__main__':
    setup_js()