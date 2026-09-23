// Fail-closed loopback static server for the NON_RELEASE DevTools smoke.
//
// Security properties:
//   - binds 127.0.0.1 only (refuses any other host);
//   - serves only regular files under --root, behind a required URL prefix;
//   - rejects path traversal ("..", NUL, backslash, encoded variants);
//   - rejects symlinks, directories (no listing) and paths escaping root;
//   - only GET/HEAD; everything else is 405;
//   - never opens outbound connections; no proxy, no redirects.

import { createServer } from "node:http";
import { lstatSync, readFile, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const LOOPBACK_HOST = "127.0.0.1";
export const DEFAULT_PREFIX = "/remote/";

const CONTENT_TYPES = new Map([
  [".json", "application/json; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".wasm", "application/wasm"],
  [".txt", "text/plain; charset=utf-8"],
  [".bin", "application/octet-stream"],
  [".pvr", "application/octet-stream"],
  [".pkm", "application/octet-stream"],
  [".astc", "application/octet-stream"],
]);

export class LoopbackServerError extends Error {
  constructor(code, details = []) {
    super(code);
    this.name = "LoopbackServerError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, ...details) {
  throw new LoopbackServerError(code, details);
}

function extType(path) {
  const match = /(?:^|\/)[^/]*(\.[^.\/]+)$/.exec(path);
  const ext = match?.[1]?.toLowerCase() ?? "";
  return CONTENT_TYPES.get(ext) ?? "application/octet-stream";
}

// Decide whether a decoded URL path is safe to join under root.
// Returns the absolute candidate path, or null if the request must be refused.
function resolveUnderRoot(rootReal, prefix, urlPath) {
  if (!urlPath.startsWith(prefix)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.slice(prefix.length));
  } catch {
    return null; // malformed percent-encoding
  }
  if (
    decoded.length === 0
    || decoded.includes("\0")
    || decoded.includes("\\")
    || decoded.split("/").includes("..")
  ) {
    return null;
  }
  const candidate = resolve(join(rootReal, decoded));
  const rel = relative(rootReal, candidate);
  if (rel === ".." || rel.startsWith(`..${sep}`) || resolve(candidate) === sep) {
    return null;
  }
  return candidate;
}

function send(response, status, body = "", headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(body);
}

export function createLoopbackServer({
  root,
  port,
  prefix = DEFAULT_PREFIX,
  host = LOOPBACK_HOST,
  log = () => {},
} = {}) {
  if (host !== LOOPBACK_HOST && host !== "::1") {
    fail("loopback-host-required", host);
  }
  if (typeof root !== "string" || root.length === 0) {
    fail("loopback-root-required");
  }
  const rootReal = realpathSync(root);
  let rootStat;
  try {
    rootStat = lstatSync(rootReal);
  } catch {
    fail("loopback-root-missing", root);
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    fail("loopback-root-directory-required", root);
  }
  if (!prefix.startsWith("/") || !prefix.endsWith("/") || prefix.includes("\0")) {
    fail("loopback-prefix-invalid", prefix);
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    fail("loopback-port-invalid", String(port));
  }

  const server = createServer((request, response) => {
    const { method } = request;
    if (method !== "GET" && method !== "HEAD") {
      log(method, request.url, 405);
      send(response, 405, "method not allowed\n", {
        "Content-Type": "text/plain; charset=utf-8",
        Allow: "GET, HEAD",
      });
      return;
    }
    const urlPath = request.url.split("#")[0].split("?")[0];
    const candidate = resolveUnderRoot(rootReal, prefix, urlPath);
    if (candidate === null) {
      log(method, request.url, 403);
      send(response, 403, "forbidden\n", {
        "Content-Type": "text/plain; charset=utf-8",
      });
      return;
    }
    let stat;
    try {
      stat = lstatSync(candidate);
    } catch {
      log(method, request.url, 404);
      send(response, 404, "not found\n", {
        "Content-Type": "text/plain; charset=utf-8",
      });
      return;
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      // No symlink following, no directory listing.
      log(method, request.url, 403);
      send(response, 403, "forbidden\n", {
        "Content-Type": "text/plain; charset=utf-8",
      });
      return;
    }
    // Re-check containment after stat (defence in depth).
    const rel = relative(rootReal, candidate);
    if (rel === ".." || rel.startsWith(`..${sep}`)) {
      log(method, request.url, 403);
      send(response, 403, "forbidden\n", {
        "Content-Type": "text/plain; charset=utf-8",
      });
      return;
    }
    log(method, request.url, 200);
    if (method === "HEAD") {
      send(response, 200, "", {
        "Content-Type": extType(candidate),
        "Content-Length": String(stat.size),
      });
      return;
    }
    readFile(candidate, (error, bytes) => {
      if (error) {
        send(response, 404, "not found\n", {
          "Content-Type": "text/plain; charset=utf-8",
        });
        return;
      }
      send(response, 200, bytes, {
        "Content-Type": extType(candidate),
        "Content-Length": String(stat.size),
      });
    });
  });

  let address = null;
  server.on("error", (error) => {
    // Post-listen errors are fatal for a smoke server; never serve silently.
    process.stderr.write(`server error: ${error.message}\n`);
    process.exitCode = 1;
  });
  const listen = () => new Promise((resolvePromise, rejectPromise) => {
    const onError = (error) => rejectPromise(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      address = server.address();
      if (!address || address.address !== host) {
        rejectPromise(new LoopbackServerError("loopback-bind-unexpected", [
          `bound=${address?.address ?? "unknown"}`,
        ]));
        return;
      }
      resolvePromise();
    });
  });

  const close = () => new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });

  return {
    server,
    listen,
    close,
    get address() {
      return address;
    },
    rootReal,
    prefix,
  };
}

