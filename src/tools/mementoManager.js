import fs from "fs/promises";
import path from "path";

/**
 * Manages the memento log file, handling memory storage and rank tracking.
 */
class MementoManager {
  #LOG_FILE;

  /**
   * Initializes a new instance of the MementoManager.
   */
  constructor() {
    this.#LOG_FILE = path.join(process.cwd(), "log", "memento.log");
  }

  /**
   * Store memory in log.
   * @param {string} role Role of the agent.
   * @param {string} scope Scope of the memory.
   * @param {string} value The memory content.
   * @param {string|null} key Optional key for the memory.
   * @returns {Promise<string>} Confirmation message.
   * @throws {Error} If the memory cannot be stored.
   */
  async pushMemory(role, scope, value, key = null) {
    await this.#incrementReferencedRanks(value);

    const entries = await this.#readAll();
    const nextId = entries.length + 1;
    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    const category = scope || "general";
    const keyTag = key ? ` [Key: ${key}]` : "";

    const entry = `[ID: ${nextId}] [${timestamp}] [Rank: 0] <${category}>${keyTag} ${value}\n`;

    await fs.appendFile(this.#LOG_FILE, entry, "utf8");
    return `Memory stored in memento.log as entry #${nextId}. Referenced ranks updated.`;
  }

  /**
   * Increment ranks of referenced memories based on the provided text.
   * @param {string} text Text to scan for memory references (e.g., #12).
   * @returns {Promise<void>}
   */
  async #incrementReferencedRanks(text) {
    try {
      await fs.access(this.#LOG_FILE);
    } catch (error) {
      // Log file does not exist yet, no ranks to increment
      return;
    }

    const refPattern = /#(\d+)/g;
    const matches = [...text.matchAll(refPattern)];
    if (matches.length === 0) {
      return;
    }

    const referencedIds = matches.map((m) => m[1]);
    const content = await fs.readFile(this.#LOG_FILE, "utf8");
    let modified = false;

    const lines = content.split("\n");
    const updatedLines = lines.map((line) => {
      if (!line) {
        return line;
      }

      const idMatch = line.match(/^\[ID: (\d+)\]/);
      if (idMatch && referencedIds.includes(idMatch[1])) {
        modified = true;
        return line.replace(/(\[Rank: )(\d+)(\])/, (match, p1, p2, p3) => {
          const newRank = parseInt(p2, 10) + 1;
          return `${p1}${newRank}${p3}`;
        });
      }
      return line;
    });

    if (modified) {
      await fs.writeFile(this.#LOG_FILE, updatedLines.join("\n"), "utf8");
    }
  }

  /**
   * Read all entries from the memento log.
   * @returns {Promise<string[]>} Array of memory entries.
   */
  async #readAll() {
    try {
      const content = await fs.readFile(this.#LOG_FILE, "utf8");
      return content.trim().split("\n").filter(Boolean);
    } catch (error) {
      return [];
    }
  }
}

export default MementoManager;