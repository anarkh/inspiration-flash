import test from "node:test";
import assert from "node:assert/strict";
import { bridgeGateTimeoutMs, BRIDGE_GATE_TIMEOUT_ENV } from "../../src/core/constants.ts";

test("bridge gate timeout defaults to ten minutes", () => {
  const previous = process.env[BRIDGE_GATE_TIMEOUT_ENV];
  try {
    delete process.env[BRIDGE_GATE_TIMEOUT_ENV];
    assert.equal(bridgeGateTimeoutMs(), 10 * 60 * 1000);
  } finally {
    if (previous === undefined) {
      delete process.env[BRIDGE_GATE_TIMEOUT_ENV];
    } else {
      process.env[BRIDGE_GATE_TIMEOUT_ENV] = previous;
    }
  }
});

test("bridge gate timeout still accepts an environment override", () => {
  const previous = process.env[BRIDGE_GATE_TIMEOUT_ENV];
  try {
    process.env[BRIDGE_GATE_TIMEOUT_ENV] = "1234";
    assert.equal(bridgeGateTimeoutMs(), 1234);
  } finally {
    if (previous === undefined) {
      delete process.env[BRIDGE_GATE_TIMEOUT_ENV];
    } else {
      process.env[BRIDGE_GATE_TIMEOUT_ENV] = previous;
    }
  }
});
