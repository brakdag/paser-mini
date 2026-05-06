import { MementoManager } from '../src_js/infrastructure/memento/manager.js';
import fs from 'fs';
import path from 'path';

async function chaosWriter(manager, writerId) {
  try {
    const pointers = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => Math.floor(Math.random() * 100) + 1);
    await manager.pushMemory(
      `Writer-${writerId}`,
      'fractal',
      `Chaos content from writer ${writerId} with pointers ${pointers.join(',')}`,
      null,
      pointers
    );
    return true;
  } catch (e) {
    console.error(`Writer ${writerId} failed: ${e.message}`);
    return false;
  }
}

async function chaosReader(manager, readerId) {
  try {
    await manager.pullMemory(); // Mirror effect
    return true;
  } catch (e) {
    console.error(`Reader ${readerId} failed: ${e.message}`);
    return false;
  }
}

async function runChaosTest() {
  const dbPath = path.join(process.cwd(), 'config/chaos_memory_js.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const manager = new MementoManager(dbPath);

  console.log('Pre-populating 100 nodes...');
  for (let i = 0; i < 100; i++) {
    await manager.pushMemory('Init', 'fractal', `Initial node ${i}`, i.toString());
  }

  console.log('Starting CHAOS MONKEY test: 500 writers, 100 readers.');
  const startTime = Date.now();

  const writers = Array.from({ length: 500 }, (_, i) => chaosWriter(manager, i));
  const readers = Array.from({ length: 100 }, (_, i) => chaosReader(manager, i));

  const results = await Promise.all([...writers, ...readers]);

  const duration = (Date.now() - startTime) / 1000;
  const successCount = results.filter(Boolean).length;
  const failureCount = results.length - successCount;

  console.log(`Chaos test completed in ${duration.toFixed(2)}s`);
  console.log(`Success: ${successCount} | Failures: ${failureCount}`);

  if (failureCount > 0) {
    console.error('❌ Chaos detected! System unstable under high load.');
    process.exit(1);
  } else {
    console.log('✅ System survived the Chaos Monkey!');
  }

  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

runChaosTest().catch(err => {
  console.error('Critical Test Error:', err);
  process.exit(1);
});