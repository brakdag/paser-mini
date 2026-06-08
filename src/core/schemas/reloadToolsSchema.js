import { z } from "zod";

export const reloadToolsSchema = z
  .object({})
  .strict();

export default reloadToolsSchema;