import fs from "fs/promises";
import PathValidator from "../utils/pathValidator.js";

const SEARCH_BLOCK_SIZE = 64 * 1024;
const MAX_PATTERN_BYTES = 1024 * 1024;
const MAX_SEARCH_RESULTS = 10_000;
const MAX_INSPECT_BYTES = 64 * 1024;
const MAX_EXTRACT_BYTES = 10 * 1024 * 1024;
const MAX_CONVERT_BYTES = 8;

/**
 * Parse hex strictly; Buffer.from(hex) silently accepts malformed suffixes.
 * @param {string} value Hexadecimal input.
 * @param {string} label Input name.
 * @param {number} maxBytes Maximum decoded size.
 * @returns {Buffer} Decoded bytes.
 */
function parseHex(value, label, maxBytes) {
  if (typeof value !== "string") throw new Error(`${label  } must be a hexadecimal string`);
  const compact = value.replace(/\s+/g, "");
  if (compact.length === 0 || compact.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(compact)) {
    throw new Error(`${label  } must contain a non-empty, even-length hexadecimal string`);
  }
  if (compact.length / 2 > maxBytes) throw new Error(`${label  } exceeds the ${  maxBytes  }-byte limit`);
  return Buffer.from(compact, "hex");
}

/**
 * Validate an integer offset or length.
 * @param {number} value - Numeric value.
 * @param {string} label - Name used in the error.
 * @param {boolean} [allowZero] - Whether zero is accepted.
 */
