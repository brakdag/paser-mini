import { z } from "zod";

const jszipListContentsSchema = z.object({
  filePath: z.string(),
}).strict();

export default jszipListContentsSchema;