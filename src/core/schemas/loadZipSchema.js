import { z } from "zod";

const loadZipSchema = z.object({
  filePath: z.string().describe("The path to the ZIP file to load into RAM"),
});


export default loadZipSchema;
