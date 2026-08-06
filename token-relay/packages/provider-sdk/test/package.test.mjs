import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const providerDirectory = new URL("../", import.meta.url);
const protocolDirectory = new URL("../../protocol/", import.meta.url);

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("published package metadata matches the supported CLI contract", async () => {
  const providerManifest = await readJson(
    new URL("package.json", providerDirectory)
  );
  const protocolManifest = await readJson(
    new URL("package.json", protocolDirectory)
  );
  const providerReadme = await readFile(
    new URL("README.md", providerDirectory),
    "utf8"
  );
  const cli = await readFile(
    new URL("dist/cli.js", providerDirectory),
    "utf8"
  );
  const exampleConfig = await readJson(
    new URL("provider.config.example.json", providerDirectory)
  );
  const { PROVIDER_SDK_VERSION } = await import("../dist/version.js");

  assert.equal(providerManifest.name, "@anarkhli/provider-sdk");
  assert.equal(protocolManifest.name, "@anarkhli/protocol");
  assert.equal(
    providerManifest.dependencies["@anarkhli/protocol"],
    protocolManifest.version
  );
  assert.equal(PROVIDER_SDK_VERSION, providerManifest.version);
  assert.equal(
    providerManifest.bin["token-relay-provider"],
    "dist/cli.js"
  );
  assert.equal(providerManifest.publishConfig.access, "public");
  assert.equal(protocolManifest.publishConfig.access, "public");
  assert.match(providerManifest.scripts.prepack, /@anarkhli\/protocol/);
  assert.match(providerManifest.scripts.prepack, /npm run build/);
  assert.equal(protocolManifest.scripts.prepack, "npm run build");
  assert.ok(providerManifest.files.includes("LICENSE"));
  assert.ok(protocolManifest.files.includes("LICENSE"));
  assert.match(cli, /^#!\/usr\/bin\/env node\n/);
  assert.match(providerReadme, /npm install -g @anarkhli\/provider-sdk/);
  assert.match(providerReadme, /token-relay-provider version/);
  assert.doesNotMatch(providerReadme, /packages\/provider-sdk\/dist\/cli\.js/);
  assert.equal(exampleConfig.providerToken, "${TOKEN_RELAY_PROVIDER_TOKEN}");
  assert.deepEqual(exampleConfig.models["gpt-5.6-sol"], {
    adapter: "codex",
    command: "codex",
    cliModel: "gpt-5.6-sol"
  });
});
