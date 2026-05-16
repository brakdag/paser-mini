import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "log", "memento.log");

export class MementoManager {
  async pushMemory(role, scope, value, key = null) {
    // 1. Handle Rank Increments for references
    this._incrementReferencedRanks(value);

    // 2. Prepare new entry
    const entries = this._readAll();
    const nextId = entries.length + 1;
    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    const category = scope || "general";
    const keyTag = key ? ` [Key: ${key}]` : "";

    const entry = `[ID: ${nextId}] [${timestamp}] [Rank: 0] <${category}>${keyTag} ${value}\n`;

    fs.appendFileSync(LOG_FILE, entry, "utf8");
    return `Memory stored in memento.log as entry #${nextId}. Referenced ranks updated.`;
  }

  async pullMemory(scope, key, direction = "next") {
    if (!fs.existsSync(LOG_FILE)) return "ERR: Memory log not found.";

    const content = fs.readFileSync(LOG_FILE, "utf8");
    const lines = content.split("\n").filter(Boolean);

    // Filter by scope and key
    const matches = lines.filter((line) => {
      const scopeMatch = scope ? line.includes(`<${scope}>`) : true;
      const keyMatch = key ? line.includes(`[Key: ${key}]`) : true;
      return scopeMatch && keyMatch;
    });

    if (matches.length === 0) return "No matching memories found.";

    // Simple direction logic: return the last match for 'next' (most recent)
    return direction === "next" ? matches[matches.length - 1] : matches[0];
  }

  _incrementReferencedRanks(text) {
    if (!fs.existsSync(LOG_FILE)) return;

    const refPattern = /#(\d+)/g;
    const matches = [...text.matchAll(refPattern)];
    if (matches.length === 0) return;

    const referencedIds = matches.map((m) => m[1]);
    const content = fs.readFileSync(LOG_FILE, "utf8");
    let modified = false;

    const lines = content.split("\n");
    const updatedLines = lines.map((line) => {
      if (!line) return line;

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
      fs.writeFileSync(LOG_FILE, updatedLines.join("\n"), "utf8");
    }
  }

  _readAll() {
    if (!fs.existsSync(LOG_FILE)) return [];
    return fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
  }
}
