/**
 * Reads a whole document through EOF without parsing commands.
 * @param {import("node:stream").Readable} input - Input stream.
 * @param {string} [instruction] - Optional task instruction.
 * @returns {Promise<string>} Single user message.
 */
export default async function readPipelineInput(input, instruction = "") {
  const chunks = [];
  // eslint-disable-next-line no-restricted-syntax -- Preserve stream backpressure through EOF.
  for await (const chunk of input) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const document = Buffer.concat(chunks).toString("utf8");
  if (!document.trim()) throw new Error("Pipeline stdin is empty");
  return instruction ? `${instruction}\n\n${document}` : document;
}
