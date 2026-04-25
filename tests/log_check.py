import os

log_path = "src/paser.log"
if os.path.exists(log_path):
    try:
        with open(log_path, "rb") as f:
            f.seek(-10000, 2)  # Read last 10KB
            print(f.read().decode("utf-8", errors="ignore"))
    except Exception as e:
        print(f"Error: {e}")
else:
    print(f"Log file not found at: {log_path}")