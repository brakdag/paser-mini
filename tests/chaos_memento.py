import asyncio
import logging
import os
import random
from src.infrastructure.memento.manager import MementoManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chaos_test")

async def chaos_writer(manager: MementoManager, writer_id: int):
    try:
        # 1. Push a node
        # Randomly reference existing nodes to create contention
        pointers = [random.randint(1, 100) for _ in range(random.randint(1, 5))]
        await manager.push_memory(
            role=f"Writer-{writer_id}",
            scope='fractal',
            value=f"Chaos content from writer {writer_id} with pointers {pointers}",
            pointers=pointers
        )
        return True
    except Exception as e:
        logger.error(f"Writer {writer_id} failed: {e}")
        return False

async def chaos_reader(manager: MementoManager, reader_id: int):
    try:
        await manager.pull_memory() # Mirror effect
        return True
    except Exception as e:
        logger.error(f"Reader {reader_id} failed: {e}")
        return False

async def run_chaos_test():
    # Use a temporary DB
    db_path = "config/chaos_memory.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    
    manager = MementoManager(db_path=db_path)
    # Initialize DB
    await manager.db.ensure_initialized()
    
    # Pre-populate some nodes so pointers have targets
    for i in range(100):
        await manager.push_memory("Init", "fractal", f"Initial node {i}", key=str(i))

    logger.info("Starting CHAOS MONKEY test: 500 writers, 100 readers.")
    
    start_time = asyncio.get_event_loop().time()
    
    # Launch everything simultaneously
    writers = [chaos_writer(manager, i) for i in range(500)]
    readers = [chaos_reader(manager, i) for i in range(100)]
    
    results = await asyncio.gather(*writers, *readers)
    
    end_time = asyncio.get_event_loop().time()
    duration = end_time - start_time
    
    success_count = sum(results)
    failure_count = len(results) - success_count
    
    logger.info(f"Chaos test completed in {duration:.2f}s")
    logger.info(f"Success: {success_count} | Failures: {failure_count}")
    
    if failure_count > 0:
        logger.error(f"❌ Chaos detected! {failure_count} operations failed.")
        raise RuntimeError(f"System unstable under high load. {failure_count} failures.")
    else:
        logger.info("✅ System survived the Chaos Monkey!")

    if os.path.exists(db_path):
        os.remove(db_path)

if __name__ == "__main__":
    asyncio.run(run_chaos_test())