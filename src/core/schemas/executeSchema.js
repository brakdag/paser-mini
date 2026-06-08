import { z } from "zod";

export const executeSchema = z.object({
  command: z.string(),
});

export default executeSchema;