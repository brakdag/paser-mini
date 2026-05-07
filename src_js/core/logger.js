import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logFile = path.join(process.cwd(), 'paser_mini.log');
    // Limpiar el log al iniciar la aplicación
    fs.writeFileSync(this.logFile, `--- Session Started: ${new Date().toISOString()} ---\n`);
  }

  _log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    
    // Technical log
    fs.appendFileSync(this.logFile, logEntry, 'utf8');

    // Mirror to session log for non-debug events
    if (level !== 'DEBUG') {
      const sessionTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const sessionEntry = `[${sessionTime}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
      fs.appendFileSync('session.log', sessionEntry, 'utf8');
    }
  }

  info(msg, data) { this._log('INFO', msg, data); }
  warn(msg, data) { this._log('WARN', msg, data); }
  error(msg, data) { this._log('ERROR', msg, data); }
  debug(msg, data) { this._log('DEBUG', msg, data); }
}

export const logger = new Logger();