import subprocess
import sys
import platform

def test_set_timer_syntax(seconds: int, mensaje: str):
    # This mimics the code in system_tools.py
    if platform.system() == "Windows":
        cmd = f"import time; time.sleep({seconds}); import subprocess; subprocess.run(['powershell', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(' + {repr(mensaje)} + ', \"Paser Timer\")'])"
        print(f"Generated command: {cmd}")
        # We don't actually run it, just check syntax (in Python)
        try:
            compile(cmd, '<string>', 'exec')
            print("Python Syntax: OK")
        except SyntaxError as e:
            print(f"Python Syntax: ERROR: {e}")
    else:
        print("Not on Windows, skipping PowerShell test")

# Test with single quotes in message
test_set_timer_syntax(1, "It's a test")
