import asyncio
import logging
import os
import pytest
from src.infrastructure.memento.database import MementoDB

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stress_test")

async def thunderclap_write(db: MementoDB, op_id: int):
    """A single, aggressive write operation."""
    try:
        node_id = await db.push_node(
            role="thunderclap",
            node_type="fractal",
            content=f"Burst content {op_id}",
            teaser=f"Teaser {op_id}"
        )
        await db.increment_weight(node_id)
        return True
    except Exception as e:
        logger.error(f"Operation {op_id} failed: {e}")
        return False

async def run_stress_test(num_concurrent_ops: int):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    db_path = os.path.join(base_dir, "config", "stress_test_memory.db")
    
    if os.path.exists(db_path):
        os.remove(db_path)

    db = MementoDB(db_path=db_path)
    await db.ensure_initialized()

    logger.info(f"Starting THUNDERCLAP test: {num_concurrent_ops} concurrent writes.")
    start_time = asyncio.get_event_loop().time()

    # The Thunderclap: Launch all operations simultaneously
    tasks = [thunderclap_write(db, i) for i in range(num_concurrent_ops)]
    results = await asyncio.gather(*tasks)

    end_time = asyncio.get_event_loop().time()
    duration = end_time - start_time

    success_count = sum(results)
    failure_count = num_concurrent_ops - success_count

    logger.info(f"Test completed in {duration:.2f}s")
    logger.info(f"Success: {success_count} | Failures: {failure_count}")

    if failure_count > 0:
        logger.error("❌ Concurrency failure detected!")
        raise RuntimeError(f"Database locked or crashed. {failure_count} operations failed.")
    
    if duration > 2.0:
        logger.warning(f"⚠️ Performance warning: {duration:.2f}s is above the 2s threshold.")

    logger.info("✅ Thunderclap test passed successfully!")
    
    if os.path.exists(db_path):
        os.remove(db_path)

if __name__ == "__main__":
    # Testing with 100 concurrent operations to push SQLite WAL to the limit
    asyncio.run(run_stress_test(num_concurrent_ops=100))