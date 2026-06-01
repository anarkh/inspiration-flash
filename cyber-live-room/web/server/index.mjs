#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { loadState, saveState } from "./state-store.mjs";
import { callModel } from "./provider-adapters.mjs";

const rootDir = normalize(join(fileURLToPath(import.meta.url), "..", ".."));
const port = Number(process.env.PORT || 52330);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/api/health" && req.method === "GET") {
      return sendJSON(res, 200, { ok: true });
    }

    if (req.url === "/api/state" && req.method === "GET") {
      return sendJSON(res, 200, await loadState());
    }

    if (req.url === "/api/state" && req.method === "PUT") {
      const state = await readJSON(req);
      await saveState(state);
      return sendJSON(res, 200, { ok: true });
    }

    if (req.url === "/api/model" && req.method === "POST") {
      const payload = await readJSON(req);
      const text = await callModel(payload.model, payload.context, payload.peerMessages || []);
      return sendJSON(res, 200, { text });
    }

    if (req.url?.startsWith("/api/")) {
      return sendJSON(res, 404, { error: "Unknown API route." });
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJSON(res, 500, { error: error.message || "Internal server error." });
  }
});

server.listen(port, host, () => {
  console.log(`Cyber Live Room is running at http://${host}:${port}/`);
});

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const rawPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const normalizedPath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(rootDir, normalizedPath);

  if (!filePath.startsWith(rootDir)) {
    return sendText(res, 403, "Forbidden");
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(content);
  } catch (error) {
    sendText(res, 404, "Not found");
  }
}

async function readJSON(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(text);
}
