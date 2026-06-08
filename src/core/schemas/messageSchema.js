import { z } from "zod";

export const messageSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  role: z.enum(["user", "agent", "system", "thought", "tool"]),
  nickname: z.string(),
  content: z.string(),
  metadata: z
    .object({
      tool_call: z
        .object({
          id: z.string(),
          name: z.string(),
          args: z.record(z.any()),
        })
        .optional(),
      tool_response: z
        .object({
          id: z.string(),
          status: z.enum(["OK", "ERR"]),
          result: z.any().optional(),
        })
        .optional(),
      is_noise: z.boolean().optional(),
    })
    .optional(),
});

export default messageSchema;