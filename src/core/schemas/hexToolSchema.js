export const hexToolSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['inspect', 'extract', 'search', 'detect', 'convert'],
      description: 'The action to perform with the binary tool'
    },
    filePath: {
      type: 'string',
      description: 'Path to the binary file'
    },
    offset: {
      type: 'number',
      description: 'The starting offset for inspection or extraction'
    },
    length: {
      type: 'number',
      description: 'The number of bytes to read or extract'
    },
    end: {
      type: 'number',
      description: 'The end offset for extraction'
    },
    outputFile: {
      type: 'string',
      description: 'The destination path for extracted chunks'
    },
    pattern: {
      type: 'string',
      description: 'The hex pattern to search for (e.g., "50 4B 03 04")'
    },
    hexString: {
      type: 'string',
      description: 'The hex string to convert to a data type'
    },
    type: {
      type: 'string',
      enum: ['Int8', 'UInt8', 'Int16', 'UInt16', 'Int32', 'UInt32', 'Float32', 'Float64'],
      description: 'The data type for conversion'
    },
    endianness: {
      type: 'string',
      enum: ['LE', 'BE'],
      default: 'LE',
      description: 'Endianness for multi-byte conversion (LE = Little Endian, BE = Big Endian)'
    }
  },
  required: ['action'],
  dependencies: {
    inspect: ['filePath'],
    extract: ['filePath', 'outputFile'],
    search: ['filePath', 'pattern'],
    detect: ['filePath'],
    convert: ['hexString', 'type']
  }
};