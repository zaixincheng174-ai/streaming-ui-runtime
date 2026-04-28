#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

const p0eReferenceFilePath = fileURLToPath(
  new URL("../../bench/p0/targets/controlled_batch_commit_surface.html", import.meta.url)
);
const p0fProxyBaselineFilePath = fileURLToPath(
  new URL("../../bench/p0f/targets/p0f_proxy_baseline_surface.html", import.meta.url)
);

function usage() {
  console.log(`Usage:
  node scripts/p0f/serve_p0f_proxy_baselines.mjs [--host 127.0.0.1] [--port 4318]

Serves:
  /p0e-reference.html
  /p0f_proxy_baseline_surface.html
  / as an alias for /p0f_proxy_baseline_surface.html`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let host = "127.0.0.1";
  let port = 4318;

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
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  return { host, port };
}

const { host, port } = parseArgs(process.argv.slice(2));
const p0eReferenceHtml = fs.readFileSync(p0eReferenceFilePath);
const p0fProxyBaselineHtml = fs.readFileSync(p0fProxyBaselineFilePath);

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
      "Location": "/p0f_proxy_baseline_surface.html",
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  if (requestUrl.pathname === "/p0e-reference.html") {
    serveHtml(request, response, p0eReferenceHtml);
    return;
  }

  if (requestUrl.pathname === "/p0f_proxy_baseline_surface.html") {
    serveHtml(request, response, p0fProxyBaselineHtml);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found\n");
});

server.listen(port, host, () => {
  console.log("P0-F proxy baseline target server is running.");
  console.log(`URL: http://${host}:${port}/p0f_proxy_baseline_surface.html`);
  console.log(`P0-E reference URL: http://${host}:${port}/p0e-reference.html`);
  console.log(`P0-F proxy target file: ${p0fProxyBaselineFilePath}`);
  console.log(`P0-E reference file: ${p0eReferenceFilePath}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
