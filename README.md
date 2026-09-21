# @cohesivity/mcp

Standalone [Cohesivity](https://cohesivity.ai) MCP server over stdio:

```bash
npx -y @cohesivity/mcp
```

The server exposes the same local project-bootstrap interface shipped inside the
Cohesivity plugin, packaged as a single npm bin so any MCP client can invoke it
directly without the plugin installer. It reads and writes only the project's
`.cohesivity` credential file and `.gitignore`, requires no OAuth, and runs
entirely over stdio.

## Tools

| tool | description |
| --- | --- |
| `create_tenant` | Run the full Cohesivity quickstart in a project: create or reuse credentials, install detected client integrations, return non-secret metadata. Requires explicit `confirmed: true`. |
| `claim_tenant` | Start the claim handoff using the project credential. Returns an approval URL. Requires explicit `confirmed: true`. |
| `tenant_status` | Read current tenant status from the Management API using the project credential. Redacts secrets. |
| `provision_resource` | Provision one resource or several in bulk. Supports postgres, redis, object-storage, vector-database, and 12 others. Requires explicit `confirmed: true`. |
| `give_feedback` | Submit feedback on Cohesivity services. No confirmation needed. Excludes personal information and secrets. |

Mutating tools require literal `confirmed: true` only when the current user
request explicitly authorizes the exact action.

## MCP client configuration

### Stdio registry entry (Dexto, etc.)

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@cohesivity/mcp"]
}
```

### Claude Code

```json
{
  "mcpServers": {
    "cohesivity": {
      "command": "npx",
      "args": ["-y", "@cohesivity/mcp"]
    }
  }
}
```

### Cursor, Windsurf, and other MCP-compatible clients

```json
{
  "mcpServers": {
    "cohesivity": {
      "command": "npx",
      "args": ["-y", "@cohesivity/mcp"],
      "transportType": "stdio"
    }
  }
}
```

## Server details

- **Protocol version:** 2025-06-18
- **Server name:** `cohesivity-project-bootstrap`
- **Server version:** 4.1.2
- **Management API:** `https://cohesivity.ai/api/`
- **Zero dependencies**

The server validates project roots, enforces path traversal and symlink
protections on credential files, scrubs secrets from all MCP output, and caps
response sizes. It never opens a browser or starts OAuth.

## Tracking

A lightweight, non-blocking beacon fires on install (`postinstall`) and on each
server start. Both are fire-and-forget POST requests to the Cohesivity
Management API with the package name and version. Neither blocks startup nor
affects server behavior on failure. The server's own API calls include a
`User-Agent` header identifying the package.

## Verifying the release

Every npm version publishes from this repository through npm Trusted Publishing
with provenance:

```bash
npm audit signatures
```

Node.js 18+ is required for built-in `fetch`. The package has zero dependencies.

Full product documentation: <https://cohesivity.ai/llms.txt>
