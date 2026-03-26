#!/usr/bin/env node

const Store = require('electron-store');
const { createRequestDispatcher } = require('../services/mcp-http-server.cjs');

const storeName = process.env.PLUMY_STORE_NAME || (process.env.NODE_ENV === 'development' ? 'plumy-store-dev' : 'plumy-store');
const store = new Store({ name: storeName });
const dispatch = createRequestDispatcher(store);

let buffer = '';

function writeJson(payload) {
  if (payload === null || payload === undefined) return;
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function handleMessage(rawMessage) {
  if (!rawMessage) return;

  let request;
  try {
    request = JSON.parse(rawMessage);
  } catch (_error) {
    writeJson({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    });
    return;
  }

  if (Array.isArray(request)) {
    for (const item of request) {
      const response = dispatch(item, { transport: 'stdio' });
      writeJson(response);
    }
    return;
  }

  const response = dispatch(request, { transport: 'stdio' });
  writeJson(response);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf('\n');
  while (newlineIndex >= 0) {
    const rawLine = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    handleMessage(rawLine);
    newlineIndex = buffer.indexOf('\n');
  }
});

process.stdin.on('end', () => {
  const trailing = buffer.trim();
  if (trailing) {
    handleMessage(trailing);
  }
});

process.stdin.resume();
