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
| `get_cohesivity_documentation` | Read one current public Cohesivity page: `docs`, `quick-reference`, `full-reference`, `onboarding`, `pricing`, `offerings`, or `offering` (which also needs the `offering` slug). Read-only; needs no tenant or confirmation |

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

### Attribution

`create_tenant` runs the Cohesivity quickstart, which names the agent that
launched this server by walking its own parent processes (for example
`claude` or `cursor`) and records that name with the new tenant. To tag
tenants created through your integration, give the server a label. The tenant
is then recorded as `<agent>.<label>`, for example `claude.raven`.

Pass it as a server argument:

```json
{
  "mcpServers": {
    "cohesivity": {
      "command": "npx",
      "args": ["-y", "@cohesivity/mcp", "--attribution", "raven"]
    }
  }
}
```

or set `COHESIVITY_ATTRIBUTION` in the server's environment:

```json
{
  "mcpServers": {
    "cohesivity": {
      "command": "npx",
      "args": ["-y", "@cohesivity/mcp"],
      "env": { "COHESIVITY_ATTRIBUTION": "raven" }
    }
  }
}
```

Use the argument form for catalogs that can pass args but can't set env. The
server reads the label once at start. If both are set, a valid argument wins.
The value must be 1-40 lowercase letters, digits, dots, underscores, or hyphens,
starting with a letter or digit. An invalid value is ignored with a warning on
stderr, and tenant creation proceeds without it.

## Microsoft Agent Framework

[Microsoft Agent Framework](https://github.com/microsoft/agent-framework)
agents can use the hosted server as an MCP tool. When a task needs a backend,
the agent creates a tenant and provisions what it needs, such as Postgres,
Redis or object storage. No Cohesivity account or API key is required to start.

Python, after `pip install agent-framework`:

```python
import asyncio

from agent_framework import Agent, MCPStreamableHTTPTool
from agent_framework.openai import OpenAIChatClient


async def main() -> None:
    async with Agent(
        client=OpenAIChatClient(model="gpt-5.4-mini"),
        tools=MCPStreamableHTTPTool(name="cohesivity", url="https://cohesivity.ai/mcp"),
    ) as agent:
        result = await agent.run("Set up a Postgres database for my todo app.")
        print(result.text)


asyncio.run(main())
```

.NET, after `dotnet add package Microsoft.Agents.AI.OpenAI` and
`dotnet add package ModelContextProtocol`:

```csharp
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using ModelContextProtocol.Client;
using OpenAI;
using OpenAI.Chat;

await using var mcpClient = await McpClient.CreateAsync(new HttpClientTransport(new()
{
    Endpoint = new Uri("https://cohesivity.ai/mcp"),
}));
var tools = await mcpClient.ListToolsAsync();

AIAgent agent = new OpenAIClient(Environment.GetEnvironmentVariable("OPENAI_API_KEY"))
    .GetChatClient("gpt-5.4-mini")
    .AsAIAgent(tools: [.. tools.Cast<AITool>()]);

Console.WriteLine(await agent.RunAsync("Set up a Postgres database for my todo app."));
```

Both examples use OpenAI and read `OPENAI_API_KEY`. Any other Agent Framework
chat client works too. New tenants expire after 72 hours unless claimed;
`claim_tenant` returns a link where the user approves keeping it.

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
