#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { runServer, MANAGEMENT_API_URL } from "../mcp/project-bootstrap.mjs";

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

runServer().catch((error) => {
  process.stderr.write(`${error?.message ?? "Unknown error"}\n`);
  process.exitCode = 1;
});
