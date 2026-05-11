import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logFile = path.join(process.cwd(), 'paser_mini.log');
    this.sessionFile = path.join(process.cwd(), 'session.log');
    this.agentNickname = null;
    // Clear the logs when starting the application
    fs.writeFileSync(this.logFile, `--- Session Started: ${new Date().toISOString()} ---\n`);
    fs.writeFileSync(this.sessionFile, `--- Session Started: ${new Date().toISOString()} ---\n`);
  }

  _log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    
    const targetFile = level === 'THOUGHT' ? this.sessionFile : this.logFile;
    if (level === 'THOUGHT' && targetFile === this.sessionFile) {
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const nick = this.agentNickname || 'agent';
      const logEntry = `[${time}] <${nick}> * thought: ${message}\n`;
      fs.appendFileSync(targetFile, logEntry, 'utf8');
      return;
    }
    fs.appendFileSync(targetFile, logEntry, 'utf8');
  }

  setAgentNickname(nick) { this.agentNickname = nick; }

  info(msg, data) { this._log('INFO', msg, data); }
  warn(msg, data) { this._log('WARN', msg, data); }
  error(msg, data) { this._log('ERROR', msg, data); }

  sessionLog(msg) { this._log('THOUGHT', msg); }
  debug(msg, data) { this._log('DEBUG', msg, data); }
}

export const logger = new Logger();