# CLI composition, compatible endpoints and shortcuts

## Whole-document pipelines

```sh
paser-mini --pipeline --message 'Summarize these notes' < notes.txt > summary.txt
cat notes.txt | paser-mini --pipeline --message 'Extract the action items'
```

`--pipeline` reads UTF-8 stdin through EOF as one document. Lines such as `/quit`
are document content. An optional `--message` instruction precedes the unchanged
document, separated by two newlines. Empty or whitespace-only stdin is an error.
This explicit mode cannot be combined with `--github-mode`.

Only the completed assistant reply and a final newline go to stdout. Information,
thoughts, tool output and errors go to stderr. There are no terminal prompts,
banners, spinners or renderer escape sequences in stdout. Streaming previews are
disabled in this mode, so failed or incomplete turns publish no reply. Tool side
effects already performed are retained. The mode exits with 0 after completion;
startup failures, turn limits, an output pipe closing early, and interruptions
exit nonzero. SIGINT and SIGTERM request cleanup and return 130.

The input document and final reply are buffered in memory. This mode does not
stream arbitrarily large input documents. Normal interactive input remains line
oriented.

## Configurable chat-completions endpoint

Add to the project's `.paser-mini/config/config.json` and restart Paser:

```json
{
  "provider": "COMPATIBLE",
  "compatible_base_url": "http://localhost:8080/v1",
  "model_name": "my-local-model"
}
```

For a server requiring a bearer credential:

```json
{
  "provider": "COMPATIBLE",
  "compatible_base_url": "https://inference.example.org/team/v1",
  "model_name": "my-model",
  "compatible_api_key_env": "MY_INFERENCE_API_KEY"
}
```

Set `MY_INFERENCE_API_KEY` in the process environment. The configuration stores
its variable name, and request diagnostics exclude authorization headers. Omit
`compatible_api_key_env` for unauthenticated servers. A named but unset or empty
credential is an error. URLs must use HTTP(S), without userinfo, query parameters
or fragments. Prefixes are retained: `/team/v1` receives POST requests at
`/team/v1/chat/completions`. The model must be explicit; model discovery is not
required. Configure these fields before selecting `COMPATIBLE` with `/connect`.

The supported protocol uses `model`, `messages`, `temperature`, and `max_tokens`,
and reads `choices[0].message.content` for full responses. It reuses the common
history transaction, context estimate, cancellation and retry policy. Text tools
use Paser's existing schwa syntax. Native function/tool-call response objects,
provider-specific APIs and image inputs are outside this initial integration.

## Progressive response preview

The shared compatible chat transport requests SSE streaming when the UI supports
it and `streaming_enabled` is true (the default). The terminal shows the latest
text on one transient stderr line, then clears it and renders the completed
response once through the normal renderer. Previews are limited to the last 100
characters and are displayed only when stderr is a TTY. Logs and history retain
one complete reply. Failed attempts clear the preview before retrying.

Set `"streaming_enabled": false` in configuration if the server needs full JSON
responses. Adapters with a different transport continue to use complete replies.
The first streaming providers are those using `compatibleChat.js`: COMPATIBLE,
Cerebras, Cloudflare, Groq, HuggingFace, OpenRouter, Poolside and ZenMux.

SSE text deltas must end with `data: [DONE]`. UTF-8 bytes and SSE lines can be
split between network chunks. Truncation, error events, unsupported native tool
calls, and a non-`stop` finish reason fail the request without committing a reply.
Tools are parsed only after the complete response, never from preview fragments.
A stream event is limited to 1 MiB. The common request deadline bounds the whole
request and its retries.

## Personal text shortcuts

Create `.paser-mini/config/shortcuts.json` in the working project:

```json
{
  "corregir": "Correct the spelling and grammar. Preserve the meaning.",
  "resumir": "Summarize the following text in three concise bullet points."
}
```

`/corregir texto` submits the configured instruction followed by a newline and
`texto`. `/corregir` submits the instruction alone. Extra text, including Unicode,
newlines and trailing whitespace, is appended literally after the first separator.
An expansion is sent straight to the model: it is never interpreted as another
CLI command, script, or template.

Names must match `[a-z][a-z0-9_-]*` and must not collide with built-in commands.
Values must be strings. Built-in commands take precedence; invalid JSON or entries
produce a diagnostic when a custom command is requested. Unknown names use the
normal invalid-command diagnostic. No file is required for ordinary use.
The map is read afresh for each custom command, so edits apply to its next use.

## Session startup and incomplete turns

Both session modes await adapter initialization before sending. Startup has a
10-second total wait limit and is cancelled immediately by session exit. Cerebras
metadata additionally uses a 5-second HTTP timeout and then uses its context
fallback. Custom adapters should honor the optional startup `signal`; even if an
adapter ignores it, the session owner stops waiting within the total deadline and
does not send a subsequent request.

`initializeSession()` returns a promise, including for synchronous adapters.
`processTurn()` and `runOnce()` reject on turn limits, repetition stops and
cancellation. They resolve after a completed turn; `runOnce()` also waits for UI
publications. Interactive input stays available after a turn limit. Failed
rewrites restore history, the previous rewrite target and repetition/tool tracking;
external tool side effects are retained. Incomplete GitHub issues release their
processing label and receive no completion receipt, allowing retry.
