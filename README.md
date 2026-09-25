# @cohesivity/mcp

Standalone [Cohesivity](https://cohesivity.ai) MCP server over stdio:

```bash
npx -y @cohesivity/mcp
```

The server exposes the same local project-bootstrap interface shipped inside the
Cohesivity plugin, packaged as a single npm bin so any MCP client can invoke it
directly without the plugin installer. It requires no OAuth and runs entirely
over stdio.

Cohesivity's hosted MCP server is separate: connect remote clients to
`https://cohesivity.ai/mcp`. The former `https://cohesivity.ai/mcp/manage`
endpoint is retired and returns HTTP 410.

## Tools

| tool | description |
| --- | --- |
| `create_tenant` | Create or reuse a Cohesivity project tenant |
| `claim_tenant` | Start the claim handoff; returns an approval URL |
| `tenant_status` | Read current tenant status from the Management API |
| `provision_resource` | Provision one or more resources (postgres, redis, vector-database, etc.) |
| `give_feedback` | Submit feedback on Cohesivity services |

Mutating tools require literal `confirmed: true` only when the current user
request explicitly authorizes the exact action.

## MCP client configuration

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

## Releasing

Releases publish to npm automatically via GitHub Actions when a version tag is
pushed. The workflow uses npm Trusted Publishing (OIDC) — no `NPM_TOKEN` secret
needed.

```bash
# bump version in package.json, commit, then:
git tag v0.2.1
git push --tags
```

The `release.yml` workflow runs tests, verifies the tag matches `package.json`,
and publishes with signed provenance.

Node.js 18+ is required. Zero dependencies.

Full product documentation: <https://cohesivity.ai/llms.txt>
