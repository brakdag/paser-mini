import v8 from "v8";
import fs from "fs";
import { pipeline } from "stream/promises";
import PathValidator from "../utils/pathValidator.js";

/**
 * Performance monitoring tools for system health and memory analysis.
 */
export default class PerfTools {
  /**
   * Get system metrics including memory usage, CPU time, and uptime.
   * @returns {Promise<string>} JSON string containing the system metrics.
   */
  async metrics() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    return JSON.stringify(
      {
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
        uptime: `${process.uptime().toFixed(2)} s`,
      },
      null,
      2,
    );
  }

  /**
   * Create a heap snapshot for memory leak analysis.
   * @param {string} filepath - The output path for the snapshot file.
   * @returns {Promise<string>} Confirmation message upon successful write.
   * @throws {Error} If the filepath is missing or the snapshot process fails.
   */
  async snapshot(filepath) {
    if (!filepath) {
      throw new Error("The 'filepath' parameter is required for heap snapshots.");
    }

    const safePath = PathValidator.getSafePath(filepath);
    const snapshotStream = v8.getHeapSnapshot();
    const fileStream = fs.createWriteStream(safePath);

    await pipeline(
      snapshotStream,
      fileStream,
    );

    return `Heap snapshot written to ${safePath}`;
  }
}
