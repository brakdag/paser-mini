import { z } from "zod";

export const docSchema = z.object({
  path: z.string().optional().default("."),
  outputDir: z.string().optional().default("docs/api"),
});

export default docSchema;