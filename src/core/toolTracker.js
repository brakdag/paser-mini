class ToolAttemptTracker {
  constructor() {
    this.attempts = new Map();
    this.maxAttempts = 10; // Límite por defecto para evitar bucles
  }

  /**
   * Registra un intento de llamada a una herramienta
   * @param {string} name
   * @param {any} args
   * @returns {boolean} true if the attempt is allowed, false if a loop is detected
   */
  recordAttempt(name, args) {
    const argKey = JSON.stringify(args);
    const key = `${name}:${argKey}`;

    const count = (this.attempts.get(key) || 0) + 1;
    this.attempts.set(key, count);

    return count <= this.maxAttempts;
  }

  /**
   * Registra que una herramienta se ejecutó con éxito
   * @param {string} name
   */
  recordSuccess(_name) {
    // Podríamos limpiar intentos fallidos aquí si fuera necesario
  }

  /**
   * Registra que una herramienta falló
   * @param {string} _name
   */
  recordFailure(_name) {
    // Registro de fallos para análisis
  }

  reset() {
    this.attempts.clear();
  }
}


export default ToolAttemptTracker;
