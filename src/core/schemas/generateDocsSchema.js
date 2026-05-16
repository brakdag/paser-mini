import { z } from "zod";

const generateDocsSchema = z.object({
  path: z.string().optional().default("."),
  outputDir: z.string().optional().default("docs/api"),
});


export default generateDocsSchema;
