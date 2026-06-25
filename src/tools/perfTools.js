import v8 from "v8";
import fs from "fs";

/** Performance monitoring tools. */
export default class PerfTools {
  /**
   * Get system metrics.
   * @returns {Promise<string>} JSON metrics.
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
   * Create heap snapshot.
   * @param {string} filepath Output path.
   * @returns {Promise<string>} Result.
   */
  async snapshot(filepath) {
    if (!filepath)
      throw new Error("The 'path' parameter is required for heap snapshots.");

    try {
      const snapshotStream = v8.getHeapSnapshot();
      const fileStream = fs.createWriteStream(filepath);
      snapshotStream.pipe(fileStream);

      return new Promise((resolve, reject) => {
        fileStream.on("finish", () =>
          resolve(`Heap snapshot written to ${filepath}`),
        );
        fileStream.on("error", reject);
      });
    } catch (e) {
      return `ERR: Snapshot failed: ${e.message}`;
    }
  }
}