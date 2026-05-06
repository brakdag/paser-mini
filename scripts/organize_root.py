import os
import shutil

def organize():
    # Get the root directory (parent of scripts/)
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    # Create logs directory in root
    logs_dir = os.path.join(root_dir, 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    
    # Files to move (relative to root)
    moves = {
        'paser_mini.log': 'logs/paser_mini.log',
        'hello_paser.py': 'scripts/hello_paser.py',
        'run_all_tests.py': 'tests/run_all_tests.py',
        'run_tests.py': 'tests/run_tests.py',
        'test_agent_user.txt': 'tests/test_agent_user.txt',
        'test_data.json': 'tests/test_data.json',
        'test_js_main.py': 'tests/test_js_main.py',
    }
    
    for src_rel, dst_rel in moves.items():
        src = os.path.join(root_dir, src_rel)
        dst = os.path.join(root_dir, dst_rel)
        if os.path.exists(src):
            shutil.move(src, dst)
            print(f'Moved {src_rel} to {dst_rel}')
        else:
            print(f'File {src_rel} not found, skipping')

if __name__ == '__main__':
    organize()