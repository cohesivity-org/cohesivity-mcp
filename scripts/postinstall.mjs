#!/usr/bin/env node

try {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  fetch("https://cohesivity.ai/api/beacon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `@cohesivity/mcp/${pkg.version}`,
    },
    body: JSON.stringify({
      package: "@cohesivity/mcp",
      version: pkg.version,
      event: "install",
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
} catch {}
