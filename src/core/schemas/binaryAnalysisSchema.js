import { z } from "zod";

export const binaryAnalysisSchema = z.object({
  action: z.enum(["inspect", "extract", "search", "detect", "convert"]),
  filePath: z.string().optional(),
  offset: z.number().optional(),
  length: z.number().optional(),
  end: z.number().optional(),
  outputFile: z.string().optional(),
  pattern: z.string().optional(),
  hexString: z.string().optional(),
  type: z
    .enum([
      "Int8",
      "UInt8",
      "Int16",
      "UInt16",
      "Int32",
      "UInt32",
      "Float32",
      "Float64",
    ])
    .optional(),
  endianness: z.enum(["LE", "BE"]).optional(),
});
