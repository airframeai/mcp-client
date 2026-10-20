# Airframe MCP client

`@airframeai/mcp-client` connects a desktop assistant to Airframe when the
assistant launches tools as local programs using the Model Context Protocol (MCP).
The assistant starts this Node.js
process and talks to it through standard input/output (stdio); the process sends
requests to the remote Airframe server over HTTP using an API key.

The remote server supplies product information, research, and expert tools.
This client translates the connection; it does not contain that intelligence or
perform OAuth sign-in. An assistant with native remote HTTP/OAuth support can
connect directly without this bridge.

The server lives in the separate
[Airframe repository](https://github.com/airframeai/airframe/tree/main/packages/mcp-server).
The bridge forwards `tools/list` and `tools/call`; the connected server determines
available tools, permissions, quotas, and results. A copied tool list here would
drift from the server.

## Start here

- [CUSTOMER_SETUP.md](CUSTOMER_SETUP.md): stdio-host configuration, credentials, and troubleshooting.
- [ARCHITECTURE.md](ARCHITECTURE.md): source map, protocol behavior, tests, and build/release paths.
- [src/index.ts](src/index.ts): CLI parser, URL checks, bridge, and executable entrypoint.
- [package.json](package.json): package name, binary, engine declaration, dependencies, and scripts.

## Configuration example

For a host that accepts a `mcpServers` stdio configuration:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "npx",
      "args": ["-y", "@airframeai/mcp-client", "--api-key", "YOUR_API_KEY_HERE"]
    }
  }
}
```

Replace the placeholder with a key for the target environment and keep the local
configuration private. The default URL in the source is
`https://mcp.airframe.ai/mcp`. API-key availability depends on server configuration;
an OAuth-only endpoint rejects this bridge's authentication method. Native remote
HTTP/OAuth connections do not require this bridge.

## CLI contract

| Argument | Checked-in behavior |
| --- | --- |
| `--api-key KEY` | Required nonempty value; a missing `af_` prefix produces a warning, not local rejection. The server validates the key. |
| `--server-url URL` | Optional override; accepts HTTP/HTTPS syntax subject to the hostname checks in `validateServerUrl`. Localhost and listed private/internal addresses are rejected. |
| `--help`, `-h` | Prints help and exits without starting the bridge; no API key is needed. |

The CLI does not read an API-key environment variable. Supply the supported
argument through the host configuration. See the [architecture guide](ARCHITECTURE.md)
for the URL check's scope, JSON/SSE handling, and error behavior.

## Development

From the repository root, using the checked-in lockfile:

```bash
npm ci
npm test
npm run build
npm run bundle
```

The package declares Node `>=18.0.0`; the release workflow selects Node 24.
`npm test` runs Vitest once with mocked transport/fetch paths; it does not prove
live server access. `build` emits `dist/index.js` and adds a shebang. `bundle`
separately creates `dist/airframe-mcp-client.js`; it is not part of the release
workflow. No fixed bundle size or published asset availability is implied.

A documentation-only edit needs link, Markdown, and source/manifest validation;
it does not need dependency installation, an authenticated connection, publishing,
or a release tag. License: [MIT](LICENSE).
