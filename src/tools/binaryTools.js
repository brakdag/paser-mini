import fs from "fs/promises";

const MAGIC_NUMBERS = {
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

async function inspectBinary(filePath, offset, length) {
  const handle = await fs.open(filePath, "r");
  const buffer = Buffer.alloc(length);
  await handle.read(buffer, 0, length, offset);
  await handle.close();

  let output =
    "Offset    | Hex                                           | ASCII\n";
  output +=
    "--------------------------------------------------------------------------\n";

  for (let i = 0; i < buffer.length; i += 16) {
    const chunk = buffer.slice(i, i + 16);
    const hex =
      chunk
        .toString("hex")
        .match(/.{1,2}/g)
        ?.join(" ") || "";
    const ascii = chunk.toString("utf8").replace(/[^\x20-\x7E]/g, ".");
    const currentOffset = (offset + i).toString(16).padStart(8, "0");
    output += `${currentOffset} | ${hex.padEnd(47)} | ${ascii}\n`;
  }

  return { success: true, data: output };
}

async function extractBinary(filePath, start, end, length, outputFile) {
  const handle = await fs.open(filePath, "r");
  const readLength = end !== undefined ? end - start : length || 0;

  if (readLength <= 0) {
    await handle.close();
    throw new Error("Invalid extraction range");
  }

  const buffer = Buffer.alloc(readLength);
  await handle.read(buffer, 0, readLength, start);
  await handle.close();

  await fs.writeFile(outputFile, buffer);
  return {
    success: true,
    message: `Extracted ${readLength} bytes to ${outputFile}`,
  };
}

async function searchBinary(filePath, pattern) {
  const searchBuf = Buffer.from(pattern.replace(/\s+/g, ""), "hex");
  const buffer = await fs.readFile(filePath);
  const offsets = [];

  let index = buffer.indexOf(searchBuf);
  while (index !== -1) {
    offsets.push(index);
    index = buffer.indexOf(searchBuf, index + 1);
  }

  return { success: true, data: { offsets, count: offsets.length } };
}

async function detectBinary(filePath) {
  const handle = await fs.open(filePath, "r");
  const buffer = Buffer.alloc(32);
  await handle.read(buffer, 0, 32, 0);
  await handle.close();

  const fileHex = buffer.toString("hex");
  const entries = Object.entries(MAGIC_NUMBERS);
  for (let i = 0; i < entries.length; i += 1) {
    const [type, signature] = entries[i];
    if (fileHex.startsWith(signature)) {
      return { success: true, data: { type, signature } };
    }
  }

  return { success: true, data: { type: "Unknown", signature: null } };
}

function convertBinary(hexString, type, endianness) {
  const buf = Buffer.from(hexString.replace(/\s+/g, ""), "hex");
  const isLE = endianness === "LE";

  switch (type) {
    case "Int8":
      return { success: true, value: buf.readInt8() };
    case "UInt8":
      return { success: true, value: buf.readUInt8() };
    case "Int16":
      return {
        success: true,
        value: isLE ? buf.readInt16LE() : buf.readInt16BE(),
      };
    case "UInt16":
      return {
        success: true,
        value: isLE ? buf.readUInt16LE() : buf.readUInt16BE(),
      };
    case "Int32":
      return {
        success: true,
        value: isLE ? buf.readInt32LE() : buf.readInt32BE(),
      };
    case "UInt32":
      return {
        success: true,
        value: isLE ? buf.readUInt32LE() : buf.readUInt32BE(),
      };
    case "Float32":
      return {
        success: true,
        value: isLE ? buf.readFloatLE() : buf.readFloatBE(),
      };
    case "Float64":
      return {
        success: true,
        value: isLE ? buf.readDoubleLE() : buf.readDoubleBE(),
      };
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

async function handleHexCommand(args) {
  const {
    action,
    filePath,
    offset = 0,
    length = 256,
    end,
    outputFile,
    pattern,
    hexString,
    type,
    endianness = "LE",
  } = args;

  try {
    switch (action) {
      case "inspect":
        return await inspectBinary(filePath, offset, length);
      case "extract":
        return await extractBinary(filePath, offset, end, length, outputFile);
      case "search":
        return await searchBinary(filePath, pattern);
      case "detect":
        return await detectBinary(filePath);
      case "convert":
        return convertBinary(hexString, type, endianness);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  handleHexCommand,
};
