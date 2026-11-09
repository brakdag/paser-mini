# Tool results and media

`ExecutionEngine.executeToolCall()` retains its raw `result` and adds an `outcome`:

```js
{
  kind: "tool-result",
  isError: false,
  content: [{ type: "text", text: "..." }],
  metadata: {},
  action: null
}
```

`content` is an ordered array of blocks. Text, MCP images, embedded resources,
resource links, audio and unknown future block types retain their original data
and annotations. Legacy `{ mime_type, data, resolution }` images and mixed arrays
are normalized at the content boundary. Native objects remain JSON text. MCP
returns the whole remote result; extra result fields, including
`structuredContent` and `_meta`, are retained in `metadata` and represented as
JSON alongside the blocks sent to the model.

A remote `isError: true` is a failed execution even when the transport succeeds.
Monitoring, tool tracking, turn error limits and the model's result header all
use that status. Tool batches keep a status/name header and the ordered blocks
for each invocation, so multiple images do not replace neighboring text or
results. No object is converted with JavaScript's implicit string coercion.

Projection happens at the adapter boundary:

| Adapter | Current projection |
| --- | --- |
| Gemini | Image bytes become `inline_data`; base64 data URLs are also accepted. |
| OpenRouter | Images become OpenAI `image_url` parts; existing image URLs are retained. |
| NVIDIA, NVIDIA MiniMax, Cohere, Z.ai, Groq, Cerebras, Cloudflare, Hugging Face, Poolside, ZenMux | Text projection with an explicit unsupported-content explanation for images and other binary/unknown blocks. |
| All adapters | Embedded text resources include URI and text; resource links include their metadata. Binary resources, audio and unknown blocks get explicit explanations. |

This is the capability policy implemented by these adapters, not a claim about
every model available from each service. Remote models may reject image input;
normal request errors propagate with history rollback. There is no automatic
model capability discovery or binary-resource download. The unprojected content
remains in native in-memory history (Gemini uses `sourceContent` alongside its
parts), including content an adapter cannot send. Context trimming can remove
older turns and shorten active text with an explicit marker; binary blocks remain
intact in retained messages. Reset and provider changes still remove history
according to their documented policies. Session logs contain the terminal's textual view, not a binary archive.

The terminal displays the tool name, argument detail and a success/failure mark
(✓/✗). Tool result bodies, resource text and metadata are sent to the model
without being printed to the terminal or session transcript. Fountain injection
and QR display are separate local `action` values, dispatched only after success.
MCP metadata with the same type
names does not become a local action. A Fountain action preserves results from
earlier tools in its batch before injecting the scene. QR sends the usual display
acknowledgment to the model.

`tests/toolResults.test.js` exercises MCP → parser/engine → turn → model input,
terminal rendering, control actions, turn limits and the actual serialized wire
payload of all twelve adapters with simulated transports; no remote credentials
or service calls are required.
