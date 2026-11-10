# JavaScript type control

`npm run typecheck` runs the declared TypeScript compiler against `src/**/*.js`,
`tests/**/*.test.js` and `scripts/**/*.js`. It compares semantic diagnostics with
the reviewed inventory in `typecheck-baseline.json`. There are no per-file
`@ts-nocheck` exceptions. The intentionally invalid runtime/syntax fixtures under
`tests/errores` are excluded from both type control and lint.

This is a regression control with existing debt, **not a clean TypeScript build**.
`npm run typecheck:raw` prints every diagnostic and currently exits nonzero.
`skipLibCheck` skips checking dependency declaration bodies; application calls to
those APIs are still checked. JavaScript remains non-strict, as in the previous
configuration. See [TypeScript's checkJs documentation](https://www.typescriptlang.org/tsconfig/checkJs.html).

## Reviewed debt (T21, 2026-11-09)

The initial inventory contains **284 existing diagnostics**. It records the relative file, diagnostic code, complete message, source
expression and occurrence count. It ignores line numbers so adding comments does
not require a refresh. New files have no exemptions. New or changed diagnostics,
increased counts, and resolved diagnostics all fail the check. Syntax/configuration
errors and unresolved imports cannot enter the baseline. The compiler version is
pinned and also recorded in the inventory. Node types come from the locked Node 24
definitions on both supported runtimes.

T13 resolves two entries: the communicator now accepts the array payload already
used for tool results, and the command test explicitly types its partial manager
fixture. T22's prompt reload correction resolves 29 more diagnostics: the missing
command handler, the missing base prompt property and history inferred as `void`.
The history hook now declares its existing array contract; message elements remain
untyped. Completing T22 resolves another 25 diagnostics through explicit GitHub
runner fields, correct command/logger calls and an object view for JSON cloning.
T14 declares the session provider manager explicitly and resolves its two missing-field diagnostics.
After T11–T23 the inventory contained **170 diagnostics**. A07 (2026-11-10) reduces it to **150 diagnostics** (46 in production, 104 in tests), with no new debt. T12 removes three occurrences from Z.AI’s obsolete Axios retry interceptor; it adds no exemptions. T11 removes 16 inherited-hook visibility diagnostics by making the shared context policy an explicit adapter contract.

T19/T20 remove 37 occurrences: shared API error construction replaces seven copies (35), MCP shutdown now returns void (1), and the injectable inspector launcher documents the process seam used by fixtures (1). No new diagnostics or exemptions were added.

The retained diagnostics were reviewed by these groups:

| Files | Existing contract or typing debt | Follow-up |
| --- | --- | --- |
| Provider `adapter.js` | Custom HTTP error properties without matching declarations | Further transport type maintenance after A07; retain retry/error behavior tests |
| `chatManager.js`, `turnProcessor.js` | Tool return contract permits synchronous results while the engine annotation expects promises; manager field assigned after construction | Further shared-contract maintenance after A07 |
| `gitTools.js`, `githubTools.js`, `loadTools.js`, `retryHandler.js` | Error objects extended with transport/OS metadata without matching declarations | Incremental type maintenance; transport contracts remain in T12 |
| `tests/**/*.test.js` | Intentionally missing arguments, JSON Buffer coercion, `unknown` validation/error results, injected partial interfaces, mock properties and callbacks that TypeScript cannot infer as assigned | Narrow declarations as the corresponding contracts are maintained; retain behavior assertions |

Small annotation defects were corrected during T21 rather than baselined:
constructor return tags, duplicate privacy tags on `#` methods, invalid JSDoc
module paths, and `parseInt`'s string input in `tail`. Newly added type-control,
AST and system-tool tests and scripts have no baseline exemptions.

A07 aligns the twelve adapter constructor options, string timestamps in
ConversationState and both NVIDIA adapters, synchronous/asynchronous terminal
input, and the configuration reads in ChatManager. Its injected configuration
contract names the storage methods the manager actually uses. Base startup now
declares `void | Promise<void>` and optional cancellation; ChatManager awaits it
in both session modes. Turn limits reject through `processTurn` and `runOnce`,
which is also documented in [CLI composition](cli-composition.md).
Only resolved entries were removed: 19 production occurrences and one test
occurrence. The new regression and feature tests introduce no inventory entries,
`any` annotations, or `checkJs` exclusions. Remaining HTTP/OS error metadata and
mock debt stays inventoried for later batches.

## Maintaining the inventory

1. Run `npm run typecheck` and inspect each reported expression. Fix new errors;
   do not regenerate the inventory to silence regressions.
2. After fixing existing debt, remove the corresponding inventory entries or
   reduce their counts. The next check must pass.
3. When deliberately reviewing a compiler/contract migration, run
   `node scripts/typecheck.js --write-baseline`, inspect the entire JSON diff,
   document the reasons and validate the affected contracts. CI never writes it.

The inventory is a temporary aid: identical errors on the same expression in the
same file can replace one another without changing their count. Dynamic values
inferred as `any` are also outside this control. Behavioral tests remain necessary.
