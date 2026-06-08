import { z } from "zod";

export const nicknameSchema = z
  .object({
    newNickname: z.string().min(1).max(32),
  })
  .strict();

export default nicknameSchema;