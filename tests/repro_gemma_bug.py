from src.infrastructure.gemini.adapter import GeminiAdapter

def test_gemma_mutation():
    adapter = GeminiAdapter()
    adapter.start_chat(model_name='gemma-3-test', system_instruction='SYSTEM_PROMPT', temperature=0.7)
    adapter.inject_message('user', 'Hello!')
    
    print(f'Initial history: {adapter.history[0]["parts"][0]["text"]}')
    
    # Simulate calling _build_payload multiple times (as happens in a conversation)
    for i in range(3):
        adapter._build_payload()
        print(f'After call {i+1}: {adapter.history[0]["parts"][0]["text"]}')

if __name__ == '__main__':
    test_gemma_mutation()