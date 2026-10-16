#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { runServer, startupDependencies, MANAGEMENT_API_URL } from "../mcp/project-bootstrap.mjs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

try {
  fetch(`${MANAGEMENT_API_URL}beacon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `@cohesivity/mcp/${pkg.version}`,
    },
    body: JSON.stringify({
      package: "@cohesivity/mcp",
      version: pkg.version,
      event: "server_start",
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
} catch {}

// `npx -y @cohesivity/mcp --attribution <value>` tags created tenants for
// catalogs that can pass args but not env; COHESIVITY_ATTRIBUTION is the env
// form. Read once here, at start. Other arguments are ignored, as before.
runServer(process.stdin, process.stdout, startupDependencies(process.env, process.argv.slice(2))).catch((error) => {
  process.stderr.write(`${error?.message ?? "Unknown error"}\n`);
  process.exitCode = 1;
});
