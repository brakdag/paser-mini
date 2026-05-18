import { z } from "zod";

const lintCodeSchema = z.object({
  path: z.string().optional().default("."),
});


export default lintCodeSchema;
