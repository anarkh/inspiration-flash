import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveRelayServerOptions } from "../apps/relay-server/dist/config.js";

const ADMIN_TOKEN = "test-only-admin-token-not-a-secret";

test("initial user points default to 100000 and the example environment agrees", async () => {
  const options = resolveRelayServerOptions({}, {
    TOKEN_RELAY_ADMIN_TOKEN: ADMIN_TOKEN
  });
  assert.equal(options.initialUserPoints, 100_000);

  const example = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8"
  );
  assert.match(example, /^TOKEN_RELAY_INITIAL_POINTS=100000$/m);
  assert.doesNotMatch(example, /WECHAT|APP_ID|APP_SECRET/);
});

test("initial user points accept an explicit non-negative safe integer", () => {
  assert.equal(
    resolveRelayServerOptions({}, {
      TOKEN_RELAY_ADMIN_TOKEN: ADMIN_TOKEN,
      TOKEN_RELAY_INITIAL_POINTS: "250000"
    }).initialUserPoints,
    250_000
  );
  assert.equal(
    resolveRelayServerOptions({ initialUserPoints: 0 }, {
      TOKEN_RELAY_ADMIN_TOKEN: ADMIN_TOKEN,
      TOKEN_RELAY_INITIAL_POINTS: "250000"
    }).initialUserPoints,
    0
  );
});

test("initial user points reject invalid or unsafe values", () => {
  for (const value of ["-1", "1.5", "not-a-number", "9007199254740992"]) {
    assert.throws(
      () => resolveRelayServerOptions({}, {
        TOKEN_RELAY_ADMIN_TOKEN: ADMIN_TOKEN,
        TOKEN_RELAY_INITIAL_POINTS: value
      }),
      /TOKEN_RELAY_INITIAL_POINTS must be a non-negative safe integer/
    );
  }
});
