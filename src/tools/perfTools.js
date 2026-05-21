import v8 from 'v8';
import fs from 'fs';

export class PerfTools {
  async metrics() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    
    return JSON.stringify({
      memory: {
        rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
      },
      cpu: {
        user: `${(cpu.user / 1000).toFixed(2)} ms`,
        system: `${(cpu.system / 1000).toFixed(2)} ms`,
      },
      uptime: `${process.uptime().toFixed(2)} s`
    }, null, 2);
  }

  async snapshot({ path: filePath }) {
    if (!filePath) throw new Error("The 'path' parameter is required for heap snapshots.");
    
    try {
      const snapshotStream = v8.getHeapSnapshot();
      const fileStream = fs.createWriteStream(filePath);
      snapshotStream.pipe(fileStream);
      
      return new Promise((resolve, reject) => {
        fileStream.on('finish', () => resolve(`Heap snapshot written to ${filePath}`));
        fileStream.on('error', reject);
      });
    } catch (e) {
      return `ERR: Snapshot failed: ${e.message}`;
    }
  }
}