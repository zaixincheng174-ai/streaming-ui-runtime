#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

const targetFilePath = fileURLToPath(
  new URL("../../bench/p0/targets/controlled_append_surface.html", import.meta.url)
);
const batchTargetFilePath = fileURLToPath(
  new URL("../../bench/p0/targets/controlled_batch_commit_surface.html", import.meta.url)
);
const validLevels = new Set(["L1", "L2", "L3", "L4"]);
const p0dParamNames = new Set([
  "cell_id",
  "seed_blocks",
  "chars_per_block",
  "append_interval_ms",
  "capture_window_s",
  "block_style"
]);

function usage() {
  console.log(`Usage:
  node scripts/p0/serve_controlled_target.mjs [--host 127.0.0.1] [--port 4317] [--default-level L1]

Serves:
  /controlled_append_surface.html?level=L1|L2|L3|L4
  /controlled_append_surface.html?seed_blocks=...&chars_per_block=...&append_interval_ms=...&capture_window_s=...&block_style=plain
  /controlled_batch_commit_surface.html?block_count=...&chars_per_block=...&operation_type=dom-text-scan&microtask_mode=true|false&mutation_mode=...
  / as an alias for the configured default level`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let host = "127.0.0.1";
  let port = 4317;
  let defaultLevel = "L1";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host") {
      host = argv[index + 1];
      index += 1;
    } else if (arg === "--port") {
      const parsedPort = Number(argv[index + 1]);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        fail(`invalid --port value: ${argv[index + 1]}`);
      }
      port = parsedPort;
      index += 1;
    } else if (arg === "--default-level") {
      const level = String(argv[index + 1] || "").toUpperCase();
      if (!validLevels.has(level)) {
        fail(`invalid --default-level value: ${argv[index + 1]}`);
      }
      defaultLevel = level;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  return { host, port, defaultLevel };
}

const { host, port, defaultLevel } = parseArgs(process.argv.slice(2));
const appendHtml = fs.readFileSync(targetFilePath);
const batchHtml = fs.readFileSync(batchTargetFilePath);

function hasP0dParams(searchParams) {
  for (const name of p0dParamNames) {
    if (searchParams.has(name)) {
      return true;
    }
  }
  return false;
}

function serveHtml(request, response, html) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": String(html.byteLength),
    "Cache-Control": "no-store"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(html);
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad Request\n");
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "GET, HEAD"
    });
    response.end("Method Not Allowed\n");
    return;
  }

  const requestUrl = new URL(request.url, `http://${host}:${port}`);

  if (requestUrl.pathname === "/") {
    response.writeHead(302, {
      "Location": `/controlled_append_surface.html?level=${defaultLevel}`,
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  if (requestUrl.pathname === "/controlled_batch_commit_surface.html") {
    serveHtml(request, response, batchHtml);
    return;
  }

  if (requestUrl.pathname !== "/controlled_append_surface.html") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found\n");
    return;
  }

  if (hasP0dParams(requestUrl.searchParams)) {
    serveHtml(request, response, appendHtml);
    return;
  }

  const level = (requestUrl.searchParams.get("level") || defaultLevel).toUpperCase();
  if (!validLevels.has(level)) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Invalid level\n");
    return;
  }

  if (!requestUrl.searchParams.has("level")) {
    response.writeHead(302, {
      "Location": `/controlled_append_surface.html?level=${level}`,
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  serveHtml(request, response, appendHtml);
});

server.listen(port, host, () => {
  console.log("Controlled local target server is running.");
  console.log(`Default level: ${defaultLevel}`);
  console.log(`URL: http://${host}:${port}/controlled_append_surface.html?level=${defaultLevel}`);
  console.log(`Batch URL: http://${host}:${port}/controlled_batch_commit_surface.html`);
  console.log(`Alias: http://${host}:${port}/`);
  console.log(`Target file: ${targetFilePath}`);
  console.log(`Batch target file: ${batchTargetFilePath}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
