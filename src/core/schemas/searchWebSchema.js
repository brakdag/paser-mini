import { z } from "zod";

export default z.object({
  query: z.string().min(1, "Search query cannot be empty"),
});