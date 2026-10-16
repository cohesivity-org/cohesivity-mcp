import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const serverVersion = "5.1.0";
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

// COH-329: clients that read only top-level properties drop every argument
// of a tool declared as a top-level oneOf, so each schema is one flat object.
test("every tool schema is one flat object with its arguments in top-level properties", async () => {
  const { TOOLS } = await import("../mcp/project-bootstrap.mjs");
  for (const tool of TOOLS) {
    for (const schema of [tool.inputSchema, tool.outputSchema].filter(Boolean)) {
      assert.equal(schema.type, "object", tool.name);
      for (const keyword of ["oneOf", "anyOf", "allOf", "not", "if"]) {
        assert.equal(schema[keyword], undefined, `${tool.name} has a top-level ${keyword}`);
      }
    }
    for (const field of tool.inputSchema.required) assert.ok(tool.inputSchema.properties[field], `${tool.name}.${field}`);
  }
  const provision = TOOLS.find((tool) => tool.name === "provision_resource");
  assert.deepEqual(provision.inputSchema.required, ["project_root", "confirmed"]);
  assert.deepEqual(
    Object.keys(provision.inputSchema.properties).sort(),
    ["configuration", "configurations", "confirmed", "project_root", "resource", "resources"],
  );
  assert.match(provision.description, /exactly one of resource or resources/);
});

test("package.json version is well-formed semver", () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});

test("bin entry exists and has shebang", () => {
  const content = readFileSync(bin, "utf8");
  assert.ok(content.startsWith("#!/usr/bin/env node"));
});

test("bin wrapper reads --attribution and COHESIVITY_ATTRIBUTION once at start", () => {
  // Static on purpose: spawning the wrapper also fires its start beacon, so the
  // argument handling itself is exercised by spawning mcp/project-bootstrap.mjs
  // in local-bootstrap.test.mjs.
  const wrapper = readFileSync(bin, "utf8");
  assert.match(wrapper, /import \{ runServer, startupDependencies, MANAGEMENT_API_URL \} from "\.\.\/mcp\/project-bootstrap\.mjs";/);
  assert.match(wrapper, /runServer\(process\.stdin, process\.stdout, startupDependencies\(process\.env, process\.argv\.slice\(2\)\)\)/);
});
