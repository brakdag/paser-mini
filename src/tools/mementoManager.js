import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), ".paser-mini", "log");

/**
 * Manages the memento log file, handling memory storage and rank tracking.
 */
class MementoManager {
  #LOG_FILE;

  /**
   * Initializes a new instance of the MementoManager.
   * @param {object} [options] - Construction options.
   * @param {string} [options.logDir] - Directory holding the memento log.
   *   Defaults to the project state directory. Tests pass a temporary
   *   directory so they never touch the user's real memory log.
   */
  constructor({ logDir = LOG_DIR } = {}) {
    if (!fsSync.existsSync(logDir)) {
      fsSync.mkdirSync(logDir, { recursive: true });
    }
    this.#LOG_FILE = path.join(logDir, "memento.log");
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

    const nextId = await this.#nextId();
    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    const category = scope || "general";
    const keyTag = key ? ` [Key: ${key}]` : "";

    // A newline inside the value would split one memory across several lines
    // and corrupt the record format. Newlines are stored as the two characters
    // backslash+n so each entry remains exactly one line. Literal backslashes
    // are escaped too, so unescaping is unambiguous.
    const escapedValue = String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n");

    const entry = `[ID: ${nextId}] [${timestamp}] [Rank: 0] <${category}>${keyTag} ${escapedValue}\n`;

    await fs.appendFile(this.#LOG_FILE, entry, "utf8");
    return `Memory stored in memento.log as entry #${nextId}. Referenced ranks updated.`;
  }

  /**
   * Determines the next free ID from existing records.
   *
   * Two distinct past defects are avoided here:
   *
   * 1. Counting lines was wrong: an entry whose value contained a newline
   *    spanned several lines and inflated the ID. The maximum is taken from the
   *    "[ID: n]" headers instead.
   * 2. `Math.max(...ids)` spread every record into function arguments, which
   *    throws once the log is large enough to exceed the argument limit. That
   *    throw was caught by the surrounding handler, which returned 1 and let a
   *    new entry reuse an existing ID. The maximum is accumulated iteratively.
   *
   * A genuinely absent log yields 1. Any other read or parse failure propagates
   * rather than being reported as an empty log, so a storage fault cannot
   * silently restart numbering.
   * @returns {Promise<number>} The next available identifier.
   * @throws {Error} If the log exists but cannot be read or parsed.
   */
  async #nextId() {
    let content;
    try {
      content = await fs.readFile(this.#LOG_FILE, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return 1;
      }
      throw error;
    }

    let highest = 0;
    let found = false;
    // Iterate matches one at a time: no array of all IDs is materialized.
    const idPattern = /^\[ID: (\d+)\]/gm;
    let match = idPattern.exec(content);
    while (match !== null) {
      const id = Number.parseInt(match[1], 10);
      if (Number.isNaN(id)) {
        throw new Error("Memento log contains a malformed ID header");
      }
      if (id > highest) {
        highest = id;
      }
      found = true;
      match = idPattern.exec(content);
    }

    return found ? highest + 1 : 1;
  }

  /**
   * Increment ranks of referenced memories based on the provided text.
   * @param {string} text Text to scan for memory references (e.g., #12).
   * @returns {Promise<void>}
   */
  async #incrementReferencedRanks(text) {
    try {
      await fs.access(this.#LOG_FILE);
    } catch {
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
}

export default MementoManager;
