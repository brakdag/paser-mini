import fs from "fs/promises";

/**
 * Binary data manipulation tools.
 */
class BinaryTools {
  #MAGIC_NUMBERS = {
    ZIP: "504b0304",
    PDF: "25504446",
    PNG: "89504e470d0a1a0a",
    JPEG: "ffd8ff",
    GIF: "47494638",
    "EXE/DLL": "4d5a",
    "7z": "377abfb5271c",
    RAR: "52617221a700",
    SQLite: "53514c69746520666f726d61742033",
    ELF: "7f454c46",
  };

  /**
   * Inspect binary file.
   * @param {string} filePath Path to file.
   * @param {number} offset Start offset.
   * @param {number} length Bytes to read.
   * @returns {Promise<string>} Hex dump output.
   */
  async #inspectBinary(filePath, offset, length) {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, offset);

      let output = "Offset    | Hex                                           | ASCII\n";
      output += "--------------------------------------------------------------------------\n";

      for (let i = 0; i < buffer.length; i += 16) {
        const chunk = buffer.subarray(i, i + 16);
        const hex = chunk.toString("hex").match(/.{1,2}/g)?.join(" ") || "";
        const ascii = chunk.toString("utf8").replace(/[\u0020-\u007E]/g, ".");
        const currentOffset = (offset + i).toString(16).padStart(8, "0");
        output += `${currentOffset} | ${hex.padEnd(47)} | ${ascii}\n`;
      }
      return output;
    } finally {
      await handle.close();
    }
  }

  /**
   * Extract binary range.
   * @param {string} filePath Path to file.
   * @param {number} start Start offset.
   * @param {number} end End offset.
   * @param {number} length Length to extract.
   * @param {string} outputFile Output path.
   * @returns {Promise<string>} Confirmation message.
   */
  async #extractBinary(filePath, start, end, length, outputFile) {
    const handle = await fs.open(filePath, "r");
    try {
      const readLength = end !== undefined ? end - start : length || 0;
      if (readLength <= 0) {
        throw new Error("Invalid extraction range");
      }
      const buffer = Buffer.alloc(readLength);
      await handle.read(buffer, 0, readLength, start);
      await fs.writeFile(outputFile, buffer);
      return `Extracted ${readLength} bytes to ${outputFile}`;
    } finally {
      await handle.close();
    }
  }

  /**
   * Search binary pattern using chunked reading to avoid memory overflow.
   * @param {string} filePath Path to file.
   * @param {string} pattern Hex pattern.
   * @returns {Promise<{offsets: number[], count: number}>} Search results.
   */
  async #searchBinary(filePath, pattern) {
    const searchBuf = Buffer.from(pattern.replace(/\s+/g, ""), "hex");
    const offsets = [];
    const handle = await fs.open(filePath, "r");
    
    try {
      const bufferSize = 64 * 1024;
      const buffer = Buffer.alloc(bufferSize);
      let totalOffset = 0;
      let bytesRead = 1;

      while (bytesRead > 0) {
        const readResult = await handle.read(buffer, 0, bufferSize, totalOffset);
        bytesRead = readResult.bytesRead;
        if (bytesRead <= 0) break;
        let index = buffer.indexOf(searchBuf, 0);
        while (index !== -1) {
          offsets.push(totalOffset + index);
          index = buffer.indexOf(searchBuf, index + 1);
        }
        totalOffset += bytesRead - (searchBuf.length > 0 ? searchBuf.length - 1 : 0);
      }
    } finally {
      await handle.close();
    }

    return { offsets, count: offsets.length };
  }

  /**
   * Detect binary file type.
   * @param {string} filePath Path to file.
   * @returns {Promise<{type: string, signature: string|null}>} Detection result.
   */
  async #detectBinary(filePath) {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(32);
      await handle.read(buffer, 0, 32, 0);
      const fileHex = buffer.toString("hex");
      const entries = Object.entries(this.#MAGIC_NUMBERS);
      for (let i = 0; i < entries.length; i += 1) {
        const [type, signature] = entries[i];
        if (fileHex.startsWith(signature)) return { type, signature };
      }
      return { type: "Unknown", signature: null };
    } finally {
      await handle.close();
    }
  }

  /**
   * Convert hex to value.
   * @param {string} hexString Hex string.
   * @param {string} type Data type.
   * @param {string} endianness Endianness (LE/BE).
   * @returns {number} Converted value.
   */
  #convertBinary(hexString, type, endianness) {
    const buf = Buffer.from(hexString.replace(/\s+/g, ""), "hex");
    const isLE = endianness === "LE";
    switch (type) {
      case "Int8": return buf.readInt8();
      case "UInt8": return buf.readUInt8();
      case "Int16": return isLE ? buf.readInt16LE() : buf.readInt16BE();
      case "UInt16": return isLE ? buf.readUInt16LE() : buf.readUInt16BE();
      case "Int32": return isLE ? buf.readInt32LE() : buf.readInt32BE();
      case "UInt32": return isLE ? buf.readUInt32LE() : buf.readUInt32BE();
      case "Float32": return isLE ? buf.readFloatLE() : buf.readFloatBE();
      case "Float64": return isLE ? buf.readDoubleLE() : buf.readDoubleBE();
      default: throw new Error(`Unsupported type: ${type}`);
    }
  }

  /**
   * Handle hex commands.
   * @param {string} action The action to perform (inspect, extract, search, detect, convert).
   * @param {string} filePath Path to the binary file.
   * @param {number} [offset] Start offset for reading.
   * @param {number} [length] Number of bytes to read.
   * @param {number} [end] End offset for extraction.
   * @param {string} [endianness] Endianness (LE or BE).
   * @param {object} [options] Additional options (outputFile, pattern, hexString, type).
   * @returns {Promise<unknown>} Command result.
   */
  async handleHexCommand(action, filePath, offset = 0, length = 256, end = undefined, endianness = "LE", options = {}) {
    return this.#executeHexCommand({ action, filePath, offset, length, end, endianness, ...options });
  }

  async #executeHexCommand({ action, filePath, offset, length, end, endianness, outputFile, pattern, hexString, type }) {
    switch (action) {
      case "inspect": return this.#inspectBinary(filePath, offset, length);
      case "extract": return this.#extractBinary(filePath, offset, end, length, outputFile);
      case "search": return this.#searchBinary(filePath, pattern);
      case "detect": return this.#detectBinary(filePath);
      case "convert": return this.#convertBinary(hexString, type, endianness);
      default: throw new Error(`Unsupported action: ${action}`);
    }
  }
}

export default BinaryTools;