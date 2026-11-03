import { z } from "zod";

const HEX = z.string().refine((value) => {
  const compact = value.replace(/\s+/g, "");
  return compact.length > 0 && compact.length % 2 === 0 && /^[0-9a-f]+$/i.test(compact);
}, "Expected non-empty pairs of hexadecimal digits");
export const BINARY_FIELDS = {
  action: z.enum(["inspect", "extract", "search", "detect", "convert"]),
  filePath: z.string().min(1).optional(),
  offset: z.number().int().nonnegative().safe().optional(),
  length: z.number().int().positive().safe().optional(),
  end: z.number().int().nonnegative().safe().optional(),
  endianness: z.enum(["LE", "BE"]).optional(),
  outputFile: z.string().min(1).optional(),
  pattern: HEX.optional(),
  hexString: HEX.optional(),
  type: z.enum(["Int8", "UInt8", "Int16", "UInt16", "Int32", "UInt32", "Float32", "Float64"]).optional(),
};

const binarySchema = z.discriminatedUnion("action", [
  z.object({ ...BINARY_FIELDS, action: z.literal("inspect"), filePath: z.string().min(1), length: BINARY_FIELDS.length.unwrap().max(64 * 1024).optional() }).strict(),
  z.object({
    ...BINARY_FIELDS, action: z.literal("extract"), filePath: z.string().min(1), outputFile: z.string().min(1),
    length: BINARY_FIELDS.length.unwrap().max(10 * 1024 * 1024).optional(),
  }).strict(),
  z.object({ ...BINARY_FIELDS, action: z.literal("search"), filePath: z.string().min(1), pattern: HEX }).strict(),
  z.object({ ...BINARY_FIELDS, action: z.literal("detect"), filePath: z.string().min(1) }).strict(),
  z.object({ ...BINARY_FIELDS, action: z.literal("convert"), hexString: HEX, type: BINARY_FIELDS.type.unwrap() }).strict(),
]);

const SCHEMAS = {
  analysis: z.object({ path: z.string().min(1) }).strict(),
  arrange: z.object({ file_path: z.string().min(1), path: z.string() }).strict(),
  ast: z.object({ path: z.string().min(1), query: z.string(), limit: z.number().optional() }).strict(),
  bin: binarySchema,
  close: z.object({ issue_number: z.number().int(), repo: z.string().optional() }).strict(),
  concat: z.object({ destination: z.string().min(1), source: z.string().min(1) }).strict(),
  copy: z.object({ origin: z.string().min(1), destination: z.string().min(1) }).strict(),
  create: z.object({ title: z.string(), body: z.string(), repo: z.string().optional() }).strict(),
  diff: z.object({ path: z.string().min(1) }).strict(),
  doc: z.object({ path: z.string().min(1).optional().default("."), outputDir: z.string().min(1).optional().default("docs/api") }),
  edit: z.object({ issue_number: z.number().int(), repo: z.string().optional(), title: z.string().optional(), body: z.string().optional() }).strict(),
  eslint: z.object({ path: z.string().min(1).optional().default(".") }),
  eval: z.object({ code: z.string() }).strict(),
  execute: z.object({ command: z.string() }),
  glob: z.object({ pattern: z.string().min(1) }).strict(),
  grep: z.object({ query: z.string(), path: z.string().min(1).optional() }).strict(),
  img: z.object({ path: z.string().min(1), crop: z.array(z.number()).length(4).optional() }).strict(),
  inspect: z.object({ path: z.string().min(1).optional().or(z.null()), command: z.string().optional() }).strict(),
  issues: z.object({ repo: z.string().optional() }).strict(),
  list: z.object({ path: z.string().min(1) }).strict(),
  message: z.object({
    id: z.string(),
    timestamp: z.string(),
    role: z.enum(["user", "agent", "system", "thought", "tool"]),
    nickname: z.string(),
    content: z.string(),
    metadata: z.object({
      tool_call: z.object({ id: z.string(), name: z.string(), args: z.record(z.any()) }).optional(),
      tool_response: z.object({ id: z.string(), status: z.enum(["OK", "ERR"]), result: z.any().optional() }).optional(),
      is_noise: z.boolean().optional(),
    }).optional(),
  }),
  metrics: z.object({}).strict(),
  mkdir: z.object({ path: z.string().min(1) }).strict(),
  nickname: z.object({ newNickname: z.string().min(1).max(32) }).strict(),
  node: z.object({ file_path: z.string().min(1), path: z.string() }).strict(),
  notify: z.object({ message: z.string() }).strict(),
  patch: z.object({ patch: z.string() }).strict(),
  post: z.object({ issue_number: z.number().int(), body: z.string(), repo: z.string() }).strict(),
  push: z.object({ data: z.any() }).strict(),
  read: z.object({ path: z.string().min(1) }).strict(),
  tail: z.object({ path: z.string().min(1), tail: z.union([z.number(), z.string()]) }).strict(),
  real: z.object({ action: z.string() }).strict(),
  reloadSchemas: z.object({}).strict(),
  reloadTools: z.object({}).strict(),
  remote: z.object({}).strict(),
  remove: z.object({ path: z.string().min(1) }).strict(),
  rename: z.object({ origin: z.string().min(1), destination: z.string().min(1) }).strict(),
  replace: z.object({ path: z.string().min(1), search_text: z.string(), replace_text: z.string() }).strict(),
  reset: z.object({ user_message: z.string() }).strict(),
  restore: z.object({ filepath: z.string().min(1) }).strict(),
  run: z.object({ code: z.string() }).strict(),
  scene: z.object({ scene: z.string(), action: z.string() }).strict(),
  sed: z.object({ path: z.string().min(1), pattern: z.string().min(1), replacement: z.string().optional(), flags: z.string().optional() }).strict(),
  search: z.object({ query: z.string().min(1, "Search query cannot be empty") }),
  snapshot: z.object({ path: z.string().min(1) }).strict(),
  structure: z.object({ file_path: z.string().min(1), path: z.string() }).strict(),
  token: z.object({}).strict(),
  tree: z.object({}).strict(),
  update: z.object({ file_path: z.string().min(1), path: z.string(), value: z.any() }).strict(),
  url: z.object({ url: z.string().min(1).transform(v => v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`) }),
  fetch: z.object({
    url: z.string().min(1).transform(v => v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`),
    searchQuery: z.string().optional(),
    headers: z.string().optional(),
  }).strict(),
  validate: z.object({ json_string: z.string() }).strict(),
  write: z.object({ path: z.string().min(1), content: z.string() }).strict(),
  zip: z.object({ filePath: z.string().min(1) }).strict(),
  index: z.object({
    path: z.string().min(1).optional().default("."),
    filter: z.string().optional(),
  }).strict(),
  load: z.object({ ids: z.string() }).strict(),
  qr: z.object({ text: z.string() }).strict(),
};

export default SCHEMAS;
