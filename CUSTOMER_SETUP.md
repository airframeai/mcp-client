# Connect a desktop assistant to Airframe

Use this guide for `@airframeai/mcp-client`. A host with native remote HTTP/OAuth
support can connect to the server directly instead. The bridge sends `X-API-Key`;
it does not launch a browser, obtain OAuth tokens, or make an OAuth-only server
accept API keys.

## Requirements

- Node/npm available to the process launching the bridge. [package.json](package.json) declares Node `>=18.0.0`; check the actual executable selected by the host.
- A stdio MCP host and its local server configuration.
- A valid Airframe API key for the selected endpoint/environment. Use Airframe's account controls to obtain/manage it; never commit the key or paste it into a shared diagnostic.

## Put the configuration in the host

The host is the assistant application that starts this process. Open its local
MCP server configuration and add an `airframe` entry under `mcpServers` if it uses
that configuration shape. The [README](README.md#configuration-example) shows the
complete object; the global/standalone examples below show just the server entry
to put at `mcpServers.airframe`. Merge with existing entries rather than replacing
the whole file.

For Claude Desktop on macOS, the checked-in CLI help names
`~/Library/Application Support/Claude/claude_desktop_config.json`. Other hosts and
versions may provide their own settings UI or location; use that host's documented
mechanism. This is a client configuration example, not verified current host UI.
After saving, reload the connection using the host, inspect its discovered tools,
and try a permitted request. A local launch and an authenticated remote result
are separate checks.

## Choose a command

The [README example](README.md#configuration-example) uses `npx` with the correct
package scope, `@airframeai/mcp-client`. If a controlled version is needed, supply
an explicit published version in that package argument rather than assuming npx
always fetches the newest code.

A global installation exposes the `airframe-mcp` binary:

```bash
npm install -g @airframeai/mcp-client
```

Then a stdio server entry can use:

```json
{
  "command": "airframe-mcp",
  "args": ["--api-key", "YOUR_API_KEY_HERE"]
}
```

For a locally built standalone file, use an absolute path:

```json
{
  "command": "node",
  "args": ["/absolute/path/airframe-mcp-client.js", "--api-key", "YOUR_API_KEY_HERE"]
}
```

[Build instructions](ARCHITECTURE.md#build-and-release) describe how that file is
created. The checked-in release workflow does not build/upload a standalone asset;
this guide does not assume a download exists at an old release URL.

If a Windows host cannot launch `npx` directly, the retained command-shell
example is below. It changes how the local program is launched, not the API key
or server policy; host/OS integration has not been exercised in this docs review.

```json
{
  "mcpServers": {
    "airframe": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@airframeai/mcp-client", "--api-key", "YOUR_API_KEY_HERE"]
    }
  }
}
```

Keep credentials in the host's private local configuration. `--api-key` is a
command argument, so treat configuration and process diagnostics as sensitive.
The client has no implemented API-key environment-variable option.

## Select the server

Without an override, the bridge uses `https://mcp.airframe.ai/mcp`. Add
`"--server-url", "https://your-approved-server.example/mcp"` to the argument array
only when selecting a different API-key-enabled endpoint.

The CLI rejects localhost and the specific private/internal hostnames/addresses
listed in [validateServerUrl](src/index.ts). A local `http://localhost:8001/mcp`
example is incompatible with that check. HTTP is accepted by the parser, so use
an approved HTTPS endpoint for a credentialed remote connection.

The key, server identity, catalog environment, and OAuth policy must agree. A
valid key for one environment does not prove access to another; an API key also
does not establish access to OAuth-only market-report tools.

## Check configuration

Use the binary's help path without credentials:

```bash
npx -y @airframeai/mcp-client --help
```

This checks that the package can start and print help. It does not authenticate
or fetch tools. Load the configuration using the host's documented mechanism,
then inspect its tool list and a permitted request to verify remote access.
Tool availability comes from the server, not a fixed list embedded in the bridge.

## Troubleshooting

| Symptom | Inspect |
| --- | --- |
| Command not found | Node/npm or installed binary PATH in the host process, not just an interactive shell; for Windows `npx`, see the command-shell example above |
| `--api-key is required` | A nonempty argument value; no environment-variable fallback exists |
| `--server-url` rejected | URL syntax/scheme and the literal hostname restrictions in the CLI |
| HTTP 401/403 | Key/environment, endpoint OAuth-only policy, and server authorization |
| No tools / unexpected tools | Connected endpoint and `tools/list`; old comparison/category tools are not guaranteed |
| Timeout / stream error | Network/server response and the 120-second request timeout |

The bridge logs diagnostics to stderr with an `[Airframe MCP]` prefix; the host
chooses where stderr is stored. Keep stdout for MCP traffic. Error messages can
contain a truncated upstream HTTP body or network details, so redact logs before
sharing. Client help/launch success is separate from server health, identity,
quota, report entitlement, and tool completion.
