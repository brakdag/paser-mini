import fs from "fs";

class SessionLogger {
  writeToLog(text) {
    try {
      fs.appendFileSync("log/session.log", `${text}\n`, "utf8");

      if (text.includes("-!-")) {
        fs.appendFileSync("log/history.log", `${text}\n`, "utf8");
      }
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }

  clearLog() {
    try {
      if (fs.existsSync("log/session.log")) {
        const content = fs.readFileSync("log/session.log", "utf8");
        if (content) {
          fs.appendFileSync("log/history.log", `${content}\n`, "utf8");
        }
      }
      fs.writeFileSync("log/session.log", "", "utf8");
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }
}

export default new SessionLogger();