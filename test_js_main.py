import subprocess

try:
    result = subprocess.run(['node', 'src_js/main.js', '--help'], capture_output=True, text=True, timeout=10)
    print('STDOUT:', result.stdout)
    print('STDERR:', result.stderr)
except Exception as e:
    print('Error:', str(e))