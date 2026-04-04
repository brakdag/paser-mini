from google import genai
client = genai.Client()
models = list(client.models.list())
print(f"Total models found: {len(models)}")
for m in models[:10]:
    print(f"Name: {m.name}, Methods: {getattr(m, 'supported_generation_methods', [])}")
