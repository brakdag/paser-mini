import asyncio
from src.tools import memory_tools

async def test_memento():
    print("Testing Memento Async Migration...")
    
    # Test Push
    push_res = await memory_tools.push_memory(
        scope='tattoo',
        value='Async Verification Test: The system is now natively async.',
        key='async_test_node'
    )
    print(f"Push Result: {push_res}")
    
    # Test Pull
    pull_res = await memory_tools.pull_memory(key='async_test_node')
    print(f"Pull Result: {pull_res}")
    
    if 'Async Verification Test' in pull_res:
        print("\nSUCCESS: Memory system is operational and async.")
    else:
        print("\nFAILURE: Memory retrieval failed.")
        exit(1)

if __name__ == '__main__':
    asyncio.run(test_memento())