function assertRangeNumber(value, label, allowZero = true) {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${label  } must be a ${  allowZero ? "non-negative" : "positive"  } safe integer`);
  }
}

/**
 * Binary data manipulation tools.
 */
class BinaryTools {
  #MAGIC_NUMBERS = {
    ZIP: "504b0304", PDF: "25504446", PNG: "89504e470d0a1a0a", JPEG: "ffd8ff",
    GIF: "47494638", "EXE/DLL": "4d5a", "7z": "377abfb5271c",
    RAR: "52617221a700", SQLite: "53514c69746520666f726d61742033", ELF: "7f454c46",
  };

  /**
   * Inspect at most 64 KiB and render only bytes actually read.
   * @param {string} filePath Safe absolute path.
   * @param {number} offset Start offset.
   * @param {number} length Maximum bytes to inspect.
   * @returns {Promise<string>} Hex dump output.
   */
  async #inspectBinary(filePath, offset, length) {
    assertRangeNumber(offset, "offset");
    assertRangeNumber(length, "length", false);
    if (length > MAX_INSPECT_BYTES) throw new Error(`length exceeds the ${  MAX_INSPECT_BYTES  }-byte inspection limit`);
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(Math.min(length, MAX_INSPECT_BYTES));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      let output = "Offset    | Hex                                           | ASCII\n";
      output += "--------------------------------------------------------------------------\n";
      for (let i = 0; i < bytesRead; i += 16) {
        const chunk = buffer.subarray(i, Math.min(i + 16, bytesRead));
        const hex = chunk.toString("hex").match(/.{1,2}/g)?.join(" ") || "";
        const ascii = Array.from(chunk, (byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".")).join("");
        const currentOffset = (offset + i).toString(16).padStart(8, "0");
        output += `${currentOffset  } | ${  hex.padEnd(47)  } | ${  ascii  }\n`;
      }
      return output;
    } finally {
      await handle.close();
    }
  }

  /**
   * Extract an exact range and write it under the project root.
   * @param {string} filePath Safe absolute source path.
   * @param {number} start Start offset.
   * @param {number|undefined} end Exclusive end offset.
   * @param {number} length Number of bytes when end is omitted.
   * @param {string} outputFile Safe absolute destination path.
   * @returns {Promise<string>} Confirmation message.
   */
  async #extractBinary(filePath, start, end, length, outputFile) {
    assertRangeNumber(start, "start");
    assertRangeNumber(length, "length", false);
    if (end !== undefined) assertRangeNumber(end, "end", false);
    const readLength = end !== undefined ? end - start : length;
    if (!Number.isSafeInteger(readLength) || readLength <= 0) throw new Error("Invalid extraction range");
    if (readLength > MAX_EXTRACT_BYTES) throw new Error(`Extraction exceeds the ${  MAX_EXTRACT_BYTES  }-byte limit`);
    const handle = await fs.open(filePath, "r");
    try {
      const stats = await handle.stat();
      if (start > stats.size || readLength > stats.size - start) throw new Error("Extraction range extends beyond end of file");
      const buffer = Buffer.alloc(readLength);
      const { bytesRead } = await handle.read(buffer, 0, readLength, start);
      if (bytesRead !== readLength) throw new Error("File changed while extracting; incomplete range was not written");
      await fs.writeFile(outputFile, buffer);
      return `Extracted ${  bytesRead  } bytes to ${  outputFile}`;
    } finally {
      await handle.close();
    }
  }

  /**
   * Search a finite file in fixed-size chunks with bounded overlap.
   * @param {string} filePath Safe absolute path.
   * @param {string} pattern Hexadecimal pattern.
   * @returns {Promise<{offsets: number[], count: number, truncated?: boolean}>} Search results.
   */
  async #searchBinary(filePath, pattern) {
    const searchBuf = parseHex(pattern, "pattern", MAX_PATTERN_BYTES);
    const offsets = [];
    let truncated = false;
    const handle = await fs.open(filePath, "r");
    try {
      const initialSize = (await handle.stat()).size;
      const chunk = Buffer.alloc(SEARCH_BLOCK_SIZE);
      let fileOffset = 0;
      let carry = Buffer.alloc(0);
      while (fileOffset < initialSize) {
        const requestedBytes = Math.min(chunk.length, initialSize - fileOffset);
        const { bytesRead } = await handle.read(chunk, 0, requestedBytes, fileOffset);
        if (bytesRead === 0) break;
        const current = chunk.subarray(0, bytesRead);
        const combined = carry.length === 0 ? current : Buffer.concat([carry, current]);
        const combinedOffset = fileOffset - carry.length;
        let index = combined.indexOf(searchBuf);
        while (index !== -1) {
          if (offsets.length < MAX_SEARCH_RESULTS) offsets.push(combinedOffset + index);
          else truncated = true;
          index = combined.indexOf(searchBuf, index + 1);
        }
        const overlapLength = Math.min(searchBuf.length - 1, combined.length);
        carry = overlapLength === 0 ? Buffer.alloc(0) : Buffer.from(combined.subarray(combined.length - overlapLength));
        fileOffset += bytesRead;
      }
    } finally {
      await handle.close();
    }
    return truncated ? { offsets, count: offsets.length, truncated } : { offsets, count: offsets.length };
  }

  /**
   * Detect binary file type using only bytes actually read.
   * @param {string} filePath Safe absolute path.
   * @returns {Promise<{type: string, signature: string|null}>} Detection result.
   */
  async #detectBinary(filePath) {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(32);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const fileHex = buffer.subarray(0, bytesRead).toString("hex");
      const found = Object.entries(this.#MAGIC_NUMBERS).find(([, signature]) => fileHex.startsWith(signature));
      return found ? { type: found[0], signature: found[1] } : { type: "Unknown", signature: null };
    } finally {
      await handle.close();
    }
  }

  /**
   * Convert hex to a numeric value.
   * @param {string} hexString Hex string.
   * @param {string} type Data type.
   * @param {string} endianness Endianness (LE/BE).
   * @returns {number} Converted value.
   */
  #convertBinary(hexString, type, endianness) {
    const buf = parseHex(hexString, "hexString", MAX_CONVERT_BYTES);
    if (endianness !== "LE" && endianness !== "BE") throw new Error("endianness must be LE or BE");
    const sizes = { Int8: 1, UInt8: 1, Int16: 2, UInt16: 2, Int32: 4, UInt32: 4, Float32: 4, Float64: 8 };
    if (!Object.hasOwn(sizes, type)) throw new Error(`Unsupported type: ${  type}`);
    if (buf.length !== sizes[type]) throw new Error(`${type  } requires exactly ${  sizes[type]  } byte(s)`);
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
      default: throw new Error(`Unsupported type: ${  type}`);
    }
  }

  /**
   * Handle hex commands. Positional signature retained for registry compatibility.
   * @param {string} action Action (inspect, extract, search, detect, convert).
   * @param {string} filePath Binary file path.
   * @param {number} [offset] Start offset.
   * @param {number} [length] Number of bytes.
   * @param {number} [end] Exclusive end offset for extraction.
   * @param {string} [endianness] Endianness (LE or BE).
   * @param {object} [options] Additional options (outputFile, pattern, hexString, type).
   * @returns {Promise<unknown>} Command result.
   */
  async handleHexCommand(action, filePath, offset = 0, length = 256, end = undefined, endianness = "LE", options = {}) {
    const params = { action, filePath, offset, length, end, endianness, ...options };
    if (action === "convert") return this.#executeHexCommand(params);
    if (!["inspect", "extract", "search", "detect"].includes(action)) {
      throw new Error(`Unsupported action: ${  action}`);
    }
    const safeInput = PathValidator.getSafePath(filePath);
    const safeOutput = action === "extract" ? PathValidator.getSafePath(params.outputFile) : undefined;
    return this.#executeHexCommand({ ...params, filePath: safeInput, outputFile: safeOutput });
  }

  /**
   * Internal executor for binary commands.
   * @param {object} params - Command parameters.
   * @param {string} params.action - Action name.
   * @param {string} [params.filePath] - Safe binary path.
   * @param {number} [params.offset] - Start offset.
   * @param {number} [params.length] - Byte length.
   * @param {number} [params.end] - Exclusive end offset.
   * @param {string} [params.endianness] - Byte order.
   * @param {string} [params.outputFile] - Safe output path.
   * @param {string} [params.pattern] - Search pattern.
   * @param {string} [params.hexString] - Conversion input.
   * @param {string} [params.type] - Conversion type.
   * @returns {Promise<unknown>} Command result.
   */
  async #executeHexCommand({ action, filePath, offset, length, end, endianness, outputFile, pattern, hexString, type }) {
    switch (action) {
      case "inspect": return this.#inspectBinary(filePath, offset, length);
      case "extract": return this.#extractBinary(filePath, offset, end, length, outputFile);
      case "search": return this.#searchBinary(filePath, pattern);
      case "detect": return this.#detectBinary(filePath);
      case "convert": return this.#convertBinary(hexString, type, endianness);
      default: throw new Error(`Unsupported action: ${  action}`);
    }
  }
}

export default BinaryTools;
