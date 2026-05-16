import { z } from "zod";

const listZipFilesSchema = z.object({
  zipId: z.string().describe("The ID of the loaded ZIP container"),
});


export default listZipFilesSchema;
