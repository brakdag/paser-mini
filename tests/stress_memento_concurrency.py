import asyncio
import logging
import os
import pytest
from src.infrastructure.memento.database import MementoDB

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stress_test")

async def worker(db: MementoDB, worker_id: int, num_ops: int):
    """Simula un flujo de trabajo de un agente realizando operaciones en la DB."""
    logger.info(f"Worker {worker_id} starting...")
    for i in range(num_ops):
        try:
            # 1. Push a new node
            node_id = await db.push_node(
                role=f"worker_{worker_id}",
                node_type="fractal",
                content=f"Content from worker {worker_id} op {i}",
                teaser=f"Teaser {worker_id}-{i}"
            )
            
            # 2. Immediately pull it back to verify
            node = await db.pull_node(node_id)
            if not node or node['role'] != f"worker_{worker_id}":
                raise ValueError(f"Data corruption detected! Expected worker_{worker_id}, got {node['role'] if node else 'None'}")
            
            # 3. Increment weight of the same node
            await db.increment_weight(node_id)
            
            # Small sleep to allow other tasks to interleave
            await asyncio.sleep(0.001)
            
        except Exception as e:
            logger.error(f"Worker {worker_id} failed at op {i}: {e}")
            raise e

    logger.info(f"Worker {worker_id} finished.")

async def run_stress_test(num_workers: int, ops_per_worker: int):
    # Setup DB path
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    db_path = os.path.join(base_dir, "config", "stress_test_memory.db")
    
    # Clean up old test DB if exists
    if os.path.exists(db_path):
        os.remove(db_path)

    db = MementoDB(db_path=db_path)
    await db.ensure_initialized()

    logger.info(f"Starting stress test: {num_workers} workers, {ops_per_worker} ops each.")
    start_time = asyncio.get_event_loop().time()

    # Launch workers
    tasks = [worker(db, i, ops_per_worker) for i in range(num_workers)]
    await asyncio.gather(*tasks)

    end_time = asyncio.get_event_loop().time()
    duration = end_time - start_time

    # Final Verification
    logger.info("Verifying results...")
    # We need to count nodes. Since we don't have a count_nodes method, 
    # we'll use the mirror to get a sense or just check the total count via a manual query if we could.
    # For now, let's just check if the DB is still accessible and healthy.
    try:
        mirror = await db.get_mirror()
        logger.info(f"Stress test completed in {duration:.2f}s")
        logger.info(f"Mirror check: Found {len(mirror['tattoos'])} tattoos.")
        logger.info("✅ Stress test passed successfully!")
    except Exception as e:
        logger.error(f"❌ Stress test failed during verification: {e}")
        raise e
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)

if __name__ == "__main__":
    # Run with 10 workers, 50 ops each
    asyncio.run(run_stress_test(num_workers=10, ops_per_worker=50))