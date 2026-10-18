# MCP client architecture

The package is a small transport bridge in the separate
[airframeai/mcp-client](https://github.com/airframeai/mcp-client) repository.
The remote server lives in
[airframeai/airframe](https://github.com/airframeai/airframe/tree/main/packages/mcp-server).
Server tool descriptions, auth/RBAC, data access, agents, quotas, and auditing are
owned there. Read the [setup guide](CUSTOMER_SETUP.md) for host configuration.

## Source map

| Path | Responsibility |
| --- | --- |
| [src/index.ts](src/index.ts) | `validateServerUrl`, `parseCliArgs`, `AirframeMCPBridge`, and guarded CLI startup |
| [package.json](package.json), [package-lock.json](package-lock.json) | Binary/package contract, scripts, dependency declarations, and locked install inputs |
| [tsconfig.json](tsconfig.json) | ES2022 module compilation, declarations/maps, and `src` → `dist` output |
| [add-shebang.js](add-shebang.js) | Executable shebang/permissions for `dist/index.js` |
| [build-standalone.js](build-standalone.js) | Separate esbuild bundle targeting Node 18, with shebang/permissions |
| [vitest.config.ts](vitest.config.ts), [test/](test/) | Node test environment, `test/**/*.test.ts`, mocks, and protocol/CLI cases |
| [.github/workflows/publish.yml](.github/workflows/publish.yml) | Tag-triggered build, npm publish, and GitHub release creation |

## Request path

1. The SDK's `StdioServerTransport` connects the local host to an SDK `Server`.
   This server advertises tool capability and implements `tools/list` and
   `tools/call` handlers. It is not a transparent proxy for every MCP method.
2. Each forwarded request gets an incrementing request ID and an HTTP POST to
   the configured endpoint, with JSON content type, JSON/SSE acceptance, and
   `X-API-Key`. Calls carry a supplied progress token or a generated UUID.
3. Native `fetch` uses a 120-second abort timeout. Content type selects JSON
   parsing or the SSE reader. The result is returned through the local SDK.

The bridge does not forward an upstream initialize handshake, OAuth discovery,
resources, or prompts. Local protocol negotiation belongs to the SDK server.
No result cache or automatic request retry is implemented in the bridge.

## Responses and errors

For JSON responses, the client reads text, checks its JavaScript string length
against `MAX_RESPONSE_SIZE` (`10 * 1024 * 1024`), then parses it. This check is
after buffering; it is not a transport byte limit or a bound on SSE responses.

For `text/event-stream`, the reader decodes chunks, retains an incomplete line,
and parses JSON on lines beginning with `data:` followed by a space. It forwards progress notifications,
retains a final JSON-RPC response whose ID matches the request, and returns after
the stream ends. No matching final response is an error. It does not implement
all SSE framing/resumption forms or impose the JSON-path size check on the stream.

HTTP failures include status and at most 200 characters of the response body.
Fetch/parse/timeout failures become JSON-RPC error `-32603` and stderr messages.
The `tools/list` handler throws a returned error; `tools/call` turns it into text
content prefixed `Error:`. Do not assume the latter sets `isError` or preserves
all upstream JSON-RPC error fields. Successful call results pass through.

## CLI and security boundaries

The CLI requires a nonempty `--api-key`; it only warns if the prefix is not
`af_`. Unknown flags are not rejected by the current parser. Server-side identity
and policy remain authoritative.

`--server-url` checks HTTP/HTTPS and rejects a literal hostname list/patterns,
including localhost, common private IPv4 ranges, metadata IP, and `.internal`.
This is a CLI check, not a general network isolation guarantee: the constructor
accepts its URL directly, and the check does not resolve DNS or revalidate fetch
redirect destinations. It also accepts HTTP. Preserve the tests for the behavior
actually implemented rather than documenting a broader guarantee.

The bridge sends credentials as a header, while the local launch receives them
in arguments. Diagnostics may expose upstream error text/network details; there
is no blanket log-redaction guarantee. Production endpoint URLs in docs are
configuration defaults, not evidence of current service availability.

## Build and release

From this repository root:

```bash
npm ci
npm test
npm run build
npm run bundle
```

`build` compiles TypeScript, then makes `dist/index.js` executable. Compilation
also emits declarations and source maps per tsconfig. `bundle` separately emits
`dist/airframe-mcp-client.js`; its size depends on the actual build inputs.

`package.json` exposes `airframe-mcp` at `dist/index.js` and packages `dist` plus
README. `prepublishOnly` runs the regular build. The release workflow triggers on
`v*` tags, selects Node 24, installs with `npm ci`, builds, publishes with provenance,
and creates a GitHub release. It does not run tests, invoke `bundle`, or upload a
standalone release asset. A documentation PR does not authorize tagging or publishing.

## Tests and documentation validation

`npm test` runs Vitest once; `npm run test:coverage` uses its V8 coverage provider.
The tests cover CLI parsing, URL checks, request/error handling, JSON/SSE paths,
and security-related boundaries using mocks. Read the test's fetch/SDK mocks
before treating a result as a real host-to-server integration test.

For docs, validate paths/anchors, JSON configuration examples, and factual claims
against source/manifests. Runtime changes need their relevant tests; documentation
maintenance does not need a live key, server call, package publish, or release.
