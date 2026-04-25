import subprocess
import sys

def update():
    print('Updating package to editable mode...')
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-e', '.'])
        print('Successfully updated to editable mode.')
    except Exception as e:
        print(f'Error updating: {e}')

if __name__ == '__main__':
    update()