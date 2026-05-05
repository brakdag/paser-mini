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
    
    // Escritura sincrónica para asegurar que el log se guarde incluso en un crash
    fs.appendFileSync(this.logFile, logEntry, 'utf8');
  }

  info(msg, data) { this._log('INFO', msg, data); }
  warn(msg, data) { this._log('WARN', msg, data); }
  error(msg, data) { this._log('ERROR', msg, data); }
  debug(msg, data) { this._log('DEBUG', msg, data); }
}

export const logger = new Logger();