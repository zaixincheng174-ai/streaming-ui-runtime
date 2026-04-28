#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

const streamingTargetFilePath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_streaming_chat_baseline.html", import.meta.url)
);
const reactSanityTargetFilePath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_production_react_sanity.html", import.meta.url)
);
const sendFlushFanoutTargetFilePath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_send_flush_fanout_baseline.html", import.meta.url)
);
const workerFlushFanoutTargetFilePath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_worker_flush_fanout_baseline.html", import.meta.url)
);
const workerSchedulerProjectionTargetFilePath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_worker_scheduler_projection_baseline.html", import.meta.url)
);
const reactVendorFilePaths = {
  "/vendor/react18/react.production.min.js": fileURLToPath(
    new URL("../../bench/p1/vendor/react18/react.production.min.js", import.meta.url)
  ),
  "/vendor/react18/react-dom.production.min.js": fileURLToPath(
    new URL("../../bench/p1/vendor/react18/react-dom.production.min.js", import.meta.url)
  )
};

function usage() {
  console.log(`Usage:
  node scripts/p1/serve_p1_streaming_baselines.mjs [--host 127.0.0.1] [--port 4319]

Serves:
  /p1_streaming_chat_baseline.html
  /p1_production_react_sanity.html
  /p1_send_flush_fanout_baseline.html
  /p1_worker_flush_fanout_baseline.html
  /p1_worker_scheduler_projection_baseline.html
  /vendor/react18/react.production.min.js
  /vendor/react18/react-dom.production.min.js
  / as an alias for /p1_streaming_chat_baseline.html`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let host = "127.0.0.1";
  let port = 4319;

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
const streamingTargetHtml = fs.readFileSync(streamingTargetFilePath);
const reactSanityTargetHtml = fs.readFileSync(reactSanityTargetFilePath);
const sendFlushFanoutTargetHtml = fs.readFileSync(sendFlushFanoutTargetFilePath);
const workerFlushFanoutTargetHtml = fs.readFileSync(workerFlushFanoutTargetFilePath);
const workerSchedulerProjectionTargetHtml = fs.readFileSync(workerSchedulerProjectionTargetFilePath);
const reactVendorFiles = Object.fromEntries(
  Object.entries(reactVendorFilePaths).map(([route, filePath]) => [route, fs.readFileSync(filePath)])
);

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

function serveJavaScript(request, response, body) {
  response.writeHead(200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Content-Length": String(body.byteLength),
    "Cache-Control": "no-store"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(body);
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
      "Location": "/p1_streaming_chat_baseline.html",
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  if (requestUrl.pathname === "/p1_streaming_chat_baseline.html") {
    serveHtml(request, response, streamingTargetHtml);
    return;
  }

  if (requestUrl.pathname === "/p1_production_react_sanity.html") {
    serveHtml(request, response, reactSanityTargetHtml);
    return;
  }

  if (requestUrl.pathname === "/p1_send_flush_fanout_baseline.html") {
    serveHtml(request, response, sendFlushFanoutTargetHtml);
    return;
  }

  if (requestUrl.pathname === "/p1_worker_flush_fanout_baseline.html") {
    serveHtml(request, response, workerFlushFanoutTargetHtml);
    return;
  }

  if (requestUrl.pathname === "/p1_worker_scheduler_projection_baseline.html") {
    serveHtml(request, response, workerSchedulerProjectionTargetHtml);
    return;
  }

  if (Object.hasOwn(reactVendorFiles, requestUrl.pathname)) {
    serveJavaScript(request, response, reactVendorFiles[requestUrl.pathname]);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found\n");
});

server.listen(port, host, () => {
  console.log("P1-A streaming baseline target server is running.");
  console.log(`URL: http://${host}:${port}/p1_streaming_chat_baseline.html`);
  console.log(`React sanity URL: http://${host}:${port}/p1_production_react_sanity.html`);
  console.log(`P1-F0 send/flush fanout URL: http://${host}:${port}/p1_send_flush_fanout_baseline.html`);
  console.log(`P1-F1 worker flush fanout URL: http://${host}:${port}/p1_worker_flush_fanout_baseline.html`);
  console.log(`P1-F2 worker scheduler projection URL: http://${host}:${port}/p1_worker_scheduler_projection_baseline.html`);
  console.log(`P1-A target file: ${streamingTargetFilePath}`);
  console.log(`P1 production-react-sanity target file: ${reactSanityTargetFilePath}`);
  console.log(`P1-F0 send/flush fanout target file: ${sendFlushFanoutTargetFilePath}`);
  console.log(`P1-F1 worker flush fanout target file: ${workerFlushFanoutTargetFilePath}`);
  console.log(`P1-F2 worker scheduler projection target file: ${workerSchedulerProjectionTargetFilePath}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
