import { z } from 'zod';

export const setNicknameSchema = z.object({
  newNickname: z.string().min(1).max(32),
}).strict();