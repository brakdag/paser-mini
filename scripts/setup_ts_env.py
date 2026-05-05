import os
import json

def setup_ts():
    # Directorios
    dirs = [
        'src_ts/core/command_handlers',
        'src_ts/core/schemas',
        'src_ts/core/logging',
        'src_ts/infrastructure/gemini',
        'src_ts/infrastructure/nvidia',
        'src_ts/infrastructure/memento',
        'src_ts/tools',
        'src_ts/config'
    ]
    
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # package.json
    package_json = {
        'name': 'paser-mini-ts',
        'version': '0.1.0',
        'description': 'Paser Mini migrated to TypeScript',
        'main': 'dist/main.js',
        'type': 'module',
        'scripts': {
            'build': 'tsc',
            'start': 'node dist/main.js',
            'dev': 'ts-node src_ts/main.ts'
        },
        'dependencies': {
            'zod': '^3.22.0',
            'commander': '^11.0.0',
            'chalk': '^5.3.0',
            'ora': '^7.0.0',
            'better-sqlite3': '^9.0.0',
            'axios': '^1.6.0'
        },
        'devDependencies': {
            'typescript': '^5.2.0',
            'ts-node': '^10.9.0',
            '@types/node': '^20.0.0'
        }
    }

    with open('package.json', 'w') as f:
        json.dump(package_json, f, indent=2)

    # tsconfig.json
    tsconfig = {
        'compilerOptions': {
            'target': 'ESNext',
            'module': 'ESNext',
            'moduleResolution': 'node',
            'outDir': './dist',
            'rootDir': './src_ts',
            'strict': True,
            'esModuleInterop': True,
            'skipLibCheck': True,
            'forceConsistentCasingInFileNames': True,
            'experimentalDecorators': True,
            'emitDecoratorMetadata': True
        },
        'include': ['src_ts/**/*']
    }

    with open('tsconfig.json', 'w') as f:
        json.dump(tsconfig, f, indent=2)

if __name__ == '__main__':
    setup_ts()