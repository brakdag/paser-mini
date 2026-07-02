/**
 * Detects cyclic repetitions in text by monitoring n-grams in a sliding window buffer.
 */
class RepetitionDetector {
  /**
   * Initializes the RepetitionDetector.
   * @param {number} [n] - The size of the n-gram to monitor for repetitions.
   * @param {number} [maxRepeats] - The maximum number of allowed repetitions before a cycle is detected.
   */
  constructor(n = 20, maxRepeats = 5) {
    this.n = n;
    this.maxRepeats = maxRepeats;
    this.buffer = [];
    this.maxBufferSize = n * maxRepeats * 2;
  }

  /**
   * Analyzes text for cyclic repetitions by tokenizing and updating the sliding window buffer.
   * @param {string} text - The text to analyze for repetitions.
   * @returns {string|boolean} The repeated sequence if a cycle is detected, otherwise true if the text is valid.
   */
  addText(text) {
    if (!text) return true;

    // Simple tokenization based on words
    const tokens = text.match(/\w+/g) || [];

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      this.buffer.push(token);
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift();
      }

      if (this.buffer.length >= this.n * 2) {
        // Extract current and previous n-grams
        const currentNgram = this.buffer.slice(-this.n).join(" ");
        const previousNgram = this.buffer.slice(-this.n * 2, -this.n).join(" ");

        if (currentNgram === previousNgram) {
          // Count how many times this n-gram appears in the current buffer
          let count = 0;
          for (let j = 0; j <= this.buffer.length - this.n; j += this.n) {
            const segment = this.buffer.slice(j, j + this.n).join(" ");
            if (segment === currentNgram) {
              count += 1;
            }
          }

          if (count >= this.maxRepeats) {
            return currentNgram;
          }
        }
      }
    }

    return true;
  }

  /**
   * Resets the token buffer to clear the repetition history.
   * @returns {void}
   */
  reset() {
    this.buffer = [];
  }
}

export default RepetitionDetector;