# Token Relay Provider SDK

Provider-side SDK and CLI for connecting subscription-backed local model CLIs
to Token Relay. The provider makes an outbound authenticated WebSocket
connection; the relay never receives the provider's model credentials.

Requires Node.js 22.13 or newer. The SDK is ESM-only; CommonJS applications
should load it with dynamic `import()`.

## Install and configure

```bash
npm install -g @anarkhli/provider-sdk
token-relay-provider version
```

Create `provider.config.json` in the directory where the Provider process will
run. Keep the one-time Provider token in an environment variable instead of
writing it into the file:

```json
{
  "relayUrl": "wss://relay.example.com/provider/v1/connect",
  "providerToken": "${TOKEN_RELAY_PROVIDER_TOKEN}",
  "concurrency": 1,
  "models": {
    "gpt-5.6-sol": {
      "adapter": "codex",
      "command": "codex",
      "cliModel": "gpt-5.6-sol"
    }
  }
}
```

```bash
export TOKEN_RELAY_PROVIDER_TOKEN='replace-with-provider-token'
token-relay-provider doctor --config provider.config.json
token-relay-provider start --config provider.config.json
```

The default endpoint is `ws://127.0.0.1:8787/provider/v1/connect`. Use `wss://`
outside a trusted local network.

Each model name advertised to the relay maps to a local `codex`, `claude`,
`aiden`, or custom executable. Set `cliModel` when the public relay model name
is an alias for a specific local CLI model; when omitted, built-in adapters use
that CLI's default model. Custom arguments are passed directly without a shell
and support `{model}`, `{workspace}`, `{promptFile}`, and `{outputFile}`
placeholders.

## SDK

```ts
import {
  ProviderClient,
  type ModelExecutor
} from "@anarkhli/provider-sdk";

const executor: ModelExecutor = {
  async execute(job, target, signal) {
    // A custom executor is useful for containers, remote workers, and tests.
    return {
      content: `Handled ${job.model} with ${target.adapter}`,
      finishReason: "stop",
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        estimated: true
      }
    };
  }
};

const client = new ProviderClient({
  relayUrl: "wss://relay.example.com/provider/v1/connect",
  providerToken: process.env.TOKEN_RELAY_PROVIDER_TOKEN,
  concurrency: 2,
  models: {
    "test-model": {
      adapter: "custom",
      command: "/usr/local/bin/my-agent"
    }
  }
}, { executor });

await client.start(); // resolves after the relay sends ready
// ...
await client.stop(); // aborts active jobs and closes the connection
```

## Execution safety

The built-in executor creates a new empty temporary workspace per job, writes
the prompt to a mode-0600 file, and attaches that file as non-TTY stdin. It
uses a small environment allowlist, direct process spawning without a shell,
timeouts, an output byte limit, process-group cancellation, and recursive
temporary-directory cleanup.

Codex uses a read-only sandbox, Claude uses plan permission mode, and Aiden
uses read-only mode. A custom executable is responsible for enforcing an
equivalent sandbox. For untrusted users, run the provider under a dedicated OS
account or container: local CLI authentication may still require access to the
provider account's home directory.
