import sys
import os

def test_args():
    print(f"Python version: {sys.version}")
    print(f"Arguments: {sys.argv}")
    
    # If the separator '--' worked, the arguments passed after it 
    # should appear in sys.argv starting from index 1.
    # Example: python tests/test_sandbox.py -m hello -> sys.argv = ['tests/test_sandbox.py', '-m', 'hello']
    
    if len(sys.argv) > 1:
        print("Arguments received successfully.")
    else:
        print("No arguments received.")

if __name__ == '__main__':
    test_args()
