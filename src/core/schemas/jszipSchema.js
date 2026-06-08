import { z } from "zod";

export const jszipSchema = z.object({
  filePath: z.string(),
}).strict();

export default jszipSchema;