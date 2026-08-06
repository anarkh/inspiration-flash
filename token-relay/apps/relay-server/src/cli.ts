#!/usr/bin/env node
import { createRelayServer } from "./server.ts";

const app = await createRelayServer();
const address = await app.listen();
console.log(`Token Relay listening at ${app.url}`);
console.log(`User portal: ${app.url}/`);
console.log(`Model catalog: ${app.url}/models`);
console.log(`Admin dashboard: ${app.url}/admin`);
console.log("Account authentication: username and password");
console.log(`Provider WebSocket: ws://${address.host}:${address.port}/provider/v1/connect`);

let stopping = false;
const stop = async (signal: string) => {
  if (stopping) {
    return;
  }
  stopping = true;
  console.log(`Received ${signal}; stopping Token Relay.`);
  try {
    await app.close();
    process.exitCode = 0;
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => {
  void stop("SIGINT");
});
process.once("SIGTERM", () => {
  void stop("SIGTERM");
});
