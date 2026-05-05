export class ToolAttemptTracker {
  constructor() {
    this.attempts = new Map();
    this.maxAttempts = 10; // Límite por defecto para evitar bucles
  }

  /**
   * Registra un intento de llamada a una herramienta
   * @param {string} name 
   * @param {any} args 
   * @returns {boolean} True si el intento es permitido, False si se detecta un bucle
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
  recordSuccess(name) {
    // Podríamos limpiar intentos fallidos aquí si fuera necesario
  }

  /**
   * Registra que una herramienta falló
   * @param {string} name 
   */
  recordFailure(name) {
    // Registro de fallos para análisis
  }

  reset() {
    this.attempts.clear();
  }
}