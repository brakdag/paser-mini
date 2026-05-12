import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logFile = path.join(process.cwd(), 'log', 'paser_mini.log');
    this.sessionFile = path.join(process.cwd(), 'log', 'session.log');
    this.historyFile = path.join(process.cwd(), 'log', 'history.log');
    this.agentNickname = null;
    
    // Asegurar que el directorio log existe
    if (!fs.existsSync(path.join(process.cwd(), 'log'))) {
      fs.mkdirSync(path.join(process.cwd(), 'log'));
    }

    // Clear the logs when starting the application
    fs.writeFileSync(this.logFile, `--- Session Started: ${new Date().toISOString()} ---\n`);
    fs.writeFileSync(this.sessionFile, `--- Session Started: ${new Date().toISOString()} ---\n`);
    fs.writeFileSync(this.historyFile, `--- Session Started: ${new Date().toISOString()} ---\n`);
  }

  _log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const targetFile = level === 'THOUGHT' ? this.sessionFile : (level === 'HISTORY' ? this.historyFile : this.logFile);
    
    if (level === 'THOUGHT') {
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const nick = this.agentNickname || 'agent';
      const logEntry = `[${time}] <${nick}> * thought: ${message}\n`;
      fs.appendFileSync(targetFile, logEntry, 'utf8');
      return;
    }

    const logEntry = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    fs.appendFileSync(targetFile, logEntry, 'utf8');
  }

  setAgentNickname(nick) { this.agentNickname = nick; }

  info(msg, data) { this._log('INFO', msg, data); }
  warn(msg, data) { this._log('WARN', msg, data); }
  error(msg, data) { this._log('ERROR', msg, data); }

  sessionLog(msg) { this._log('THOUGHT', msg); }
  historyLog(msg) { this._log('HISTORY', msg); }
  debug(msg, data) { this._log('DEBUG', msg, data); }
}

export const logger = new Logger();