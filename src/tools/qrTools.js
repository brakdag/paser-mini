import QRCode from "qrcode";

const QR_DISPLAY_TYPE = "QR_DISPLAY";

/**
 * Tools for generating Quick Response (QR) codes directly in the terminal using native Node libraries.
 * Uses Unicode half-block characters to compress vertical footprint by 50%.
 */
export default class QrTools {
  /**
   * Maps a pair of vertical modules to the appropriate Unicode half-block character.
   * @param {boolean} top - Whether the top module is dark.
   * @param {boolean} bottom - Whether the bottom module is dark.
   * @returns {string} The Unicode character representing the pair.
   * @private
   */
  #getHalfBlock(top, bottom) {
    if (top && bottom) return "█";
    if (top) return "▀";
    if (bottom) return "▄";
    return " ";
  }

  /**
   * Generates a QR code from a given string using the native 'qrcode' library.
   * @param {string} text - The text or URL to encode into the QR code.
   * @returns {Promise<{type: string, content: string}>} An object containing the special type and the QR code string.
   * @throws {Error} If the encoding process fails.
   */
  async generateQr(text) {
    if (!text) {
      throw new Error("Text payload is required to generate a QR code.");
    }

    try {
      const qrMatrix = QRCode.create(text).modules;
      const { size } = qrMatrix;
      const rows = [];

      for (let r = 0; r < size; r += 2) {
        let row = "";
        for (let c = 0; c < size; c += 1) {
          const top = qrMatrix.get(c, r);
          const bottom = r + 1 < size ? qrMatrix.get(c, r + 1) : false;
          const block = this.#getHalfBlock(top, bottom);
          // Double width to maintain 1:1 aspect ratio (each char is ~2x tall)
          row += block + block;
        }
        rows.push(row);
      }

      const qrText = rows.join("\n");
      const content = `${text}\n\n${qrText}\n`;
      return { type: QR_DISPLAY_TYPE, content };
    } catch (e) {
      throw new Error(`QR generation failed: ${e.message}`);
    }
  }
}

