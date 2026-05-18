import { z } from "zod";

const hexToolSchema = z
  .object({
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
    endianness: z.enum(["LE", "BE"]).default("LE").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'inspect' && !data.filePath) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "filePath is required for inspect action", path: ['filePath'] });
    }
    if (data.action === 'extract' && (!data.filePath || !data.outputFile)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "filePath and outputFile are required for extract action", path: ['filePath', 'outputFile'] });
    }
    if (data.action === 'search' && (!data.filePath || !data.pattern)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "filePath and pattern are required for search action", path: ['filePath', 'pattern'] });
    }
    if (data.action === 'detect' && !data.filePath) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "filePath is required for detect action", path: ['filePath'] });
    }
    if (data.action === 'convert' && (!data.hexString || !data.type)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "hexString and type are required for convert action", path: ['hexString', 'type'] });
    }
  });


export default hexToolSchema;