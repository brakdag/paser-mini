import { addAbortSignal } from "node:stream";

/**
 * Reads SSE chat text without exposing incomplete arguments to the tool parser.
 * @param {import("node:stream").Readable} stream - Response body.
 * @param {object} [options] - Observer and cancellation.
 * @param {AbortSignal} [options.signal] - Cancels the response.
 * @param {(text: string) => void} [options.preview] - Transient accumulated text.
 * @returns {Promise<string>} Complete text after the completion sentinel.
 */
export default async function readChatStream(stream, { signal, preview = () => {} } = {}) {
  if (signal) addAbortSignal(signal, stream);
  const decoder = new TextDecoder();
  let pending = "";
  let text = "";
  let data = [];
  let done = false;
  /** Consumes one SSE event, including multi-line data fields. */
  const event = () => {
    if (!data.length) return;
    const value = data.join("\n");
    data = [];
    if (Buffer.byteLength(value, "utf8") > 1024 * 1024) throw new Error("Chat stream event too large");
    if (value === "[DONE]") { done = true; return; }
    const parsed = JSON.parse(value);
    if (parsed.error) throw new Error("Chat stream returned an error");
    const choice = parsed.choices?.[0];
    if (choice?.delta?.tool_calls || choice?.delta?.function_call) throw new Error("Native tool streaming is unsupported; use text tools");
    if (choice?.finish_reason && !["stop"].includes(choice.finish_reason)) throw new Error(`Incomplete chat stream: ${choice.finish_reason}`);
    const fragment = choice?.delta?.content;
    if (fragment != null && typeof fragment !== "string") throw new Error("Invalid chat text fragment");
    if (fragment) { text += fragment; preview(text); }
  };
  try {
    // eslint-disable-next-line no-restricted-syntax -- Decode streamed chunks with backpressure and automatic iterator cleanup.
    for await (const chunk of stream) {
      signal?.throwIfAborted();
      pending += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      while (pending.includes("\n")) {
        const boundary = pending.indexOf("\n");
        const line = pending.slice(0, boundary).replace(/\r$/, "");
        pending = pending.slice(boundary + 1);
        if (!line) event();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        if (done) return text;
      }
      if (pending.length + data.join("").length > 1024 * 1024) throw new Error("Chat stream event too large");
    }
    throw new Error("Chat stream ended before [DONE]");
  } finally {
    // Async iteration closes the source on early return or failure.
    preview("");
  }
}