function parseCli(argv) {
  const options = { prefix: DEFAULT_PREFIX, host: LOOPBACK_HOST };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = argv[++index];
      continue;
    }
    if (arg === "--port") {
      options.port = Number.parseInt(argv[++index], 10);
      continue;
    }
    if (arg === "--prefix") {
      options.prefix = argv[++index];
      continue;
    }
    if (arg === "--host") {
      options.host = argv[++index];
      continue;
    }
    fail("loopback-cli-unsupported-argument", arg);
  }
  if (!options.root || options.port === undefined) {
    fail("loopback-cli-usage", "usage: --root DIR --port PORT [--prefix /remote/] [--host 127.0.0.1]");
  }
  return options;
}

function isMainModule() {
  return Boolean(process.argv[1])
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  let instance;
  const shutdown = () => {
    if (!instance) process.exit(0);
    instance.close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  try {
    const options = parseCli(process.argv.slice(2));
    instance = createLoopbackServer({
      ...options,
      log: (method, url, status) => {
        process.stderr.write(`${method} ${url} -> ${status}\n`);
      },
    });
    instance.listen().then(() => {
      process.stdout.write(JSON.stringify({
        ok: true,
        label: "LOOPBACK_SERVER_LISTENING",
        host: instance.address.address,
        port: instance.address.port,
        root: instance.rootReal,
        prefix: options.prefix,
      }) + "\n");
    }).catch((error) => {
      const code = error instanceof LoopbackServerError
        ? error.code
        : "loopback-listen-failed";
      process.stderr.write(JSON.stringify({
        ok: false,
        code,
        details: error instanceof LoopbackServerError ? error.details : [String(error)],
      }, null, 2) + "\n");
      process.exitCode = 1;
    });
  } catch (error) {
    const code = error instanceof LoopbackServerError
      ? error.code
      : "loopback-server-failed";
    process.stderr.write(JSON.stringify({
      ok: false,
      code,
      details: error instanceof LoopbackServerError ? error.details : [String(error)],
    }, null, 2) + "\n");
    process.exitCode = 1;
  }
}
