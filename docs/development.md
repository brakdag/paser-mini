# Development and quality checks

Use Debian/Linux with Node **24.x or 26.x** and npm. These are the supported lines
in the [Node release schedule](https://nodejs.org/en/about/previous-releases).
Install the locked dependencies with `npm ci --ignore-scripts`, then run
`npm start`. Git and GNU grep must be available for the CLI tools and test suite;
audio, ImageMagick and network services are replaced by local fakes in tests.
The `run` tests require Linux, Bubblewrap, util-linux and enabled unprivileged
user namespaces. See the [run execution policy](local-tools.md#run-execution-policy) for dependencies and limits.

`npm run check` runs lint, the reviewed JS type baseline and the complete test
suite. They can also be run separately as `npm run lint`, `npm run typecheck` and
`npm test`. CI runs the same checks on Node 24 and 26. `eslint.config.js` is the
only lint configuration. ESLint 9 is retained for Airbnb 3 compatibility.

`npm test` creates a temporary project and HOME, copies only test inputs and
application code, and links the installed dependencies. It does not copy project
configuration, logs, `.env` or user credentials, and does not pass credential
environment variables to the test process. It removes the temporary project on
completion. Tests have a 60-second deadline and the subprocess has a three-minute
deadline; no provider, GitHub, MCP or audio service is contacted.

Type control currently checks for changes against existing debt. It does **not**
mean TypeScript has zero errors. `npm run typecheck:raw` reports all existing
diagnostics and exits nonzero; [the reviewed baseline](typechecking.md)
describes its scope, limitations and review process.
