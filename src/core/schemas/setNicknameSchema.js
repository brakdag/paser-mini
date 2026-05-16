import { z } from "zod";

const setNicknameSchema = z
  .object({
    newNickname: z.string().min(1).max(32),
  })
  .strict();


export default setNicknameSchema;
