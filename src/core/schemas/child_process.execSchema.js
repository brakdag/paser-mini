import { z } from "zod";

const executeBashSchema = z.object({
  command: z.string(),
});


export default executeBashSchema;
