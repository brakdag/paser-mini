export class RepetitionDetector {
  constructor(n = 20, maxRepeats = 5) {
    this.n = n;
    this.maxRepeats = maxRepeats;
    this.buffer = [];
    this.maxBufferSize = n * maxRepeats * 2;
  }

  /**
   * Analiza el texto en busca de repeticiones cíclicas
   * @param {string} text 
   * @returns {string|boolean} Retorna la secuencia repetida si se detecta, o true si es válido
   */
  addText(text) {
    if (!text) return true;

    // Tokenización simple basada en palabras
    const tokens = text.match(/\w+/g) || [];

    for (const token of tokens) {
      this.buffer.push(token);
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift();
      }

      if (this.buffer.length < this.n * 2) continue;

      // Extraer el n-grama actual y el anterior
      const currentNgram = this.buffer.slice(-this.n).join(' ');
      const previousNgram = this.buffer.slice(-this.n * 2, -this.n).join(' ');

      if (currentNgram === previousNgram) {
        // Contar cuántas veces aparece este n-grama en el buffer actual
        let count = 0;
        for (let i = 0; i <= this.buffer.length - this.n; i += this.n) {
          const segment = this.buffer.slice(i, i + this.n).join(' ');
          if (segment === currentNgram) {
            count++;
          }
        }

        if (count >= this.maxRepeats) {
          return currentNgram;
        }
      }
    }

    return true;
  }

  reset() {
    this.buffer = [];
  }
}