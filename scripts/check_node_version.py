import subprocess

try:
    result = subprocess.run(['node', '-v'], capture_output=True, text=True, check=True)
    print(f'Node.js version: {result.stdout.strip()}')
except subprocess.CalledProcessError as e:
    print(f'Error checking node version: {e}')
except FileNotFoundError:
    print('Node.js is not installed or not in PATH')