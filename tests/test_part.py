from google.genai import types
try:
    p = types.Part.from_text("hello")
    print("Success")
except Exception as e:
    print(f"Error: {e}")
