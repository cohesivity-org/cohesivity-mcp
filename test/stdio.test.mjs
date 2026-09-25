import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const serverVersion = "5.0.2";
const bin = fileURLToPath(new URL("../bin/cohesivity-mcp.mjs", import.meta.url));
const server = fileURLToPath(new URL("../mcp/project-bootstrap.mjs", import.meta.url));
const request = (id, method, params) => JSON.stringify({ jsonrpc: "2.0", id, method, params });

const input = [
  request(1, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "cohesivity-mcp-test", version: "1.0.0" },
  }),
  request(undefined, "notifications/initialized"),
  request(2, "tools/list", {}),
  request(3, "ping", {}),
  "{invalid-json",
  request(4, "ping", {}),
  "",
].join("\n");

test("bin wrapper starts stdio server and responds to MCP protocol", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cohesivity-mcp-test-"));
  try {
    const result = spawnSync(process.execPath, [bin], {
      cwd: tmp,
      env: {},
      input,
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);

    const replies = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(replies.map((r) => r.id), [1, 2, 3, null, 4]);

    assert.equal(replies[0].result.protocolVersion, "2025-06-18");
    assert.equal(replies[0].result.serverInfo.version, serverVersion);
    assert.deepEqual(replies[0].result.capabilities, { tools: { listChanged: false } });

    const tools = replies[1].result.tools.map((t) => t.name);
    assert.deepEqual(tools, ["create_tenant", "claim_tenant", "tenant_status", "provision_resource", "give_feedback", "get_cohesivity_documentation"]);

    assert.deepEqual(replies[2].result, {});
    assert.equal(replies[3].error.code, -32700);
    assert.deepEqual(replies[4].result, {});

    assert.deepEqual(readdirSync(tmp), []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("direct server invocation matches bin wrapper behavior", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cohesivity-mcp-test-"));
  try {
    const result = spawnSync(process.execPath, [server], {
      cwd: tmp,
      env: {},
      input,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);

    const replies = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(replies[0].result.serverInfo.version, serverVersion);
    assert.deepEqual(replies[1].result.tools.map((t) => t.name), [
      "create_tenant", "claim_tenant", "tenant_status", "provision_resource", "give_feedback", "get_cohesivity_documentation",
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("initialize and tool descriptions guide a cold agent through the call order", async () => {
  const { handleRequest, TOOLS } = await import("../mcp/project-bootstrap.mjs");
  const init = await handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.match(init.result.instructions, /create_tenant first/);
  assert.match(init.result.instructions, /provision_resource/);

  const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
  assert.match(byName.create_tenant.description, /first/i);
  assert.match(byName.create_tenant.inputSchema.properties.project_root.description, /creates? .*\.cohesivity|writes? .*\.cohesivity/i);
  assert.doesNotMatch(byName.create_tenant.inputSchema.properties.project_root.description, /owns \.cohesivity/);
  assert.match(byName.provision_resource.description, /create_tenant/);
});

test("package.json version is well-formed semver", () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});

test("bin entry exists and has shebang", () => {
  const content = readFileSync(bin, "utf8");
  assert.ok(content.startsWith("#!/usr/bin/env node"));
});
