import asyncio
import threading
import time

async def my_async_func():
    print("Async func started")
    await asyncio.sleep(1)
    print("Async func finished")

def thread_target():
    print("Thread started")
    my_async_func()
    print("Thread finished")

def test():
    t = threading.Thread(target=thread_target)
    t.start()
    t.join()

if __name__ == "__main__":
    test()
