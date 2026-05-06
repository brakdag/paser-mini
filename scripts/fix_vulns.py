import subprocess

def fix():
    try:
        # 1. Regenerar el lockfile
        print('Regenerando package-lock.json...')
        subprocess.run(['npm', 'install'], capture_output=True, text=True, check=True)
        print('Lockfile regenerado con éxito.')

        # 2. Ejecutar npm audit fix
        print('Ejecutando npm audit fix...')
        result = subprocess.run(['npm', 'audit', 'fix'], capture_output=True, text=True, check=True)
        print('STDOUT:\n', result.stdout)
        print('STDERR:\n', result.stderr)
    except subprocess.CalledProcessError as e:
        print('Error durante el proceso:')
        print(e.stdout)
        print(e.stderr)

if __name__ == '__main__':
    fix()