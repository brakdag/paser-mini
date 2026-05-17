import fs from "fs";

class SessionLogger {
  writeToLog(text) {
    try {
      fs.appendFileSync("log/session.log", `${text}\n`, "utf8");
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }
}

export default new SessionLogger();