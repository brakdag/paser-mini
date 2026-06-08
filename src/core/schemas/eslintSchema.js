import { z } from "zod";

export const eslintSchema = z.object({
  path: z.string().optional().default("."),
});

export default eslintSchema;