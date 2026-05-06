import subprocess
import sys
import os

if __name__ == '__main__':
    # Ensure we are running from the project root
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    test_file = sys.argv[1]
    
    # Resolve absolute path to the test file
    abs_test_path = os.path.join(root_dir, test_file)
    
    try:
        result = subprocess.run(['node', abs_test_path], cwd=root_dir, capture_output=True, text=True)
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        sys.exit(result.returncode)
    except Exception as e:
        print(f'Error executing test: {e}', file=sys.stderr)
        sys.exit(1)