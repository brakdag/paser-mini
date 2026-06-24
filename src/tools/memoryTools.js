`import fs from "fs";
import path from "path";

class MementoManager {
  constructor() {
    this.LOG_FILE = path.join(process.cwd(), "log", "memento.log");
  }

  async pushMemory(role, scope, value, key = null) {
    this._incrementReferencedRanks(value);

    const entries = this._readAll();
    const nextId = entries.length + 1;
    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    const category = scope || "general";
    const keyTag = key ? ` [Key: \${key}]` : "";

    const entry = `[ID: \${nextId}] [\${timestamp}] [Rank: 0] <\${category}>\${keyTag} \${value}\\n`;

    fs.appendFileSync(this.LOG_FILE, entry, "utf8");
    return `Memory stored in memento.log as entry #\${nextId}. Referenced ranks updated.`;
  }

  _incrementReferencedRanks(text) {
    if (!fs.existsSync(this.LOG_FILE)) return;

    const refPattern = /#(\d+)/g;
    const matches = [...text.matchAll(refPattern)];
    if (matches.length === 0) return;

    const referencedIds = matches.map((m) => m[1]);
    const content = fs.readFileSync(this.LOG_FILE, "utf8");
    let modified = false;

    const lines = content.split("\\n");
    const updatedLines = lines.map((line) => {
      if (!line) return line;

      const idMatch = line.match(/^\\[ID: (\\d+)\\]/);
      if (idMatch && referencedIds.includes(idMatch[1])) {
        modified = true;
        return line.replace(/(\\[Rank: )(\\d+)(\\])/, (match, p1, p2, p3) => {
          const newRank = parseInt(p2, 10) + 1;
          return `\${p1}\${newRank}\${p3}`;
        });
      }
      return line;
    });

    if (modified) {
      fs.writeFileSync(this.LOG_FILE, updatedLines.join("\\n"), "utf8");
    }
  }

  _readAll() {
    if (!fs.existsSync(this.LOG_FILE)) return [];
    return fs.readFileSync(this.LOG_FILE, "utf8").trim().split("\\n").filter(Boolean);
  }
}

export default class MemoryTools {
  #memento = new MementoManager();
  #currentAssistant = null;
  #currentChatManager = null;

  setMemoryContext(assistant, chatManager) {
    this.#currentAssistant = assistant;
    this.#currentChatManager = chatManager;
  }

  async pushMemory({ data }) {
    try {
      if (!data) {
        return "ERR: No value provided for memory.";
      }

      return await this.#memento.pushMemory(
        "agent",
        "general",
        String(data),
        null,
      );
    } catch (e) {
      return `ERR: \${e.message}`;
    }
  }

  async getTokenCount() {
    try {
      if (!this.#currentChatManager) {
        return "ERR: Memory context not initialized.";
      }

      return this.#currentChatManager.getTokenCount();
    } catch (e) {
      return `ERR: \${e.message}`;
    }
  }
}`