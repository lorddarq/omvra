#!/usr/bin/env node

const DEFAULT_ENDPOINT = 'http://127.0.0.1:3456/mcp';
const EXPECTED_TOOLS = [
  'workspace.get_snapshot',
  'tasks.list',
  'tasks.get',
  'cards.kanban.list',
  'cards.timeline.list',
];
const EXPECTED_RESOURCES = [
  'plumy://workspace',
  'plumy://cards/kanban',
  'plumy://cards/timeline',
  'plumy://tasks/{taskId}',
];

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--endpoint') {
      result.endpoint = argv[index + 1];
      index += 1;
    } else if (arg === '--token') {
      result.token = argv[index + 1];
      index += 1;
    } else if (arg === '--timeout') {
      result.timeoutMs = Number(argv[index + 1]);
      index += 1;
    }
  }
  return result;
}

function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function rpcCall(endpoint, token, method, params, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload?.error) {
      throw new Error(payload.error.message || `MCP method ${method} failed`);
    }

    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

function getSnapshotCounts(snapshot) {
  const workspace = snapshot?.workspace || snapshot || {};
  const tasks = Array.isArray(workspace.tasks) ? workspace.tasks.length : 0;
  const people = Array.isArray(workspace.people) ? workspace.people.length : 0;
  const projects = Array.isArray(workspace.projects) ? workspace.projects.length : 0;
  const statusColumns = Array.isArray(workspace.statusColumns) ? workspace.statusColumns.length : 0;
  return { tasks, people, projects, statusColumns };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = args.endpoint || process.env.MCP_ENDPOINT || DEFAULT_ENDPOINT;
  const token = args.token || process.env.MCP_TOKEN || '';
  const timeoutMs = Number.isFinite(args.timeoutMs) ? args.timeoutMs : Number(process.env.MCP_TIMEOUT_MS || 5000);

  const toolsResult = await rpcCall(endpoint, token, 'tools/list', {}, timeoutMs);
  const resourcesResult = await rpcCall(endpoint, token, 'resources/list', {}, timeoutMs);
  const snapshotResult = await rpcCall(endpoint, token, 'tools/call', {
    name: 'workspace.get_snapshot',
    arguments: {},
  }, timeoutMs);

  const tools = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
  const resources = Array.isArray(resourcesResult?.resources) ? resourcesResult.resources : [];

  const toolNames = tools.map(tool => tool?.name).filter(Boolean);
  const resourceUris = resources.map(resource => resource?.uri || resource?.uriTemplate).filter(Boolean);

  const missingTools = EXPECTED_TOOLS.filter(name => !toolNames.includes(name));
  const missingResources = EXPECTED_RESOURCES.filter(uri => !resourceUris.includes(uri));
  const counts = getSnapshotCounts(snapshotResult?.structuredContent || snapshotResult);

  if (missingTools.length || missingResources.length) {
    console.error('MCP smoke test failed');
    console.error(`Endpoint: ${endpoint}`);
    console.error(`Missing tools: ${missingTools.length ? missingTools.join(', ') : 'none'}`);
    console.error(`Missing resources: ${missingResources.length ? missingResources.join(', ') : 'none'}`);
    process.exitCode = 1;
    return;
  }

  console.log('MCP smoke test passed');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Auth: ${token ? 'token' : 'none'}`);
  console.log(`Tools: ${toolNames.length}/${EXPECTED_TOOLS.length}`);
  console.log(`Resources: ${resourceUris.length}/${EXPECTED_RESOURCES.length}`);
  console.log(
    `Snapshot counts: tasks=${counts.tasks}, people=${counts.people}, projects=${counts.projects}, statusColumns=${counts.statusColumns}`
  );
}

main().catch((error) => {
  console.error('MCP smoke test failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
