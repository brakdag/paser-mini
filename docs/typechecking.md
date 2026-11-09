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
The current inventory contains **209 diagnostics**, with no new debt. T12 removes three occurrences from Z.AI’s obsolete Axios retry interceptor; it adds no exemptions. T11 removes 16 inherited-hook visibility diagnostics by making the shared context policy an explicit adapter contract.

The retained diagnostics were reviewed by these groups:

| Files | Existing contract or typing debt | Follow-up |
| --- | --- | --- |
| Provider `adapter.js`, `conversationState.js` | Constructor options narrower than callers, private JSDoc on inherited hooks, timestamp formats, custom HTTP error properties | T11/T12/T14/T15/T19; align contracts while testing each provider |
| `chatManager.js`, `sessionFactory.js`, `terminalUI.js` | Config values typed as `unknown`, sync/async tool and UI return differences, session fields assigned after construction | T13/T14/T20 |
| `McpManager.js` | `Promise.all` result is an array of void, while shutdown annotation says void | T20; connection behavior covered by T16 |
| `gitTools.js`, `githubTools.js`, `loadTools.js`, `retryHandler.js` | Error objects extended with transport/OS metadata without matching declarations | Incremental type maintenance; transport contracts remain in T12 |
| `tests/**/*.test.js` | Intentionally missing arguments, JSON Buffer coercion, `unknown` validation/error results, injected partial interfaces, mock properties and callbacks that TypeScript cannot infer as assigned | Narrow declarations as the corresponding contracts are maintained; retain behavior assertions |

Small annotation defects were corrected during T21 rather than baselined:
constructor return tags, duplicate privacy tags on `#` methods, invalid JSDoc
module paths, and `parseInt`'s string input in `tail`. Newly added type-control,
AST and system-tool tests and scripts have no baseline exemptions.

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
