#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  open,
  opendir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, stop as stopEsbuild } from 'esbuild';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const heroWalkLayout = JSON.parse(await readFile(path.join(projectDir, 'art-source/hero-redesign/proof/production-frame-layout.json'), 'utf8'));
const cocosDir = path.join(projectDir, 'cocos');
const buildDir = path.join(cocosDir, 'build', 'web-mobile');
const artifactRootDir = path.join(cocosDir, 'build', 'web-mobile-canvas-smoke');
const designViewport = Object.freeze({ width: 750, height: 1334 });
const courtyardVisualKeys = Object.freeze([
  'scene:hub_courtyard_walk', 'scene:hub_dungeon_portal', 'scene:courtyard_altar', 'scene:courtyard_lamp',
  'scene:courtyard_crate', 'scene:courtyard_pillar',
]);
const courtyardTargetPositions = Object.freeze({
  'npc:equipment': { x: 160, y: 636 },
  'npc:supplies': { x: 290, y: 466 },
  'npc:pets': { x: 430, y: 636 },
  'npc:methods': { x: 570, y: 466 },
  'npc:bloodlines': { x: 710, y: 636 },
  'npc:companions': { x: 850, y: 466 },
  'npc:tasks': { x: 990, y: 636 },
  'portal:entry': { x: 1080, y: 466 },
});
const smokeArguments = process.argv.slice(2);
const carryOnly = smokeArguments.includes('--carry-only');
const combatOnly = smokeArguments.includes('--combat-only');
const dungeonOnly = smokeArguments.includes('--dungeon-only');
const compactFlow = combatOnly || dungeonOnly;
const focusedFlow = carryOnly || compactFlow;
const scope = carryOnly ? 'carry-only' : combatOnly ? 'combat-only' : dungeonOnly ? 'dungeon-only' : 'full';
const viewportArguments = smokeArguments.filter(argument => !['--carry-only', '--combat-only', '--dungeon-only'].includes(argument));
if ([carryOnly, combatOnly, dungeonOnly].filter(Boolean).length > 1 || viewportArguments.length > 1 || (viewportArguments.length === 1
  && !/^--viewport=(?:750x1334|320x568|390x844)$/u.test(viewportArguments[0]))) {
  throw new Error('Usage: node scripts/web-mobile-canvas.smoke.mjs [--viewport=750x1334|--viewport=320x568|--viewport=390x844] [--carry-only|--combat-only|--dungeon-only]');
}
const [viewportWidth, viewportHeight] = (viewportArguments[0]?.split('=')[1] ?? '750x1334').split('x').map(Number);
const viewport = Object.freeze({ width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1 });
const commandTimeoutMs = 30_000;
const stateTimeoutMs = 60_000;
const requiredBuildFiles = Object.freeze([
  'index.html',
  'index.js',
  'application.js',
  'style.css',
  'src/import-map.json',
  'src/settings.json',
  'assets/main/config.json',
]);
const chromeCandidates = Object.freeze([
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean));
const mimeTypes = Object.freeze({
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
});

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function processGroupSpawnOptions() {
  return process.platform === 'win32' ? {} : { detached: true };
}

function hasProcessExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function signalProcessTree(child, signal) {
  if (!child?.pid) return;
  try {
    process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') child.kill(signal);
  }
}

function waitForProcessExitOrClose(child, timeoutMs) {
  if (!child || hasProcessExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off('exit', onDone);
      child.off('close', onDone);
      resolve(result);
    };
    const onDone = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', onDone);
    child.once('close', onDone);
  });
}

async function stopProcess(child) {
  if (!child || hasProcessExited(child)) return;
  const termWait = waitForProcessExitOrClose(child, 2_000);
  signalProcessTree(child, 'SIGTERM');
  if (await termWait) return;
  const killWait = waitForProcessExitOrClose(child, 2_000);
  signalProcessTree(child, 'SIGKILL');
  await killWait;
  child.stdout?.destroy();
  child.stderr?.destroy();
}

async function listFiles(directory) {
  const files = [];
  const entries = await opendir(directory);
  for await (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(candidate));
    else if (entry.isFile()) files.push(candidate);
  }
  return files;
}

async function assertFreshBuild() {
  const entryPath = path.join(buildDir, 'index.html');
  for (const relativePath of requiredBuildFiles) {
    const target = path.join(buildDir, relativePath);
    let targetStat;
    try {
      targetStat = await stat(target);
    } catch {
      throw new Error(
        `Web Mobile build is incomplete: ${path.relative(projectDir, target)} is missing. `
        + 'Build cocos/ for the web-mobile platform before running this smoke.',
      );
    }
    if (!targetStat.isFile() || targetStat.size === 0) {
      throw new Error(`Web Mobile build entry is empty: ${path.relative(projectDir, target)}`);
    }
  }

  const indexMarkup = await readFile(entryPath, 'utf8');
  for (const marker of ['id="GameCanvas"', 'src="src/import-map.json"', "System.import('./index.js')"]) {
    if (!indexMarkup.includes(marker)) {
      throw new Error(`Web Mobile index.html is not a runnable Cocos entry; missing ${JSON.stringify(marker)}.`);
    }
  }

  const inputFiles = [
    ...await listFiles(path.join(cocosDir, 'assets')),
    ...await listFiles(path.join(cocosDir, 'settings')),
    path.join(cocosDir, 'package.json'),
  ];
  const inputStats = await Promise.all(inputFiles.map(async (file) => ({ file, value: await stat(file) })));
  const newestInput = inputStats.reduce((latest, candidate) => (
    candidate.value.mtimeMs > latest.value.mtimeMs ? candidate : latest
  ));
  const entryStat = await stat(entryPath);
  if (newestInput.value.mtimeMs > entryStat.mtimeMs) {
    throw new Error(
      `Web Mobile entry is stale: ${path.relative(projectDir, newestInput.file)} `
      + `(${newestInput.value.mtime.toISOString()}) is newer than cocos/build/web-mobile/index.html `
      + `(${entryStat.mtime.toISOString()}). Rebuild with Cocos Creator before running the smoke.`,
    );
  }

  return Object.freeze({
    entryPath,
    entryModifiedAt: entryStat.mtime.toISOString(),
    newestInput: path.relative(projectDir, newestInput.file),
    newestInputModifiedAt: newestInput.value.mtime.toISOString(),
  });
}

function resolveRequestPath(requestUrl) {
  const pathname = new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const relativePath = decoded === '/' ? '/index.html' : decoded;
  const candidate = path.resolve(buildDir, `.${relativePath}`);
  if (candidate !== buildDir && !candidate.startsWith(`${buildDir}${path.sep}`)) return undefined;
  return candidate;
}

async function serveRequest(request, response) {
  let target = resolveRequestPath(request.url);
  if (target === undefined) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  let targetStat;
  try {
    targetStat = await stat(target);
    if (targetStat.isDirectory()) {
      target = path.join(target, 'index.html');
      targetStat = await stat(target);
    }
  } catch {
    if (new URL(request.url ?? '/', 'http://127.0.0.1').pathname === '/favicon.ico') {
      response.writeHead(204, { 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Not found');
    return;
  }

  if (!targetStat.isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Not found');
    return;
  }

  const contentType = mimeTypes[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': targetStat.size,
    'Content-Type': contentType,
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(target);
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

async function startStaticServer() {
  const server = http.createServer((request, response) => {
    void serveRequest(request, response).catch((error) => {
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal server error');
      } else {
        response.destroy(error instanceof Error ? error : undefined);
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Static server did not allocate a TCP port.');
  }
  return Object.freeze({ server, url: `http://127.0.0.1:${address.port}/` });
}

async function stopStaticServer(server) {
  if (!server?.listening) return;
  server.closeIdleConnections?.();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function findOnPath(binaryNames) {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const binaryName of binaryNames) {
      const candidate = path.join(directory, binaryName);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function findChrome() {
  for (const candidate of chromeCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  return findOnPath(['google-chrome', 'chromium', 'chromium-browser', 'chrome']);
}

function captureChildOutput(child) {
  let output = '';
  const append = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-24_000);
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  return () => output.trim();
}

async function waitForDevToolsPort(profileDir, child, getOutput) {
  const activePortPath = path.join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (hasProcessExited(child)) {
      throw new Error(
        `Chrome exited before DevTools became ready (code=${child.exitCode}, signal=${child.signalCode}).\n`
        + (getOutput() || '(no Chrome output)'),
      );
    }
    try {
      const [portText] = (await readFile(activePortPath, 'utf8')).trim().split(/\r?\n/);
      const port = Number(portText);
      if (Number.isInteger(port) && port > 0 && port < 65_536) return port;
      lastError = new Error(`invalid dynamic port ${JSON.stringify(portText)}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chrome DevToolsActivePort: ${formatError(lastError)}\n${getOutput()}`);
}

async function waitForJson(url, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${formatError(lastError)}`);
}

class CdpSession {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.webSocket = new WebSocket(webSocketUrl);
  }

  async open() {
    await Promise.race([
      new Promise((resolve, reject) => {
        this.webSocket.addEventListener('open', resolve, { once: true });
        this.webSocket.addEventListener('error', reject, { once: true });
      }),
      delay(commandTimeoutMs).then(() => {
        throw new Error('Timed out opening the Chrome DevTools WebSocket.');
      }),
    ]);
    this.webSocket.addEventListener('message', (event) => {
      const payload = typeof event.data === 'string'
        ? event.data
        : Buffer.from(event.data).toString('utf8');
      const message = JSON.parse(payload);
      if (!message.id) {
        this.events.push(message);
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${message.error.message} (${pending.method})`));
      else pending.resolve(message.result);
    });
    this.webSocket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`Chrome DevTools WebSocket closed during ${pending.method}.`));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for Chrome DevTools method ${method}.`));
      }, commandTimeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
    });
    this.webSocket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.webSocket.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(detail);
  }
  return result.result.value;
}

const sceneSnapshotExpression = String.raw`(async () => {
  const cc = await System.import('cc');
  const scene = cc.director.getScene();
  if (!scene) return { ready: false, reason: 'scene unavailable' };
  const all = [];
  const walk = (node, output) => {
    output.push(node);
    for (const child of node.children) walk(child, output);
  };
  walk(scene, all);
  const roots = all.filter((node) => node.name === 'InfiniteFlowRuntimeView' && node.activeInHierarchy);
  const root = roots.at(-1);
  if (!root) return { ready: false, reason: 'runtime root unavailable' };
  const app = all.map((node) => node.getComponent('InfiniteFlowApp')).find(Boolean);
  const nodes = [];
  walk(root, nodes);
  const exact = (name) => nodes.find((node) => node.name === name && node.activeInHierarchy);
  const matching = (prefix) => nodes.filter((node) => node.name.startsWith(prefix) && node.activeInHierarchy);
  const label = (name) => exact(name)?.getComponent(cc.Label)?.string;
  const box = (node) => {
    const transform = node?.getComponent(cc.UITransform);
    return node && transform ? {
      x: node.position.x, y: node.position.y,
      width: transform.contentSize.width, height: transform.contentSize.height,
    } : undefined;
  };
  const canvas = document.querySelector('canvas');
  const camera = all.map((node) => node.getComponent(cc.Camera)).find(Boolean);
  const screenBox = (node) => {
    const transform = node?.getComponent(cc.UITransform);
    if (!node || !transform || !camera || !canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    const corners = [[-1, -1], [1, 1]].map(([x, y]) => {
      const world = transform.convertToWorldSpaceAR(new cc.Vec3(
        x * transform.contentSize.width / 2, y * transform.contentSize.height / 2, 0,
      ));
      const point = new cc.Vec3();
      camera.worldToScreen(world, point);
      return { x: rect.left + point.x / canvas.width * rect.width,
        y: rect.top + (canvas.height - point.y) / canvas.height * rect.height };
    });
    return { left: Math.min(...corners.map(({ x }) => x)), right: Math.max(...corners.map(({ x }) => x)),
      top: Math.min(...corners.map(({ y }) => y)), bottom: Math.max(...corners.map(({ y }) => y)) };
  };
  const text = (node) => {
    if (!node) return undefined;
    const descendants = [];
    walk(node, descendants);
    return descendants.map((item) => item.getComponent(cc.Label)?.string).filter(Boolean).join(' | ');
  };
  const control = (name) => {
    const node = exact(name);
    return {
      present: Boolean(node), box: box(node), screen: screenBox(node),
      touchable: Boolean(node?.hasEventListener(cc.Node.EventType.TOUCH_START)
        && node?.hasEventListener(cc.Node.EventType.TOUCH_END)),
      text: text(node),
    };
  };
  const frameInfo = (frame) => frame ? {
    uuid: frame.uuid,
    registeredResourceKeys: [
      ...Array.from(app?.view?.sceneVisuals ?? [], ([key, value]) => value.frame === frame ? key : undefined),
      ...Array.from(app?.sheetFigureLeases ?? [], ([key, value]) => value.frame === frame ? key : undefined),
      app?.view?.visualFrame === frame ? app?.desiredVisualKey : undefined,
    ].filter((key) => key !== undefined),
    imageUuid: frame.texture?.image?.uuid,
    rect: { x: frame.rect.x, y: frame.rect.y, width: frame.rect.width, height: frame.rect.height },
    textureWidth: frame.texture?.width, textureHeight: frame.texture?.height,
    originalSize: frame.originalSize ? { width: frame.originalSize.width, height: frame.originalSize.height } : undefined,
    offset: frame.offset ? { x: frame.offset.x, y: frame.offset.y } : undefined,
    packable: frame.packable,
    loaded: Boolean(frame.texture),
    valid: frame.isValid === true && frame.texture?.isValid === true,
  } : undefined;
  const nodeFrames = (node) => {
    const descendants = [];
    if (node) walk(node, descendants);
    return descendants.map((item) => ({ name: item.name, frame: frameInfo(item.getComponent(cc.Sprite)?.spriteFrame) }))
      .filter((item) => item.frame !== undefined);
  };
  const bodySprite = exact('WalkPlayerBody')?.getComponent(cc.Sprite);
  const atlas = app?.view?.sceneVisuals?.get('character:reincarnator_walk');
  const frames = atlas?.frames ?? [];
  const detail = app?.viewModel?.sections?.[1]?.detail;
  const metrics = app?.viewModel?.sections?.[1]?.metrics ?? [];
  const activeNodes = nodes.filter((node) => node.activeInHierarchy);
  const actionNames = activeNodes.filter((node) =>
    ['Action:', 'WorldAction:', 'WalkCombatAction:'].some((prefix) => node.name.startsWith(prefix))
  ).map((node) => node.name);
  const labels = activeNodes.map((node) => node.getComponent(cc.Label)?.string).filter(Boolean);
  return {
    ready: true, phase: app?.viewModel?.phase, rootCount: roots.length, rootUuid: root.uuid,
    sceneAssets: app?.view?.lastChrome?.sceneAssets,
    browserFocus: {
      focused: document.hasFocus(), hidden: document.hidden,
      activeElementType: document.activeElement?.tagName, activeElementId: document.activeElement?.id,
    },
    viewport: {
      width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio,
      canvasWidth: document.querySelector('canvas')?.width,
      canvasHeight: document.querySelector('canvas')?.height,
    },
    walking: {
      present: Boolean(exact('WalkScene')),
      worldKey: app?.view?.walkWorldKey,
      sceneUuid: exact('WalkScene')?.uuid,
      viewport: box(exact('WalkViewport')),
      viewportHasMask: Boolean(exact('WalkViewport')?.getComponent(cc.Mask)),
      position: app?.view?.walkScene?.getPosition(),
      facing: app?.view?.walkScene?.getFacing(),
      inputAxis: app?.view?.walkInput?.axis(),
      inputPresent: Boolean(app?.view?.walkInput),
      player: box(exact('WalkPlayer')),
      playerUuid: exact('WalkPlayer')?.uuid,
      camera: box(exact('WalkCamera')),
      cameraScale: exact('WalkCamera') ? {
        x: exact('WalkCamera').scale.x, y: exact('WalkCamera').scale.y,
      } : undefined,
      cameraUuid: exact('WalkCamera')?.uuid,
      playerFrame: frameInfo(bodySprite?.spriteFrame),
      frameIndex: frames.indexOf(bodySprite?.spriteFrame),
      playerTrim: bodySprite?.trim,
      playerBody: box(exact('WalkPlayerBody')),
      backdrops: matching('WalkDungeonBackdrop:').map((node) => ({
        name: node.name, box: box(node), frame: frameInfo(node.getComponent(cc.Sprite)?.spriteFrame),
      })),
      dungeonProps: matching('WalkDungeonPropSprite:').map((node) => ({
        name: node.name, box: box(node), parent: node.parent?.name, frame: frameInfo(node.getComponent(cc.Sprite)?.spriteFrame),
      })),
      courtyardProps: matching('WalkCourtyardProp:').map((node) => ({
        name: node.name, box: box(node), frames: nodeFrames(node),
      })),
      atlas: {
        count: frames.length,
        rects: frames.map((frame) => frameInfo(frame)?.rect),
        frames: frames.map(frameInfo),
        sharedTexture: frames.length > 0 && frames.every((frame) => frame.texture === frames[0].texture),
        width: atlas?.width, height: atlas?.height,
      },
      joystick: control('WalkJoystick'),
      thumb: box(exact('WalkJoystickThumb')),
      interact: control('WalkInteract'),
      interactionHint: label('WalkInteractionHint'),
      targets: matching('WalkTarget:').map((node) => ({
        name: node.name, box: box(node), text: text(node), touchable: control(node.name).touchable,
        frames: nodeFrames(node),
        hubPortal: (() => {
          const body = node.getChildByName('WorldObjectBody');
          const art = body?.getChildByName('WalkHubDungeonPortalSprite');
          const dimensions = box(art);
          return art ? {
            frame: frameInfo(art.getComponent(cc.Sprite)?.spriteFrame), box: dimensions, screen: screenBox(art),
            bodyScale: { x: body.scale.x, y: body.scale.y },
            worldWidth: dimensions.width * body.scale.x, worldHeight: dimensions.height * body.scale.y,
            worldBottom: (dimensions.y - dimensions.height / 2) * body.scale.y,
            touch: box(node.getChildByName('WalkTargetTouch')),
            fallback: Boolean(body.getComponent(cc.Graphics)),
          } : undefined;
        })(),
        stoneGate: (() => {
          const body = node.getChildByName('WorldObjectBody');
          const gate = body?.getChildByName('WalkTransitionGateSprite');
          const sprite = gate?.getComponent(cc.Sprite);
          return gate ? { frame: frameInfo(sprite?.spriteFrame), grayscale: sprite?.grayscale,
            groundLight: Boolean(body?.getChildByName('WalkTransitionGroundLight')),
            state: node.getChildByName('WalkTransitionState')?.getComponent(cc.Label)?.string } : undefined;
        })(),
      })),
      wallCount: matching('WalkWall:').length + matching('WalkObstacleFootprint:').length,
      status: label('WalkPlayerStatus'),
      storageNotice: label('WalkStorageNotice') ?? (app?.viewModel?.phase === 'hub' ? label('WalkMode') : undefined),
      feedback: label('WalkFeedback'),
      enemyHealth: label('WalkEnemyHealthLabel'),
      combatPage: label('WalkCombatPage'),
      hud: {
        bag: control('SceneDetails'), menu: control('SceneHelp'),
        minimap: { box: box(exact('WalkMinimap')), screen: screenBox(exact('WalkMinimap')) },
        resources: {
          ...control('WalkCurrencyReadout'),
          hasLabel: Boolean(exact('WalkCurrencyReadout')?.getComponent(cc.Label)),
          rewardPoints: { ...control('WalkRewardPoints'), value: label('WalkRewardPointsValue'),
            expectedValue: metrics.find(({ id }) => id === 'reward-points')?.value,
            wrap: exact('WalkRewardPointsValue')?.getComponent(cc.Label)?.enableWrapText },
          lingyun: { ...control('WalkLingyun'), value: label('WalkLingyunValue'),
            expectedValue: metrics.find(({ id }) => id === 'lingyun')?.value,
            wrap: exact('WalkLingyunValue')?.getComponent(cc.Label)?.enableWrapText },
        },
        healthCaption: label('WalkHealthCaption'),
        title: label('WalkLocationName'),
      },
    },
    actions: {
      names: actionNames,
      touchableNames: actionNames.filter((name) => control(name).touchable),
      detailPage: label('PageCount'),
      next: control('PageNext'),
      previous: control('PagePrevious'),
    },
    domain: {
      activePanel: detail?.kind === 'hub' ? detail.activePanel : undefined,
      combatTurn: detail?.kind === 'combat' ? detail.turn : undefined,
      enemyHp: detail?.kind === 'combat' ? detail.enemy.hp : undefined,
      playerHp: detail?.kind === 'combat' ? detail.player.hp : undefined,
      currentNodeCleared: detail?.kind === 'explore' ? detail.currentNode.cleared : undefined,
      currentNodeId: detail?.kind === 'explore' ? detail.currentNode.nodeId : undefined,
      pendingKind: detail?.kind === 'explore' ? detail.pending?.kind : undefined,
      attackWouldBeFatal: detail?.kind === 'combat' ? Boolean(app?.viewModel?.sections?.[2]?.actions
        ?.find(({ actionId }) => actionId === 'combat.action:attack')?.readout?.includes('濒死')) : undefined,
      shopRows: detail?.shop?.rows?.map(({ id, status }) => ({ id, status })),
      shopVisualKeys: detail?.shop?.rows?.flatMap(({ visualAssetKey }) => visualAssetKey ? [visualAssetKey] : []),
      shopPortraitKey: detail?.shop?.portraitAssetKey,
      tasks: app?.viewModel?.tasks?.map(({ id, title, status }) => ({ id, title, status })),
      entryDungeons: detail?.entryServices?.find(({ id }) => id === 'dungeon')?.options
        .map(({ id, name, selected, action, dungeon }) => ({ id, name, selected, actionId: action.actionId, status: dungeon?.status })),
      entryFrames: detail?.entryServices?.find(({ id }) => id === 'relic-frame')?.options
        .map(({ id, selected, action, shortDescription }) => ({ id, selected, actionId: action.actionId, shortDescription })),
      mapNodeCount: detail?.kind === 'explore' ? detail.map.nodes.length : undefined,
      mapNodes: detail?.kind === 'explore' ? detail.map.nodes.map(({ cellId, nodeId, title, state, x, y }) =>
        ({ cellId, nodeId, title, state, x, y })) : undefined,
      supplyItems: app?.viewModel?.sections?.[1]?.loadout?.items
        ?.filter(({ itemGroup }) => itemGroup === 'supply').map(({ itemId, count }) => ({ itemId, count })),
      tacticalItems: app?.viewModel?.sections?.[1]?.loadout?.items
        ?.filter(({ itemGroup }) => itemGroup === 'carry').map(({ itemId, count, carried }) => ({ itemId, count, carried })),
      availableActions: app?.viewModel?.sections?.[2]?.actions?.map(({ actionId, enabled, label, readout }) =>
        ({ actionId, enabled, label, readout })),
    },
    details: {
      open: Boolean(app?.view?.detailsOpen),
      return: control('SceneReturn'),
      openControl: control('SceneDetails'),
    },
    sheet: {
      kind: app?.view?.mobileSheet?.kind,
      title: label('MobileSheetTitle'),
      entry: {
        settingsOpen: app?.view?.mobileSheet?.entrySettingsOpen === true,
        settings: control('MobileSheetEntrySettings'),
        footer: control('MobileSheetEntryFooter'),
        confirm: control('MobileSheetEntryConfirm'),
        settingsToggle: control('MobileSheetEntrySettingsToggle'),
        dungeonScroll: control('MobileSheetEntryDungeonScroll'),
        cards: matching('MobileSheetEntryDungeon:').map(node => ({ name: node.name, screen: screenBox(node), frames: nodeFrames(node) })),
        frameDescription: label('MobileSheetEntryFrameDescription'),
        frameWraps: exact('MobileSheetEntryFrameDescription')?.getComponent(cc.Label)?.enableWrapText,
      },
      readoutTitles: [...matching('ReadoutTitle'), ...matching('TaskFactTitle')]
        .map((node) => node.getComponent(cc.Label)?.string),
      taskRows: matching('MobileSheetTask:').map((node) => ({ name: node.name, text: text(node) })),
      close: control('MobileSheetClose'),
      legacyPaging: Boolean(exact('MobileSheetNext') || exact('MobileSheetPrevious') || exact('MobileSheetPageCount')),
      scroll: (() => {
        const sheetRoot = matching('MobileInfoSheet:').at(-1);
        const sheetNodes = [];
        if (sheetRoot) walk(sheetRoot, sheetNodes);
        const holders = sheetNodes.filter((node) => node.activeInHierarchy && node.getComponent(cc.ScrollView));
        // Carry has a deliberately separate list contract; other sheets may
        // rename their real ScrollView or add a foreground detail scroll.
        const holder = holders.find((node) => ['MobileSheetCarryList', 'MobileSheetMapScroll'].includes(node.name)) ?? holders.at(-1);
        const scroll = holder?.getComponent(cc.ScrollView);
        const content = scroll?.content;
        const holderNodes = [];
        if (holder) walk(holder, holderNodes);
        return {
          present: Boolean(scroll && content),
          name: holder?.name,
          view: box(holder),
          content: box(content),
          contentY: content?.position.y,
          contentX: content?.position.x,
          offset: scroll?.getScrollOffset()?.y,
          offsetX: scroll ? -scroll.getScrollOffset().x : undefined,
          horizontal: scroll?.horizontal,
          vertical: scroll?.vertical,
          thumb: holderNodes.some((node) => node.name === 'MobileSheetScrollThumb' && node.activeInHierarchy),
        };
      })(),
      blocker: Boolean(exact('MobileSheetBackdrop')?.getComponent(cc.BlockInputEvents)),
      topmost: root.children.at(-1)?.name === 'MobileSheetBackdrop',
      catalogRows: activeNodes.filter(node => /^MobileSheetShop(?:Row|Tile):/.test(node.name)).map(node => node.name),
      mapCells: [...matching('MobileSheetMapCell:'), ...matching('MobileSheetFog:')].map(node => node.name),
      mapCellDetails: [...matching('MobileSheetMapCell:'), ...matching('MobileSheetFog:')].map(node => ({ name: node.name, ...control(node.name) })),
      mapViewport: control('MobileSheetMapScroll'),
      mapDetail: control('MobileSheetMapDetail'),
      mapDetailTitle: label('MapDetailTitle'),
      mapDetailStatus: label('MapDetailStatus'),
      mapDetailDescription: label('MapDetailDescription'),
      catalogTiles: matching('MobileSheetShopTile:').map(node => ({ name: node.name, text: text(node) })),
      figureRecords: Array.from(app?.sheetFigureLeases ?? [], ([key, value]) => ({ key, imageUuid: value.image?.uuid, width: value.image?.width, height: value.image?.height, frame: frameInfo(value.frame) })),
      catalogDetail: control('MobileSheetCatalogDetail'),
      shopActions: matching('MobileSheetShopAction:').map((node) => node.name),
      actions: matching('MobileSheetAction:').map((node) => node.name),
      helpEntries: matching('MobileSheetHelp:').map((node) => node.name),
      itemCells: matching('MobileSheetItem:').map((node) => node.name),
      carryItems: matching('MobileSheetCarryItem:').map((node) => node.name),
      carrySlots: matching('MobileSheetCarrySlot:').map((node) => ({ name: node.name, text: text(node), box: box(node) })),
      carryCount: label('MobileSheetCarryCount'),
      carryHint: label('MobileSheetCarryHint'),
      blankCells: matching('MobileSheetBlank:').length,
      carriedSeals: nodes.filter((node) => node.activeInHierarchy && node.name === 'ItemCarriedSeal').length,
      tip: (() => {
        const card = exact('MobileSheetTip');
        if (!card) return { present: false };
        const carry = activeNodes.find((node) => node.name.startsWith('MobileSheetTipCarry:'));
        return {
          present: true,
          texts: (() => { const out = []; const walk = (node) => {
            const value = node.getComponent(cc.Label)?.string;
            if (value) out.push(value);
            for (const child of node.children) walk(child);
          }; walk(card); return out; })(),
          carry: carry ? {
            name: carry.name,
            label: text(carry),
            touchable: carry.hasEventListener(cc.Node.EventType.TOUCH_START)
              && carry.hasEventListener(cc.Node.EventType.TOUCH_END),
          } : undefined,
        };
      })(),
    },
    help: {
      present: Boolean(exact('HelpOverlayBlocker')),
      blocker: Boolean(exact('HelpOverlayBlocker')?.getComponent(cc.BlockInputEvents)),
      topmost: root.children.at(-1)?.name === 'HelpOverlayBlocker',
      close: control('CloseHelp'),
    },
    codex: {
      present: Boolean(exact('ChapterCodexOverlay')),
      kicker: label('ChapterCodexKicker'), title: label('ChapterCodexTitle'),
      next: control('ChapterCodexNext'), previous: control('ChapterCodexPrevious'),
      close: control('ChapterCodexClose'),
    },
    result: {
      present: Boolean(exact('SceneWorld')) && app?.viewModel?.phase === 'result',
      outcome: label('ResultSealOutcome'),
      loot: text(exact('WorldResultLoot')),
      actionHeading: text(exact('SceneActionHeading')),
      previous: control('ScenePagePrevious'), next: control('ScenePageNext'),
    },
    combatAnimating: Boolean(app?.view?.combatPlayback),
    diagnostics: {
      activeNodeNames: activeNodes.map((node) => node.name),
      worldBackgroundWindows: matching('WorldBackgroundWindow:').map(node => ({ name: node.name, box: box(node), clipped: Boolean(node.getComponent(cc.Mask)) })),
      activeSprites: activeNodes.filter((node) => node.getComponent(cc.Sprite)?.spriteFrame).map((node) => ({
        name: node.name, box: box(node), screen: screenBox(node), frame: frameInfo(node.getComponent(cc.Sprite)?.spriteFrame),
      })),
      desiredVisualKeys: Array.from(app?.desiredSceneVisualKeys ?? []),
      visualRecords: Array.from(app?.visualRecords ?? [], ([key, value]) => ({
        key, acquired: value.acquired, sceneDisplayed: value.sceneDisplayed,
        width: value.image?.width, height: value.image?.height, imageUuid: value.image?.uuid,
      })),
      sceneVisuals: Array.from(app?.view?.sceneVisuals ?? [], ([key, value]) => ({
        key, frame: frameInfo(value.frame),
      })),
      labels,
    },
  };
})()`;

async function getSceneSnapshot(cdp) {
  return evaluate(cdp, sceneSnapshotExpression);
}

async function waitForSnapshot(cdp, label, predicate) {
  const deadline = Date.now() + stateTimeoutMs;
  let lastSnapshot;
  let lastError;
  while (Date.now() < deadline) {
    try {
      lastSnapshot = await getSceneSnapshot(cdp);
      if (predicate(lastSnapshot)) return lastSnapshot;
    } catch (error) { lastError = error; }
    await delay(120);
  }
  throw new Error('Timed out waiting for ' + label + '. Last scene: '
    + JSON.stringify(lastSnapshot) + (lastError ? ' Evaluation error: ' + formatError(lastError) : ''));
}

async function getRuntimeEvidence(cdp) {
  const evidence = await evaluate(cdp, runtimeEvidenceExpression);
  assert.equal(evidence?.ready, true, 'read-only runtime evidence must be available');
  assert.match(evidence.stateSha256, /^[0-9a-f]{64}$/u);
  return evidence;
}

function assertSameDomainEvidence(before, after, label) {
  assert.equal(after.durableRevision, before.durableRevision, label + ': durable revision');
  assert.equal(after.stateSha256, before.stateSha256, label + ': gameplay state digest');
}

function assertWalkingFrameIndex(index, facing, label) {
  const start = { down: 0, left: 4, right: 8, up: 12 }[facing];
  assert.ok(Number.isInteger(index) && start !== undefined && index >= start && index < start + 4,
    label + ': rendered frame identity belongs to the facing direction');
}

function matchesWalking(snapshot, phase) {
  return snapshot?.ready && snapshot.phase === phase && snapshot.walking?.present
    && snapshot.walking.playerFrame?.loaded && snapshot.walking.atlas.count === 16;
}

function assertWalking(snapshot, phase) {
  assert.equal(Boolean(matchesWalking(snapshot, phase)), true, phase + ' must render the loaded walking actor');
  assert.equal(snapshot.rootCount, 1, phase + ': single runtime root');
  assert.deepEqual(snapshot.viewport, {
    width: viewport.width, height: viewport.height, devicePixelRatio: viewport.deviceScaleFactor,
    canvasWidth: viewport.width, canvasHeight: viewport.height,
  });
  assert.equal(snapshot.walking.viewportHasMask, true, 'world viewport must clip the moving camera');
  assert.equal(snapshot.walking.joystick.touchable, true, 'walking joystick accepts actual touch');
  assert.equal(snapshot.walking.interact.touchable, true, 'interaction control accepts actual touch');
  if (phase === 'hub') assert.equal(snapshot.walking.courtyardProps.length, 4, 'courtyard renders its four physical props');
  else assert.ok(snapshot.walking.wallCount >= 4, phase + ': the walking room must contain physical collision footprints');
  assert.equal(snapshot.walking.atlas.sharedTexture, true, 'all 16 walker frames must share one atlas texture');
  assert.equal(new Set(snapshot.walking.atlas.rects.map((rect) => JSON.stringify(rect))).size, 16,
    'walking atlas must contain 16 distinct source rectangles');
  const atlas = snapshot.walking.atlas;
  assert.deepEqual({ width: atlas.width, height: atlas.height }, { width: 1254, height: 1254 },
    'walking frames use the approved source image size');
  for (let index = 0; index < atlas.frames.length; index += 1) {
    const frame = atlas.frames[index];
    const rect = frame.rect;
    assert.equal(frame.valid, true, 'walking frame ' + index + ' and its shared texture are live');
    assert.ok([rect.x, rect.y, rect.width, rect.height].every(Number.isInteger)
      && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
      && rect.x + rect.width <= atlas.width && rect.y + rect.height <= atlas.height,
    'walking frame ' + index + ' is an integral source crop contained by the atlas');
    assert.deepEqual(frame.originalSize, { width: 336, height: 336 },
      'all walking frames retain one logical canvas for stable proportions');
    assert.ok(Number.isFinite(frame.offset?.x) && Number.isFinite(frame.offset?.y),
      'walking frame ' + index + ' has an explicit foot-alignment offset');
    assert.equal(frame.packable, false, 'walking crops cannot be relocated by dynamic atlas packing');
    const measured = heroWalkLayout.frames[index];
    assert.deepEqual([rect.x, rect.y, rect.width, rect.height], measured.rect,
      'walking frame ' + index + ' samples the independently measured crop');
    const [left, top, right, bottom] = heroWalkLayout.bboxAlpha128Exclusive[index];
    assert.ok(left >= rect.x && top >= rect.y && right <= rect.x + rect.width && bottom <= rect.y + rect.height,
      'walking frame ' + index + ' contains its complete opaque silhouette');
    const logicalFootX = frame.originalSize.width / 2 + frame.offset.x + measured.foot[0] - rect.x - rect.width / 2;
    const logicalFootY = frame.originalSize.height / 2 - frame.offset.y + measured.foot[1] - rect.y - rect.height / 2;
    assert.ok(Math.abs(logicalFootX - 168) < 1e-6 && Math.abs(logicalFootY - 320.16) < 1e-6,
      'walking frame ' + index + ' preserves the calibrated logical foot');
    const body = snapshot.walking.playerBody;
    assert.ok(Math.abs(body.x + (logicalFootX - frame.originalSize.width / 2) * body.width / frame.originalSize.width) < 0.3
      && Math.abs(body.y + (frame.originalSize.height / 2 - logicalFootY) * body.height / frame.originalSize.height) < 0.3,
    'walking frame ' + index + ' keeps visible feet on the physical world anchor');
    for (const previous of atlas.frames.slice(0, index)) {
      const other = previous.rect;
      assert.ok(rect.x + rect.width <= other.x || other.x + other.width <= rect.x
        || rect.y + rect.height <= other.y || other.y + other.height <= rect.y,
      'walking crops do not sample a neighboring frame');
    }
  }
  assert.equal(snapshot.walking.playerTrim, false, 'player uses the logical canvas and calibrated frame offsets');
  assert.deepEqual(snapshot.walking.playerBody, phase === 'hub'
    ? { x: 0, y: 78, width: 172, height: 172 }
    : { x: 0, y: 47, width: 104, height: 104 }, 'new hero retains the approved body size and anchor');
  assertWalkingFrameIndex(snapshot.walking.frameIndex, snapshot.walking.facing, phase);
  assert.equal(snapshot.diagnostics.activeNodeNames.some((name) => name.startsWith('WorldPlayer:')), false,
    'free walking must render the world actor without a portrait actor');
  assert.equal(snapshot.diagnostics.activeNodeNames.some((name) => name.startsWith('WorldAction:')), false,
    'walking hub, exploration and combat must use spatial controls');
}

function matchesCourtyardArt(snapshot) {
  if (!matchesWalking(snapshot, 'hub') || snapshot.sceneAssets !== 'ready') return false;
  const backdrop = snapshot.walking.backdrops.find((entry) => entry.name === 'WalkDungeonBackdrop:scene:hub_courtyard_walk');
  return backdrop?.frame?.valid && snapshot.walking.courtyardProps.length === 4
    && snapshot.diagnostics.activeSprites.find(entry => entry.name === 'WalkAvatarArt')?.frame?.valid
    && snapshot.walking.targets.find((target) => target.name === 'WalkTarget:portal:entry')?.hubPortal?.frame?.valid
    && snapshot.walking.courtyardProps.every((prop) => prop.frames.length > 0 && prop.frames.every(({ frame }) => frame.valid))
    && snapshot.walking.targets.filter((target) => target.name.startsWith('WalkTarget:npc:')).length === 7
    && snapshot.walking.targets.filter((target) => target.name.startsWith('WalkTarget:npc:'))
      .every((target) => target.frames.length > 0 && target.frames.every(({ frame }) => frame.valid))
    && courtyardVisualKeys.every((key) => snapshot.diagnostics.visualRecords.some((record) =>
      record.key === key && record.acquired && record.sceneDisplayed));
}

function assertCourtyard(snapshot) {
  assert.equal(Boolean(matchesCourtyardArt(snapshot)), true, 'courtyard background and every prop use live valid SpriteFrames');
  assert.deepEqual({ width: snapshot.walking.camera.width, height: snapshot.walking.camera.height },
    { width: 1200, height: 720 }, 'approved courtyard world dimensions');
  assert.equal(snapshot.walking.wallCount, 0, 'courtyard does not draw the former collision walls');
  const avatar = snapshot.diagnostics.activeSprites.find(entry => entry.name === 'WalkAvatarArt');
  assert.ok(avatar?.frame?.registeredResourceKeys.includes('character:reincarnator'), 'HUD portrait displays the acquired approved identity');
  assert.deepEqual({ width: avatar.frame.textureWidth, height: avatar.frame.textureHeight }, { width: 1254, height: 1254 });
  const physicalWidth = avatar.screen.right - avatar.screen.left;
  const physicalHeight = avatar.screen.bottom - avatar.screen.top;
  assert.ok(Math.abs(physicalWidth - 59) < 0.1 && Math.abs(physicalHeight - 59) < 0.1,
    'assigning the actual Cocos portrait frame preserves its 59 CSS-pixel cover rather than its 1254px source dimensions');

  const props = Object.fromEntries(snapshot.walking.courtyardProps.map(({ name, box }) => [name, box]));
  assert.deepEqual(props, {
    'WalkCourtyardProp:altar': { x: 430, y: -480, width: 120, height: 84 },
    'WalkCourtyardProp:lamp': { x: 1120, y: -628, width: 46, height: 118 },
    'WalkCourtyardProp:crate': { x: 705, y: -480, width: 92, height: 68 },
    'WalkCourtyardProp:pillar': { x: 570, y: -628, width: 72, height: 150 },
  }, 'courtyard props use the approved feet, sizes and depth anchors');
  const targets = Object.fromEntries(snapshot.walking.targets.map((target) => [
    target.name.slice('WalkTarget:'.length), { x: target.box.x, y: -target.box.y },
  ]));
  assert.deepEqual(targets, courtyardTargetPositions, 'all seven NPCs and the entry portal use the approved courtyard layout');
  assert.ok(snapshot.walking.targets.filter((target) => target.name.startsWith('WalkTarget:npc:'))
    .every((target) => target.frames.length > 0 && target.frames.every(({ frame }) => frame.valid)),
  'all seven NPCs use loaded world artwork');
  assert.ok(snapshot.walking.targets.every((target) => target.touchable), 'NPCs and portal accept physical target taps');
  const portal = snapshot.walking.targets.find((target) => target.name === 'WalkTarget:portal:entry');
  const portalArt = portal.hubPortal;
  assert.deepEqual(portal.box, { x: 1080, y: -466, width: 160, height: 220 }, 'hub portal retains its original foot anchor and target area');
  assert.deepEqual(portalArt.touch, { x: 0, y: 110, width: 160, height: 220 }, 'hub portal retains its original touch footprint');
  assert.ok(Math.abs(portalArt.bodyScale.x - 1.25) < 1e-6 && Math.abs(portalArt.bodyScale.y - 1.42) < 1e-6,
    'selected portal artwork preserves the existing body transform');
  assert.equal(portalArt.fallback, false, 'the real acquired portal frame replaces its vector fallback');
  assert.deepEqual({ width: portalArt.frame.textureWidth, height: portalArt.frame.textureHeight }, { width: 1018, height: 1545 },
    'the actual selected seventh portal image is loaded at its source dimensions');
  assert.ok(portalArt.frame.registeredResourceKeys.includes('scene:hub_dungeon_portal'), 'portal displays its exact dedicated resource');
  assert.ok(Math.abs(portalArt.worldWidth / portalArt.worldHeight - 1018 / 1545) < 1e-6,
    'portal source proportions survive the non-uniform body transform');
  assert.ok(Math.abs(portalArt.worldWidth - 152.5) < 0.001 && Math.abs(portalArt.worldHeight - 231.446463654) < 0.001,
    'portal artwork fits the approved world footprint without clipping');
  assert.ok(Math.abs(portalArt.worldBottom + 11.36) < 0.001, 'portal artwork remains on the original ground base');
  assert.ok(Math.abs((portalArt.screen.right - portalArt.screen.left) / (portalArt.screen.bottom - portalArt.screen.top) - 1018 / 1545) < 1e-5,
    'physical viewport preserves the selected portal proportions');
  assert.equal(snapshot.diagnostics.desiredVisualKeys.includes('scene:dungeon_transition_gate'), false,
    'courtyard portal does not reuse the dungeon stone-gate resource');
  assert.equal(snapshot.walking.hud.bag.text, '背包');
  assert.equal(snapshot.walking.hud.menu.text, '菜单');
  assert.equal(snapshot.walking.hud.bag.touchable && snapshot.walking.hud.menu.touchable, true);
  const { bag, menu, minimap, resources } = snapshot.walking.hud;
  assert.equal(bag.box.y, menu.box.y, 'bag and menu share the top-right row');
  assert.ok(bag.box.x < menu.box.x, 'bag sits immediately left of menu');
  assert.ok(minimap.screen, 'courtyard minimap is physically present');
  assert.ok(Math.abs(minimap.screen.top - Math.max(bag.screen.bottom, menu.screen.bottom) - 13) < 0.1,
    'minimap begins 13 CSS px below the header shortcut touch areas');
  const narrowHud = snapshot.viewport.width <= 350;
  assert.ok(Math.abs(menu.screen.right - minimap.screen.right - (narrowHud ? 9 : 7)) < 0.1,
    'minimap retains its 10 CSS-pixel right inset beside the responsive header shortcuts');
  assert.equal(resources.hasLabel, false, 'currency readout is a container for two separate resource values');
  for (const [kind, resource] of [['reward-points', resources.rewardPoints], ['lingyun', resources.lingyun]]) {
    assert.ok(resource.present && resource.touchable, `${kind}: resource value has its own HUD touch target`);
    assert.equal(resource.wrap, false, `${kind}: resource value remains unwrapped`);
    assert.match(resource.value, /^\S+$/u, `${kind}: HUD displays the resource value without a caption`);
    assert.equal(resource.value, resource.expectedValue, `${kind}: HUD retains the actual projected resource value`);
    assert.ok(Math.abs(resource.screen.bottom - resource.screen.top - 44) < 0.1,
      `${kind}: resource target retains its 44 CSS-pixel touch height`);
  }
  assert.ok(Math.abs(resources.rewardPoints.screen.top - resources.lingyun.screen.top) < 0.1,
    'both resource targets share one horizontal row');
  assert.ok(resources.rewardPoints.screen.right <= resources.lingyun.screen.left,
    'separate resource targets remain ordered without overlap');
  assert.match(snapshot.walking.status, /^\d+\s*\/\s*\d+$/u, 'player status contains only current and maximum health');
  assert.equal(snapshot.walking.hud.healthCaption, narrowHud ? undefined : '生命',
    'health caption is visible only above the 350 CSS-pixel narrow-screen breakpoint');
  assert.equal(snapshot.walking.hud.title, undefined, 'courtyard has no scene title');
  assert.equal(snapshot.walking.interactionHint, undefined, 'courtyard has no text above the joystick');
  assert.equal(snapshot.walking.interact.text, '交谈', 'courtyard interaction button has the approved label');
  assert.ok(Math.abs(snapshot.walking.interact.screen.right - snapshot.walking.interact.screen.left - 64) < 0.1,
    'interaction button is 64 CSS px wide');
  assert.ok(Math.abs(snapshot.walking.interact.screen.bottom - snapshot.walking.interact.screen.top - 44) < 0.1,
    'interaction button is 44 CSS px high');
  for (const key of courtyardVisualKeys) {
    assert.ok(snapshot.diagnostics.desiredVisualKeys.includes(key), 'courtyard requests its exact visual: ' + key);
    const registered = snapshot.diagnostics.sceneVisuals.find((entry) => entry.key === key)?.frame;
    assert.equal(registered?.valid, true, 'courtyard visual has a valid registered SpriteFrame: ' + key);
    const rendered = key === 'scene:hub_courtyard_walk'
      ? snapshot.walking.backdrops.filter(({ name }) => name === 'WalkDungeonBackdrop:' + key).map(({ frame }) => frame)
      : key === 'scene:hub_dungeon_portal' ? [portalArt.frame]
      : snapshot.walking.courtyardProps.find(({ name }) => name === 'WalkCourtyardProp:' + key.slice('scene:courtyard_'.length))
        ?.frames.map(({ frame }) => frame);
    assert.ok(rendered?.length > 0 && rendered.every((frame) => frame.registeredResourceKeys.includes(key)),
      'rendered courtyard artwork uses the SpriteFrame for its exact resource key: ' + key);
  }
}

function assertDungeonGates(snapshot, available) {
  const key = 'scene:dungeon_transition_gate';
  assert.equal(snapshot.diagnostics.desiredVisualKeys.includes('scene:hub_dungeon_portal'), false,
    'entering a dungeon stops requesting the courtyard portal');
  assert.equal(snapshot.diagnostics.visualRecords.some(record => record.key === 'scene:hub_dungeon_portal' && record.acquired), false,
    'entering a dungeon releases the hub-only portal lease');
  assert.equal(snapshot.diagnostics.sceneVisuals.some(record => record.key === 'scene:hub_dungeon_portal'), false,
    'courtyard portal frame is removed from the dungeon scene');
  assert.equal(snapshot.walking.targets.some(target => target.hubPortal), false,
    'dungeon gates and exits do not render the courtyard artwork');
  const gates = snapshot.walking.targets.filter(target => target.name.startsWith('WalkTarget:door:'));
  assert.ok(gates.length > 0, 'exploration renders its real adjacent entrances');
  assert.ok(snapshot.diagnostics.desiredVisualKeys.includes(key), 'exploration requests approved warm stone-gate artwork');
  const record = snapshot.diagnostics.visualRecords.find(entry => entry.key === key);
  assert.ok(record?.acquired && record.sceneDisplayed && record.width > 0 && record.height > 0,
    'stone gate has an acquired and displayed resource lease');
  for (const gate of gates) {
    assert.ok(gate.stoneGate?.frame?.loaded && gate.stoneGate.frame.valid,
      gate.name + ': actual stone-gate SpriteFrame is loaded');
    assert.ok(gate.stoneGate.frame.registeredResourceKeys.includes(key), gate.name + ': exact approved resource is rendered');
    if (!available) {
      assert.equal(gate.stoneGate.grayscale, true, gate.name + ': blocked gate is visibly muted');
      assert.equal(gate.stoneGate.groundLight, false, gate.name + ': blocked gate has no available glow');
      assert.equal(gate.stoneGate.state, '入口未开放');
    }
  }
  if (available) assert.ok(gates.some(gate => !gate.stoneGate.grayscale && gate.stoneGate.groundLight),
    'after clearing the encounter a legal gate is visibly available');
}

function assertCompactMap(snapshot) {
  const sheet = snapshot.sheet;
  assert.equal(sheet.mapCells.length, snapshot.domain.mapNodeCount, 'map keeps every known and fogged region mounted');
  assert.equal(sheet.legacyPaging, false, 'compact region map has no page controls');
  assert.ok(sheet.mapViewport.present && sheet.mapDetail.present, 'map and inline region details share the same sheet');
  assert.ok(sheet.mapDetail.screen.top >= sheet.mapViewport.screen.bottom - 1,
    'inline details sit below the complete map viewport without overlap');
  assert.ok(sheet.mapDetail.screen.left >= 0 && sheet.mapDetail.screen.right <= viewport.width + 1
    && sheet.mapDetail.screen.bottom <= viewport.height + 1, 'inline details fit the phone screen');
  assert.ok(!snapshot.diagnostics.labels.some(label => /放大名称|附近出口|返回地图/u.test(label)),
    'map omits name zoom, nearby tabs, and separate detail navigation');
  for (const cell of sheet.mapCellDetails) {
    assert.equal(Boolean(cell.text), false, cell.name + ': grid cell uses an icon without a name label');
    assert.ok(cell.screen.right - cell.screen.left >= 43.5 && cell.screen.bottom - cell.screen.top >= 43.5,
      cell.name + ': icon keeps a 44 CSS-pixel touch surface');
    if (cell.name.startsWith('MobileSheetFog:')) assert.equal(cell.touchable, false, 'anonymous fog cells are read-only');
  }
}

function compactWalking(snapshot) {
  const value = snapshot.walking;
  return {
    at: new Date().toISOString(), phase: snapshot.phase, worldKey: value.worldKey,
    position: value.position, facing: value.facing, inputAxis: value.inputAxis,
    player: value.player, playerUuid: value.playerUuid,
    sceneUuid: value.sceneUuid, cameraUuid: value.cameraUuid, camera: value.camera,
    frame: value.playerFrame, frameIndex: value.frameIndex, thumb: value.thumb, hint: value.interactionHint,
  };
}

const movementEvidence = [];
const KEY_EVENTS = Object.freeze({
  w: { key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 },
  s: { key: 's', code: 'KeyS', windowsVirtualKeyCode: 83, nativeVirtualKeyCode: 83 },
  a: { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 },
  d: { key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 },
  e: { key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69, nativeVirtualKeyCode: 69 },
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 },
});

async function dispatchKey(cdp, key, type) {
  assert.ok(KEY_EVENTS[key], 'supported physical key ' + key);
  await cdp.send('Input.dispatchKeyEvent', { type, ...KEY_EVENTS[key] });
}

async function keyTap(cdp, key) {
  await dispatchKey(cdp, key, 'keyDown');
  try { await delay(60); } finally { await dispatchKey(cdp, key, 'keyUp'); }
}

async function holdKey(cdp, key, milliseconds, label, screenshotCallback) {
  const baseline = await getSceneSnapshot(cdp);
  const samples = [compactWalking(baseline)];
  await dispatchKey(cdp, key, 'keyDown');
  const start = Date.now();
  try {
    while (Date.now() - start < milliseconds) {
      await delay(Math.min(80, Math.max(1, milliseconds - (Date.now() - start))));
      const snapshot = await getSceneSnapshot(cdp);
      samples.push(compactWalking(snapshot));
    }
    // Screenshot encoding can take longer than the whole walking window.
    // First record the dense real-frame samples, then capture while still held.
    if (screenshotCallback) await screenshotCallback(await getSceneSnapshot(cdp), samples.length - 1);
  } finally { await dispatchKey(cdp, key, 'keyUp'); }
  const actualHoldMs = Date.now() - start;
  await delay(100);
  const released = compactWalking(await getSceneSnapshot(cdp));
  await delay(160);
  const stopped = compactWalking(await getSceneSnapshot(cdp));
  const record = { label, input: 'Input.dispatchKeyEvent', key, requestedHoldMs: milliseconds,
    actualHoldMs, samples, released, stopped };
  movementEvidence.push(record);
  return record;
}

function assertStopped(record) {
  assert.ok(Math.hypot(record.stopped.position.x - record.released.position.x,
    record.stopped.position.y - record.released.position.y) < 0.5, record.label + ': releasing input stops the actor');
  assert.deepEqual(record.stopped.inputAxis, { x: 0, y: 0 }, record.label + ': released input axis');
}

function assertContinuousMovement(record, axis, sign, facing) {
  const first = record.samples[0];
  const last = record.samples.at(-1);
  assert.ok((last.position[axis] - first.position[axis]) * sign > 55, record.label + ': meaningful movement');
  let movingSamples = 0;
  for (let index = 1; index < record.samples.length; index += 1) {
    const current = record.samples[index];
    const previous = record.samples[index - 1];
    const distance = Math.hypot(current.position.x - previous.position.x, current.position.y - previous.position.y);
    if (distance > 0.5) movingSamples += 1;
    assert.ok(distance < 95, record.label + ': bounded movement between real render-frame observations');
    assert.equal(current.playerUuid, first.playerUuid, record.label + ': persistent actor node');
    assert.equal(current.sceneUuid, first.sceneUuid, record.label + ': persistent scene node');
    assert.equal(current.cameraUuid, first.cameraUuid, record.label + ': persistent camera node');
    assert.ok((current.position[axis] - previous.position[axis]) * sign >= -0.5, record.label + ': movement direction');
    assertWalkingFrameIndex(current.frameIndex, current.facing, record.label);
  }
  assert.ok(movingSamples >= 3, record.label + ': movement is continuous across at least three samples');
  assert.equal(last.facing, facing, record.label + ': expected actor facing');
  assert.ok(new Set(record.samples.slice(1).map((sample) => sample.frameIndex)).size >= 2,
    record.label + ': real movement advances the selected atlas frame');
  assertStopped(record);
}

async function holdJoystick(cdp, direction, milliseconds, label, screenshotCallback) {
  const target = await queryNodePoint(cdp, 'WalkJoystick');
  assert.equal(target.found && target.hasTouch, true, 'live joystick must accept touch');
  const samples = [compactWalking(await getSceneSnapshot(cdp))];
  const id = (physicalTouchSequence++ % 3) + 1;
  const point = (x, y) => ({ x, y, id, radiusX: 2, radiusY: 2, force: 1 });
  const scale = target.screenWidth / target.width;
  const end = { x: target.x + direction.x * 66 * scale, y: target.y + direction.y * 66 * scale };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(target.x, target.y)] });
  const start = Date.now();
  try {
    await delay(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(end.x, end.y)] });
    while (Date.now() - start < milliseconds) {
      await delay(Math.min(80, Math.max(1, milliseconds - (Date.now() - start))));
      const snapshot = await getSceneSnapshot(cdp);
      samples.push(compactWalking(snapshot));
    }
    if (screenshotCallback) await screenshotCallback(await getSceneSnapshot(cdp), samples.length - 1);
  } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  const actualHoldMs = Date.now() - start;
  await delay(100);
  const released = compactWalking(await getSceneSnapshot(cdp));
  await delay(160);
  const stopped = compactWalking(await getSceneSnapshot(cdp));
  const record = { label, input: 'Input.dispatchTouchEvent touchStart/touchMove/hold/touchEnd',
    direction, requestedHoldMs: milliseconds, actualHoldMs, samples, released, stopped };
  movementEvidence.push(record);
  return record;
}

/** Feedback controls only choose physical key duration; no position setters or game-state mutations. */
async function walkTo(cdp, destination, label) {
  for (const axis of ['x', 'y']) {
    const deadline = Date.now() + 15_000;
    let stagnant = 0;
    while (Date.now() < deadline) {
      const before = await getSceneSnapshot(cdp);
      const distance = destination[axis] - before.walking.position[axis];
      if (Math.abs(distance) <= 6) break;
      const key = axis === 'x' ? distance < 0 ? 'a' : 'd' : distance < 0 ? 'w' : 's';
      const speed = before.phase === 'hub' ? axis === 'x' ? 260 : 145 : 220;
      const holdMs = Math.max(18, Math.min(280, Math.abs(distance) / speed * 1000 - 8));
      await dispatchKey(cdp, key, 'keyDown');
      let held;
      try {
        await delay(holdMs);
        held = await getSceneSnapshot(cdp);
      } finally { await dispatchKey(cdp, key, 'keyUp'); }
      await delay(35);
      const after = await getSceneSnapshot(cdp);
      movementEvidence.push({ label: label + ':' + axis, input: 'Input.dispatchKeyEvent',
        key, requestedHoldMs: holdMs, browserFocus: held.browserFocus,
        samples: [compactWalking(before), compactWalking(held), compactWalking(after)] });
      assert.equal(held.walking.inputAxis?.[axis], Math.sign(distance),
        label + ': physical held key reaches the walking adapter; focus=' + JSON.stringify(held.browserFocus));
      stagnant = Math.abs(after.walking.position[axis] - before.walking.position[axis]) < 0.5 ? stagnant + 1 : 0;
      assert.ok(stagnant < 3, label + ': route encountered an unexpected wall at ' + JSON.stringify(after.walking.position));
    }
    const snapshot = await getSceneSnapshot(cdp);
    assert.ok(Math.abs(destination[axis] - snapshot.walking.position[axis]) <= 6,
      label + ': physically reach ' + axis + '=' + destination[axis]);
  }
  return getSceneSnapshot(cdp);
}

/** The approved courtyard has an unobstructed horizontal corridor at y=550. */
async function walkHubTo(cdp, destination, label) {
  const before = await getSceneSnapshot(cdp);
  assert.equal(before.phase, 'hub', label + ': courtyard route');
  await walkTo(cdp, { x: before.walking.position.x, y: 550 }, label + ':clear-corridor');
  return walkTo(cdp, destination, label);
}

async function touchApproachNpc(cdp, panel, label) {
  const before = await getSceneSnapshot(cdp);
  const destination = courtyardTargetPositions['npc:' + panel];
  assert.ok(destination, label + ': known courtyard NPC');
  assert.ok(Math.hypot(before.walking.position.x - destination.x, before.walking.position.y - destination.y) > 120,
    label + ': physical tap starts beyond the NPC interaction radius');
  const samples = [compactWalking(before)];
  const start = Date.now();
  await touchNode(cdp, 'WalkTarget:npc:' + panel);
  const deadline = Date.now() + stateTimeoutMs;
  let arrived;
  while (Date.now() < deadline) {
    await delay(80);
    const snapshot = await getSceneSnapshot(cdp);
    samples.push(compactWalking(snapshot));
    if (snapshot.sheet.kind === 'npc' && snapshot.domain.activePanel === panel) {
      arrived = snapshot;
      break;
    }
    assert.equal(snapshot.sheet.kind, undefined, label + ': remote target waits for real walking before opening its sheet');
    assert.equal(snapshot.phase, 'hub', label + ': approach stays in the courtyard');
  }
  assert.ok(arrived, label + ': target tap automatically reaches and opens its original NPC sheet');
  assert.ok(samples.filter((sample, index) => index > 0 && Math.hypot(
    sample.position.x - samples[index - 1].position.x, sample.position.y - samples[index - 1].position.y,
  ) > 0.5).length >= 3, label + ': approach moves continuously across at least three real render observations');
  assert.ok(Math.hypot(arrived.walking.position.x - destination.x, arrived.walking.position.y - destination.y) <= 100.1,
    label + ': the original NPC sheet opens only inside the real interaction radius');
  movementEvidence.push({ label, input: 'Input.dispatchTouchEvent target tap and automatic approach',
    target: 'npc:' + panel, elapsedMs: Date.now() - start, samples });
  return arrived;
}

async function waitForNpcCatalogArtwork(cdp, panel) {
  const artworkReady = (snapshot) => {
    if (snapshot.sheet.kind !== 'npc' || snapshot.domain.activePanel !== panel) return false;
    const keys = [...snapshot.domain.shopVisualKeys ?? [], snapshot.domain.shopPortraitKey].filter(Boolean);
    return keys.every((key) => snapshot.sheet.figureRecords.some((entry) => entry.key === key && entry.frame.valid))
      && snapshot.diagnostics.desiredVisualKeys.every((key) => snapshot.diagnostics.visualRecords.some((entry) =>
        entry.key === key && entry.acquired && entry.sceneDisplayed));
  };
  const loaded = await waitForSnapshot(cdp, panel + ' complete catalog artwork before physical item input', artworkReady);
  // The complete figure batch publishes with one root rebuild. Observe that
  // actual root again before START/END, so asset arrival cannot sever the tap.
  let previousRoot = loaded.rootUuid;
  let stableObservations = 0;
  return waitForSnapshot(cdp, panel + ' stable catalog root after artwork publication', (snapshot) => {
    if (!artworkReady(snapshot)) return false;
    if (snapshot.rootUuid !== previousRoot) {
      previousRoot = snapshot.rootUuid;
      stableObservations = 0;
      return false;
    }
    stableObservations += 1;
    return stableObservations >= 2;
  });
}

async function waitForWalkingArtwork(cdp, phase) {
  let previousRoot;
  let stableObservations = 0;
  return waitForSnapshot(cdp, phase + ' complete artwork and stable runtime root', (snapshot) => {
    if (!matchesWalking(snapshot, phase) || !snapshot.diagnostics.desiredVisualKeys.every((key) =>
      snapshot.diagnostics.visualRecords.some((entry) => entry.key === key && entry.acquired && entry.sceneDisplayed))) return false;
    if (snapshot.rootUuid !== previousRoot) {
      previousRoot = snapshot.rootUuid;
      stableObservations = 0;
      return false;
    }
    stableObservations += 1;
    return stableObservations >= 2;
  });
}

async function findPhysicalAction(cdp, actionId, surface = 'details') {
  const prefix = surface === 'combat' ? 'WalkCombatAction:' : surface === 'result' ? 'WorldAction:' : 'Action:';
  const previous = surface === 'combat' ? 'WalkCombatPagePrevious' : surface === 'result' ? 'ScenePagePrevious' : 'PagePrevious';
  const next = surface === 'combat' ? 'WalkCombatPageNext' : surface === 'result' ? 'ScenePageNext' : 'PageNext';
  if (surface === 'combat') {
    const snapshot = await waitForSnapshot(cdp, 'combat controls ready', value => !value.combatAnimating);
    const resolved = actionId === 'combat.action:attack' && snapshot.actions.touchableNames.includes(prefix + 'combat.action:weapon_skill')
      ? 'combat.action:weapon_skill' : actionId;
    const name = prefix + resolved;
    assert.ok(snapshot.actions.touchableNames.includes(name), 'compact combat action must be reachable: ' + name);
    return name;
  }
  const name = prefix + actionId;
  for (let index = 0; index < 25; index += 1) {
    const snapshot = await getSceneSnapshot(cdp);
    if (snapshot.actions.touchableNames.includes(name)) return name;
    const back = await queryNodePoint(cdp, previous);
    if (!back.found || !back.hasTouch) break;
    await touchNode(cdp, previous);
    await delay(110);
  }
  for (let index = 0; index < 25; index += 1) {
    const snapshot = await getSceneSnapshot(cdp);
    if (snapshot.actions.touchableNames.includes(name)) return name;
    const forward = await queryNodePoint(cdp, next);
    assert.equal(forward.found && forward.hasTouch, true,
      'physical action must be reachable: ' + name + ', visible=' + snapshot.actions.names.join(','));
    await touchNode(cdp, next);
    await delay(110);
  }
  throw new Error('Physical pagination did not reach ' + name);
}

async function captureStage(cdp, outputDir, fileName, label, snapshot) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false,
  });
  const data = Buffer.from(result.data, 'base64');
  const dimensions = readPngDimensions(data);
  assert.deepEqual(dimensions, { width: viewport.width, height: viewport.height }, label + ': screenshot dimensions');
  const outputPath = path.join(outputDir, fileName);
  await writeFile(outputPath, data);
  const sha256 = createHash('sha256').update(data).digest('hex');
  console.log('[canvas-smoke] ' + label + ': ' + path.relative(projectDir, outputPath));
  return {
    stage: label, file: path.relative(projectDir, outputPath), bytes: data.length,
    width: dimensions.width, height: dimensions.height, sha256,
    walking: snapshot.walking.present ? compactWalking(snapshot) : undefined,
    result: snapshot.result.present ? snapshot.result : undefined,
  };
}

async function findMobileAction(cdp, actionId) {
  const name = `MobileSheetAction:${actionId}`;
  const snapshot = await getSceneSnapshot(cdp);
  assert.ok(snapshot.sheet.actions.includes(name),
    `mobile action must be rendered in the scroll list: ${actionId}; list=${snapshot.sheet.actions.join(',')}`);
  await bringSheetNodeIntoView(cdp, name);
  return name;
}

async function verifyCombatChoices(cdp, save, sceneEvidence) {
  const opening = await getSceneSnapshot(cdp);
  const baseline = await getRuntimeEvidence(cdp);
  const pillId = 'combat.action:use_healing_pill';
  const artId = 'combat.action:art';
  const pillCount = snapshot => snapshot.domain.supplyItems.find(item => item.itemId === 'healing_pill').count;
  assert.equal(opening.walking.combatPage, undefined, 'six combat controls never paginate');
  for (const group of ['spells', 'medicines']) {
    assert.equal((await queryNodePoint(cdp, 'WalkCombatChoice:' + group)).hasTouch, true);
  }
  await touchNode(cdp, 'WalkCombatChoice:medicines');
  await waitForSnapshot(cdp, 'medicine list', snapshot => snapshot.sheet.actions.includes('MobileSheetAction:' + pillId));
  assert.equal((await queryNodePoint(cdp, 'MobileSheetAction:' + pillId)).hasTouch, false, 'full health medicine is directly disabled');
  await save('combat-medicine-full-health', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'MobileSheetClose');
  assertSameDomainEvidence(baseline, await getRuntimeEvidence(cdp), 'medicine cancellation');

  await touchNode(cdp, 'WalkCombatChoice:spells');
  const spells = await waitForSnapshot(cdp, 'all learned spells', snapshot => snapshot.sheet.actions.length === 3);
  assert.deepEqual(new Set(spells.sheet.actions), new Set([artId, 'combat.method:mist_breathing', 'combat.method:iron_body'].map(id => 'MobileSheetAction:' + id)));
  await save('combat-spell-list', spells);
  await touchNode(cdp, 'MobileSheetClose');
  assertSameDomainEvidence(baseline, await getRuntimeEvidence(cdp), 'spell cancellation');

  for (const id of ['combat.method:mist_breathing', 'combat.method:iron_body']) {
    await touchNode(cdp, 'WalkCombatChoice:spells');
    await touchNode(cdp, 'MobileSheetAction:' + id);
    const cast = await waitForSnapshot(cdp, 'chosen technique completed', snapshot => !snapshot.combatAnimating && !snapshot.sheet.kind
      && snapshot.domain.availableActions.find(action => action.actionId === id)?.enabled === false);
    assert.equal(cast.domain.combatTurn, opening.domain.combatTurn, 'technique preserves turn');
    assert.equal(cast.domain.playerHp, opening.domain.playerHp, 'technique does not counterattack');
    assert.equal(cast.domain.enemyHp, opening.domain.enemyHp, 'support technique does not invent damage');
    await touchNode(cdp, 'WalkCombatChoice:spells');
    assert.equal((await queryNodePoint(cdp, 'MobileSheetAction:' + id)).hasTouch, false, 'spent technique cannot execute again');
    await touchNode(cdp, 'MobileSheetClose');
  }

  await touchNode(cdp, 'WalkCombatChoice:spells');
  await touchNode(cdp, 'MobileSheetAction:' + artId);
  const damaged = await waitForSnapshot(cdp, 'spell animation completed', snapshot => !snapshot.combatAnimating && !snapshot.sheet.kind
    && snapshot.phase === 'combat' && snapshot.domain.combatTurn === opening.domain.combatTurn + 1);
  assert.ok(damaged.domain.enemyHp < opening.domain.enemyHp, 'spell damages the enemy');
  assert.ok(damaged.domain.playerHp < opening.domain.playerHp, 'counterattack creates natural medicine need');
  assert.equal(damaged.domain.tacticalItems.some(item => item.carried), false, 'medicine needs no carry slot');
  await touchNode(cdp, 'WalkCombatChoice:medicines');
  await save('combat-medicine-ready', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'MobileSheetAction:' + pillId);
  const healed = await waitForSnapshot(cdp, 'medicine animation completed', snapshot => !snapshot.combatAnimating && !snapshot.sheet.kind
    && snapshot.phase === 'combat' && snapshot.domain.combatTurn === damaged.domain.combatTurn + 1);
  assert.equal(pillCount(healed), pillCount(damaged) - 1, 'medicine consumes exactly one pill');
  await save('combat-after-medicine', healed);
  const afterMedicine = await getRuntimeEvidence(cdp);
  await touchNode(cdp, 'SceneHelp');
  await touchNode(cdp, 'MobileSheetShortcut:inventory');
  await touchNode(cdp, 'MobileSheetItem:healing_pill');
  await waitForSnapshot(cdp, 'combat bag medicine details', snapshot => snapshot.sheet.tip.present);
  assert.equal((await queryNodePoint(cdp, 'MobileSheetTipUse:healing_pill')).hasTouch, false, 'depleted bag medicine cannot execute');
  await touchNode(cdp, 'MobileSheetTipClose');
  await touchNode(cdp, 'MobileSheetClose');
  assertSameDomainEvidence(afterMedicine, await getRuntimeEvidence(cdp), 'depleted medicine inspection');
  sceneEvidence.push({ stage: 'combat-choices', opening: opening.domain, damaged: damaged.domain, afterMedicine: healed.domain });
}

async function runCanvasFlow(cdp, outputDir) {
  const artifacts = [];
  const sceneEvidence = [];
  const save = async (name, snapshot) => {
    artifacts.push(await captureStage(cdp, outputDir, name + '.png', name, snapshot));
  };
  let hub = await waitForSnapshot(cdp, 'approved courtyard with loaded actor, NPCs, backdrop and props', matchesCourtyardArt);
  await evaluate(cdp, "(async () => { const cc = await System.import('cc'); cc.profiler.hideStats(); return true; })()");
  assertWalking(hub, 'hub');
  assertCourtyard(hub);
  assert.deepEqual(hub.walking.position, { x: 600, y: 550 }, 'courtyard starts at the approved physical world spawn');
  assert.equal(hub.walking.facing, 'right', 'courtyard actor starts facing right');
  assert.equal(hub.walking.playerFrame.rect.y, hub.walking.atlas.rects[8].y, 'courtyard starts in the existing right-facing atlas row');
  assert.match(hub.walking.storageNotice, /刷新.*丢失/u, 'Web preview discloses temporary progress');
  await save('01-hub', hub);
  const movementBaseline = await getRuntimeEvidence(cdp);
  // The page begins with BODY focus in headless Chrome. A real zero-axis tap
  // focuses the canvas before keyboard input, without approaching an object.
  await cdp.send('Page.bringToFront');
  await touchNode(cdp, 'WalkJoystick');
  const focused = await getSceneSnapshot(cdp);
  assert.equal(focused.browserFocus.focused, true, 'physical input page has browser focus');
  assert.equal(focused.browserFocus.activeElementId, 'GameCanvas', 'physical joystick tap focuses the real game canvas');
  assert.deepEqual(focused.walking.position, hub.walking.position, 'zero-axis focus tap leaves the actor at spawn');
  assert.deepEqual(focused.walking.inputAxis, { x: 0, y: 0 }, 'focus tap releases with no movement axis');
  assert.equal(focused.sheet.kind, undefined, 'focus tap opens no sheet');
  assertSameDomainEvidence(movementBaseline, await getRuntimeEvidence(cdp), 'zero-axis canvas focus tap');
  sceneEvidence.push({ stage: 'physical-canvas-focus', before: hub.browserFocus, after: focused.browserFocus });

  if (!compactFlow) {
  // Interaction is proximity-gated, and walking across the room alone is not a domain command.
  await walkHubTo(cdp, { x: 600, y: 575 }, 'step-out-of-spawn-NPC-range');
  await touchNode(cdp, 'WalkInteract');
  assert.equal((await getSceneSnapshot(cdp)).sheet.kind, undefined, 'interaction outside every NPC radius opens no sheet');
  assertSameDomainEvidence(movementBaseline, await getRuntimeEvidence(cdp), 'interaction while far from objects');
  await walkHubTo(cdp, { x: 600, y: 550 }, 'return-to-walking-corridor');
  const up = await holdKey(cdp, 'w', 700, 'keyboard-w-up',
    (snapshot, index) => save('02-w-up-frame-' + index, snapshot));
  assertContinuousMovement(up, 'y', -1, 'right');
  assertContinuousMovement(await holdKey(cdp, 's', 700, 'keyboard-s-down'), 'y', 1, 'right');
  assertContinuousMovement(await holdKey(cdp, 'a', 550, 'keyboard-a-left'), 'x', -1, 'left');
  assertContinuousMovement(await holdKey(cdp, 'd', 550, 'keyboard-d-right'), 'x', 1, 'right');
  assertContinuousMovement(await holdKey(cdp, 'ArrowUp', 700, 'arrow-up'), 'y', -1, 'right');
  assertContinuousMovement(await holdKey(cdp, 'ArrowDown', 700, 'arrow-down'), 'y', 1, 'right');
  const directions = movementEvidence.filter((record) => record.key && record.samples.length > 3);
  assert.deepEqual(new Set(directions.map((record) => record.samples.at(-1).frame.rect.y)),
    new Set([hub.walking.atlas.rects[4].y, hub.walking.atlas.rects[8].y]),
    'courtyard movement selects only the existing left and right atlas rows');
  assert.ok(directions.every((record) => record.samples.every((sample) => sample.camera.y === hub.walking.camera.y)),
    'courtyard camera stays vertically fixed during horizontal and depth walking');

  const joystick = await holdJoystick(cdp, { x: 0, y: -1 }, 750, 'touch-joystick-up',
    (snapshot, index) => save('03-touch-up-frame-' + index, snapshot));
  assertContinuousMovement(joystick, 'y', -1, 'right');
  assert.ok(joystick.samples.some((sample) => sample.thumb.y > 30), 'touch drag moves the visible joystick thumb');
  assert.ok(Math.abs(joystick.stopped.thumb.x) < 0.5 && Math.abs(joystick.stopped.thumb.y) < 0.5,
    'touch end recenters the joystick thumb');
  await walkHubTo(cdp, { x: 480, y: 626 }, 'approach-pillar-footprint');
  const collision = await holdKey(cdp, 'd', 700, 'pillar-collision');
  const collisionEnd = collision.stopped.position;
  assert.ok(Math.abs(collisionEnd.x - 530.08) < 1 && Math.abs(collisionEnd.y - 626) <= 6,
    'player feet stop at the approved pillar footprint x=544.08 minus the 14-unit foot radius');
  assert.ok(Math.abs(collision.samples.at(-1).position.x - collision.samples.at(-2).position.x) < 0.5,
    'held input remains blocked by the pillar');
  assertStopped(collision);
  await save('04-pillar-collision', await getSceneSnapshot(cdp));

  await walkHubTo(cdp, { x: 600, y: 550 }, 'leave-pillar');
  const cameraBefore = (await getSceneSnapshot(cdp)).walking.camera;
  const wall = await holdKey(cdp, 'a', 3400, 'outer-wall-collision');
  assert.ok(Math.abs(wall.stopped.position.x - 78) < 1, 'courtyard left bound stops the actor at x=64 plus foot radius 14');
  assertStopped(wall);
  assert.ok(Math.abs(wall.stopped.camera.x - cameraBefore.x) > 150,
    'the world camera follows continuous player movement across the room');
  assert.equal(wall.stopped.camera.y, cameraBefore.y, 'courtyard camera tracks only horizontal movement');
  await save('05-wall-and-camera', await getSceneSnapshot(cdp));
  assertSameDomainEvidence(movementBaseline, await getRuntimeEvidence(cdp), 'walking, animation and collisions');
  sceneEvidence.push({ stage: 'walking-leaves-domain-unchanged', baseline: movementBaseline, after: await getRuntimeEvidence(cdp) });
  }

  // Tap a visible distant NPC; the actor physically approaches before opening the original sheet.
  // Tall 390px phones show a narrower world span because the courtyard fills
  // their height. Walk a little farther left while keeping the merchant well
  // outside interaction range, then let the same physical target tap approach.
  const merchantApproachX = dungeonOnly && viewport.width === 390 ? 450 : 475;
  await walkHubTo(cdp, { x: merchantApproachX, y: 550 }, 'make-distant-merchant-visible');
  await delay(180);
  await save('06-merchant-before-approach', await getSceneSnapshot(cdp));
  const details = await touchApproachNpc(cdp, 'supplies', 'touch-distant-supply-merchant');
  const merchantPosition = details;
  assert.equal(details.sheet.close.touchable, true, 'automatic approach opens the original closable NPC sheet');
  await waitForNpcCatalogArtwork(cdp, 'supplies');
  assert.equal(details.walking.present && details.sheet.blocker && details.sheet.topmost, true);
  const modalPosition = details.walking.position;
  await holdKey(cdp, 's', 250, 'modal-blocks-walking');
  assert.deepEqual((await getSceneSnapshot(cdp)).walking.position, modalPosition);
  await save('07-merchant-details', details);
  assertSameDomainEvidence(movementBaseline, await getRuntimeEvidence(cdp), 'merchant selection only');
  // The complete icon grid opens immediately; purchases dispatch their original
  // command from the fixed footer of the selected item detail.
  assert.equal(details.sheet.catalogRows.length, 9, 'all supplies appear in the icon grid');
  assert.equal(details.diagnostics.activeNodeNames.some((name) => name.startsWith('MobileSheetTab:')), false);
  assert.equal(details.sheet.shopActions.some((name) => /select:|carry|loadout|activate/.test(name)), false);
  assert.equal(details.sheet.catalogTiles.length, 9);
  assert.ok(details.sheet.catalogTiles.every(tile => !tile.text), 'goods tiles contain no text');
  assert.equal(details.sheet.shopActions.length, 0, 'goods grid contains no purchase buttons');
  await save('07a-merchant-grid', details);
  await touchNode(cdp, 'MobileSheetShopTile:healing_pill');
  const itemDetail = await waitForSnapshot(cdp, 'supply details and purchase footer', (snapshot) => snapshot.sheet.catalogDetail.present);
  assert.match(itemDetail.sheet.catalogDetail.text, /止血丹/);
  assert.equal(itemDetail.sheet.catalogDetail.text.includes('可以对它做什么'), false);
  await save('07b-merchant-item-detail', itemDetail);
  await touchNode(cdp, 'MobileSheetCatalogDetailClose');
  await waitForSnapshot(cdp, 'supply details closed', (snapshot) => !snapshot.sheet.catalogDetail.present);
  assertSameDomainEvidence(movementBaseline, await getRuntimeEvidence(cdp), 'catalog detail round-trip');
  const buyBaseline = await getRuntimeEvidence(cdp);
  await touchNode(cdp, 'MobileSheetShopTile:healing_pill');
  await waitForSnapshot(cdp, 'reopen pill details to purchase', snapshot => snapshot.sheet.catalogDetail.present);
  const buyPill = 'MobileSheetShopAction:hub.supplies.buy:healing_pill::supplies/healing_pill';
  await bringSheetNodeIntoView(cdp, buyPill);
  await touchNode(cdp, buyPill);
  await waitForSnapshot(cdp, 'purchase reflected in the list', (snapshot) =>
    snapshot.domain.shopRows?.find((row) => row.id === 'healing_pill')?.status.includes('1'));
  assert.notEqual((await getRuntimeEvidence(cdp)).stateSha256, buyBaseline.stateSha256,
    'buying a pill dispatches a real domain command');
  // Select the sigil directly from the grid, then purchase in its detail footer.
  if (!compactFlow) {
  await touchNode(cdp, 'MobileSheetCatalogDetailClose');
  await bringSheetNodeIntoView(cdp, 'MobileSheetShopTile:gate_sigil');
  await touchNode(cdp, 'MobileSheetShopTile:gate_sigil');
  await waitForSnapshot(cdp, 'sigil details', snapshot => snapshot.sheet.catalogDetail.present);
  const buySigil = 'MobileSheetShopAction:hub.supplies.buy:gate_sigil::supplies/gate_sigil';
  await bringSheetNodeIntoView(cdp, buySigil);
  const sigilScroll = (await getSceneSnapshot(cdp)).sheet.scroll.offset;
  await touchNode(cdp, buySigil);
  const afterSigil = await waitForSnapshot(cdp, 'gate sigil purchase reflected in the list', (snapshot) =>
    snapshot.domain.shopRows?.find((row) => row.id === 'gate_sigil')?.status.includes('1'));
  assert.ok(Math.abs(afterSigil.sheet.scroll.offset - sigilScroll) < 2,
    `purchase preserves list position: ${sigilScroll} -> ${afterSigil.sheet.scroll.offset}`);
  await save('07c-merchant-purchase', afterSigil);
  }
  await touchNode(cdp, 'MobileSheetCatalogDetailClose');
  await touchNode(cdp, 'MobileSheetClose');
  hub = await waitForSnapshot(cdp, 'return to walking world', (snapshot) => matchesWalking(snapshot, 'hub'));
  assert.ok(Math.hypot(hub.walking.position.x - merchantPosition.walking.position.x,
    hub.walking.position.y - merchantPosition.walking.position.y) < 1, 'detail round-trip preserves physical position');
  if (!focusedFlow) {
  const catalogBaseline = await getRuntimeEvidence(cdp);
  const visits = [
    { panel: 'equipment', count: 65 },
    { panel: 'pets', count: 6 },
    { panel: 'bloodlines', count: 4 },
    { panel: 'tasks', count: 63 },
    { panel: 'companions', count: 3 },
    { panel: 'methods', count: 7 },
  ];
  for (const visit of visits) {
    await walkHubTo(cdp, { x: courtyardTargetPositions['npc:' + visit.panel].x, y: 550 }, 'approach-' + visit.panel);
    await touchNode(cdp, 'WalkInteract');
    await waitForSnapshot(cdp, visit.panel + ' full catalog', (snapshot) =>
      snapshot.sheet.kind === 'npc' && snapshot.domain.activePanel === visit.panel
      && snapshot.sheet.catalogRows.length === visit.count);
    const catalog = await waitForNpcCatalogArtwork(cdp, visit.panel);
    assert.equal(catalog.sheet.legacyPaging, false);
    assert.equal(catalog.sheet.shopActions.some((name) => /select:|\.equip:|\.activate:|\.toggle:/.test(name)), false,
      visit.panel + ': shop exposes no paging or configuration actions');
    await save('07d-catalog-' + visit.panel, catalog);
    const rowId = catalog.sheet.catalogRows[0].replace(/^MobileSheetShop(?:Row|Tile):/, '');
    assert.equal(catalog.sheet.catalogTiles.length, visit.panel === 'tasks' ? 0 : visit.count, 'tasks stay in a list; goods use a grid');
    assert.ok(catalog.sheet.catalogTiles.every(tile => !tile.text), 'goods grid is icon-only');
    await touchNode(cdp, (visit.panel === 'tasks' ? 'MobileSheetShopInfo:' : 'MobileSheetShopTile:') + rowId);
    await waitForSnapshot(cdp, visit.panel + ' item detail', (snapshot) => snapshot.sheet.catalogDetail.present);
    if (visit.panel === 'equipment') {
      await touchNode(cdp, 'MobileSheetCatalogMore');
      await waitForSnapshot(cdp, 'equipment extra actions', snapshot => snapshot.diagnostics.activeNodeNames.includes('MobileSheetCatalogActionMenu'));
      await save('07e-equipment-expanded', await getSceneSnapshot(cdp));
    }
    await touchNode(cdp, 'MobileSheetCatalogDetailClose');
    await waitForSnapshot(cdp, visit.panel + ' item detail closed', (snapshot) => !snapshot.sheet.catalogDetail.present);
    await touchNode(cdp, 'MobileSheetClose');
    await waitForSnapshot(cdp, 'leave-' + visit.panel, (snapshot) => matchesWalking(snapshot, 'hub'));
  }
  assertSameDomainEvidence(catalogBaseline, await getRuntimeEvidence(cdp), 'NPC catalog and detail browsing');
  await walkHubTo(cdp, { x: 290, y: 550 }, 'return-merchant-position');
  const helpBaseline = await getRuntimeEvidence(cdp);
  await touchNode(cdp, 'SceneHelp');
  await waitForSnapshot(cdp, 'mobile menu', (snapshot) => snapshot.sheet.kind === 'menu');
  await touchNode(cdp, 'MobileSheetShortcut:help');
  const directory = await waitForSnapshot(cdp, 'help directory', (snapshot) => snapshot.sheet.kind === 'help' && snapshot.sheet.helpEntries.length > 0);
  await touchNode(cdp, directory.sheet.helpEntries[0]);
  const help = await waitForSnapshot(cdp, 'walking help overlay', (snapshot) => snapshot.help.present && snapshot.help.close.touchable);
  assert.equal(help.help.blocker && help.help.topmost, true, 'help owns the top blocking layer');
  await save('08-help', help);
  // The help topic is one scrollable document (概要/机制/行动建议/界面读数),
  // not a paged booklet. The intra-topic pager is gone; when the copy overflows,
  // a physical drag must change the scroll offset.
  const readHelpScroll = () => evaluate(cdp, String.raw`(async () => {
    const cc = await System.import('cc');
    const nodes = [];
    const walk = (node) => { nodes.push(node); for (const child of node.children) walk(child); };
    walk(cc.director.getScene());
    const region = nodes.find((candidate) => candidate.name === 'HelpScroll' && candidate.activeInHierarchy);
    const content = region?.getChildByName('HelpScrollContent');
    if (!region || !content) return JSON.stringify({ present: false });
    return JSON.stringify({
      present: true,
      off: region.getComponent(cc.ScrollView).getScrollOffset().y,
      overflows: content.getComponent(cc.UITransform).contentSize.height > region.getComponent(cc.UITransform).contentSize.height + 1,
    });
  })()`);
  const helpBefore = JSON.parse(await readHelpScroll());
  assert.equal(helpBefore.present, true, 'help topic must present a scroll region instead of a pager');
  assert.equal((await queryNodePoint(cdp, 'PreviousHelpPage')).found, false, 'help topic no longer paginates 概要/机制/建议/读数');
  if (helpBefore.overflows) {
    await dragSheet(cdp, -180, 'HelpScroll');
    const helpAfter = JSON.parse(await readHelpScroll());
    assert.ok(helpAfter.off > helpBefore.off + 5, 'overflowing help copy physically scrolls');
  }
  await save('08b-help-scrolled', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'CloseHelp');
  await waitForSnapshot(cdp, 'help closed', (snapshot) => !snapshot.help.present && snapshot.sheet.kind === 'help');
  await touchNode(cdp, 'MobileSheetClose');
  assertSameDomainEvidence(helpBaseline, await getRuntimeEvidence(cdp), 'help round-trip');
  }

  if (!compactFlow) {
  // Character overview retains owned equipment configuration; carry cards
  // execute their own equip/remove commands above the separate supply bag.
  await touchNode(cdp, 'SceneHelp');
  await waitForSnapshot(cdp, 'mobile menu for character', (snapshot) => snapshot.sheet.kind === 'menu');
  await touchNode(cdp, 'MobileSheetShortcut:character');
  const character = await waitForSnapshot(cdp, 'character paper doll', (snapshot) => snapshot.sheet.kind === 'character');
  assert.equal(character.sheet.legacyPaging, false, 'character sheet is a single scroll surface');
  for (const slot of ['weapon', 'head', 'armor', 'hands', 'feet', 'waist', 'charm']) {
    const point = await queryNodePoint(cdp, `MobileSheetEquip:${slot}`);
    assert.equal(point.found && point.hasTouch, true, `paper-doll slot ${slot} is bound`);
  }
  await save('13-character-doll', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'MobileSheetEquip:weapon');
  const equipTip = await waitForSnapshot(cdp, 'equipment tooltip', (snapshot) => snapshot.sheet.tip.present);
  assert.equal(equipTip.sheet.tip.carry, undefined, 'equipment tooltip is strictly read-only');
  assert.ok(equipTip.sheet.tip.texts.some((value) => value.includes('武器')), 'equipment tooltip names the slot');
  await save('13b-equip-tooltip', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'MobileSheetTipClose');
  await waitForSnapshot(cdp, 'equipment tooltip closed', (snapshot) => !snapshot.sheet.tip.present);
  await bringSheetNodeIntoView(cdp, 'MobileSheetOwnedLoadout');
  await touchNode(cdp, 'MobileSheetOwnedLoadout');
  const owned = await waitForSnapshot(cdp, 'owned loadout list', (snapshot) => snapshot.sheet.catalogRows.length > 0);
  assert.equal(owned.sheet.shopActions.some((name) => /\.buy:|\.recruit:|\.cultivate:/.test(name)), false,
    'owned loadout contains configuration rather than shop transactions');
  await save('13c-character-loadout', owned);
  const ownedRowId = owned.sheet.catalogRows[0].slice('MobileSheetShopRow:'.length);
  await touchNode(cdp, 'MobileSheetShopInfo:' + ownedRowId);
  await waitForSnapshot(cdp, 'owned equipment details', (snapshot) => snapshot.sheet.catalogDetail.present);
  await touchNode(cdp, 'MobileSheetCatalogDetailClose');
  await waitForSnapshot(cdp, 'owned equipment details closed', (snapshot) => !snapshot.sheet.catalogDetail.present);
  await touchNode(cdp, 'MobileSheetOwnedLoadoutBack');
  await waitForSnapshot(cdp, 'character overview restored', snapshot => snapshot.diagnostics.activeNodeNames.includes('MobileSheetOwnedLoadout'));
  await touchNode(cdp, 'MobileSheetTab:carry');
  const carry = await waitForSnapshot(cdp, 'character carry cards', snapshot => snapshot.sheet.carryItems.length === 6);
  assert.equal(carry.sheet.carrySlots.length, 3, 'fresh gear has three general carry slots');
  assert.equal(carry.sheet.blankCells, 0, 'carry has no unused bag padding');
  assert.equal(carry.sheet.carryCount, '0 / 3', 'fresh configuration starts empty');
  assert.ok(!/库存不变|不消耗库存/.test(carry.sheet.carryHint ?? ''), 'carry omits the removed inventory hint');
  assert.equal((await queryNodePoint(cdp, 'MobileSheetCarryItem:thunder_talisman')).hasTouch, false, 'unowned item cannot be equipped');
  const carryBaseline = await getRuntimeEvidence(cdp);
  const countsBefore = carry.domain.tacticalItems.map(({ itemId, count }) => ({ itemId, count }));
  await bringSheetNodeIntoView(cdp, 'MobileSheetCarryItem:gate_sigil');
  await touchNode(cdp, 'MobileSheetCarryItem:gate_sigil');
  const equipped = await waitForSnapshot(cdp, 'carry card equips its item', snapshot => snapshot.sheet.carryCount === '1 / 3');
  assert.notEqual((await getRuntimeEvidence(cdp)).stateSha256, carryBaseline.stateSha256, 'carry card commits the real domain command');
  assert.deepEqual(equipped.domain.tacticalItems.map(({ itemId, count }) => ({ itemId, count })), countsBefore, 'configuration preserves actual item quantities');
  await save('13d-character-carry-equipped', equipped);
  await touchNode(cdp, 'MobileSheetCarryItem:gate_sigil');
  await waitForSnapshot(cdp, 'second card press removes item', snapshot => snapshot.sheet.carryCount === '0 / 3');
  await touchNode(cdp, 'MobileSheetCarryItem:gate_sigil');
  const configuredCarry = await waitForSnapshot(cdp, 'carry re-equipped for run', snapshot => snapshot.sheet.carryCount === '1 / 3');
  const fixedSlots = configuredCarry.sheet.carrySlots;
  await dragSheet(cdp, -180, 'MobileSheetCarryList');
  const scrolledCarry = await getSceneSnapshot(cdp);
  assert.deepEqual(scrolledCarry.sheet.carrySlots, fixedSlots, 'lower list scrolling leaves upper slots fixed');
  if (configuredCarry.sheet.scroll.content.height > configuredCarry.sheet.scroll.view.height) {
    assert.ok(scrolledCarry.sheet.scroll.offset > configuredCarry.sheet.scroll.offset, 'overflowing carry list physically scrolls');
  }
  await save('13e-character-carry-list', scrolledCarry);
  await touchNode(cdp, 'MobileSheetClose');

  await touchNode(cdp, 'SceneHelp');
  await waitForSnapshot(cdp, 'mobile menu for bag', (snapshot) => snapshot.sheet.kind === 'menu');
  await touchNode(cdp, 'MobileSheetShortcut:inventory');
  const bag = await waitForSnapshot(cdp, 'supply-only 5x100 bag', (snapshot) => snapshot.sheet.kind === 'inventory');
  assert.equal(bag.diagnostics.activeNodeNames.includes('MobileSheetTab:carry'), false, 'carry no longer occupies a bag tab');
  // The bag defaults to the 道具 tab: 3 supply cells, its own 100-cell grid.
  assert.deepEqual(bag.sheet.itemCells, [
    'MobileSheetItem:healing_pill',
    'MobileSheetItem:armor_patch',
    'MobileSheetItem:focus_incense',
  ], '道具 tab mounts exactly the three supply cells');
  assert.equal(bag.sheet.blankCells, 97, '道具 tab pads its grid to 100');
  assert.equal(bag.sheet.carriedSeals, 0, '道具 tab carries no seals');
  assert.equal(bag.sheet.scroll.present, true, 'bag grid scrolls in-window');
  assert.equal((await queryNodePoint(cdp, 'MobileSheetBlank:3')).found, true, 'decorative cells exist in the 道具 grid');
  await save('14-bag-grid-items', await getSceneSnapshot(cdp));
  // Physically browse the lower (fully decorative) rows.
  const bagScrollBefore = (await getSceneSnapshot(cdp)).sheet.scroll.contentY;
  await dragSheet(cdp, -300);
  const lowerBag = await getSceneSnapshot(cdp);
  assert.equal(lowerBag.sheet.blankCells, 97, 'scrolling keeps the supply grid mounted');
  assert.ok(lowerBag.sheet.scroll.contentY > bagScrollBefore + 5, 'the 100-cell grid physically scrolls');
  await save('14c-bag-scrolled', lowerBag);
  await touchNode(cdp, 'MobileSheetClose');
  await waitForSnapshot(cdp, 'walking after bag', (snapshot) => matchesWalking(snapshot, 'hub'));
  if (carryOnly) return { artifacts, sceneEvidence, movementEvidence,
    combatOutcome: 'not-run: carry-only scope', physicalAttackCount: 0 };
  }

  if (combatOnly) {
    // Learn two affordable methods through the actual NPC before entering.
    await walkHubTo(cdp, { x: 570, y: 550 }, 'approach-method-master');
    await touchNode(cdp, 'WalkInteract');
    await waitForSnapshot(cdp, 'method catalog', snapshot => snapshot.domain.activePanel === 'methods');
    await waitForNpcCatalogArtwork(cdp, 'methods');
    for (const method of ['mist_breathing', 'iron_body']) {
      await bringSheetNodeIntoView(cdp, 'MobileSheetShopTile:' + method);
      await touchNode(cdp, 'MobileSheetShopTile:' + method);
      const details = await waitForSnapshot(cdp, 'method learning detail', snapshot => snapshot.sheet.catalogDetail.present);
      const learn = details.sheet.shopActions.find(name => name.startsWith('MobileSheetShopAction:hub.methods.learn:' + method));
      assert.ok(learn, 'method learning is reachable from its NPC');
      await touchNode(cdp, learn);
      await waitForSnapshot(cdp, 'method learned', snapshot => snapshot.domain.shopRows.find(row => row.id === method)?.status.includes('1 阶'));
      await touchNode(cdp, 'MobileSheetCatalogDetailClose');
    }
    await touchNode(cdp, 'MobileSheetClose');
  }

  await walkHubTo(cdp, { x: 1080, y: 550 }, 'approach-entry-portal');
  const portal = await getSceneSnapshot(cdp);
  assert.equal(portal.phase, 'hub', 'walking into portal range does not automatically enter a run');
  assert.equal(portal.sheet.kind, undefined, 'ordinary proximity to the portal opens no entry sheet');
  assert.ok(Math.hypot(portal.walking.position.x - 1080, portal.walking.position.y - 466) <= 120,
    'physical walking reaches the approved entry portal radius');
  await save('09-portal-proximity', portal);
  // Entry selection and cost inspection are local-only; only explicit confirmation enters.
  await keyTap(cdp, 'e');
  await keyTap(cdp, 'Space');
  assert.equal((await getSceneSnapshot(cdp)).sheet.kind, undefined, 'removed E and Space shortcuts do not open the entry sheet');
  await touchNode(cdp, 'WalkInteract');
  await waitForSnapshot(cdp, 'entry configuration sheet',
    (snapshot) => snapshot.sheet.kind === 'entry' && snapshot.domain.activePanel === 'entry');
  const initialEntry = await waitForSnapshot(cdp, 'all chapter card artwork loaded', snapshot => snapshot.sheet.entry.cards.length === 19
    && snapshot.sheet.entry.cards.every(card => card.frames.some(({ frame }) => frame.valid
      && frame.registeredResourceKeys.includes('dungeon:' + card.name.slice('MobileSheetEntryDungeon:'.length)))));
  await save('09b-entry-sheet', initialEntry);
  let entryBaseline = await getRuntimeEvidence(cdp);
  const entryFooterScreen = initialEntry.sheet.entry.footer.screen;
  const entryConfirmScreen = initialEntry.sheet.entry.confirm.screen;
  assert.equal(initialEntry.sheet.entry.cards.length, 19, 'default entry sheet presents every chapter on one page');
  assert.equal(initialEntry.sheet.entry.settingsOpen, false, 'entry settings starts collapsed');
  assert.equal(initialEntry.sheet.entry.confirm.present, true, 'entry control is immediately available in the fixed footer');
  assert.equal(initialEntry.sheet.entry.confirm.text, '进入副本', 'entry uses the approved direct confirmation label');
  assert.equal((await pointInsideHolder(cdp, 'MobileSheetEntryConfirm')).inside, true, 'fixed entry control fits the phone without scrolling');
  assert.ok(initialEntry.sheet.entry.dungeonScroll.screen.bottom <= entryFooterScreen.top + 0.6,
    'fixed footer does not cover the chapter scroll region');
  const visibleCards = initialEntry.sheet.entry.cards.filter(({ screen }) => screen.top >= initialEntry.sheet.entry.dungeonScroll.screen.top - 0.6
    && screen.bottom <= initialEntry.sheet.entry.dungeonScroll.screen.bottom + 0.6);
  if (viewport.width === 320 || viewport.width === 390) {
    assert.ok(visibleCards.length >= (viewport.width === 390 ? 6 : 4), 'compact chapter rows keep the approved number fully visible');
  }
  await touchNode(cdp, 'MobileSheetEntrySettingsToggle');
  const openedSettings = await waitForSnapshot(cdp, 'entry settings expanded in place', snapshot => snapshot.sheet.entry.settingsOpen);
  assert.equal(openedSettings.sheet.entry.cards.length, 19, 'settings overlay preserves the chapter directory');
  assert.deepEqual(openedSettings.sheet.entry.footer.screen, entryFooterScreen, 'settings leaves the fixed footer in place');
  assert.ok(openedSettings.sheet.entry.settings.screen.bottom <= entryFooterScreen.top + 0.6,
    'settings expands upward without covering the fixed footer');
  const originalFrame = openedSettings.domain.entryFrames.find(({ selected }) => selected);
  for (const frame of [...openedSettings.domain.entryFrames.filter(({ selected }) => !selected), originalFrame]) {
    const beforeFrameSelection = await getRuntimeEvidence(cdp);
    await bringSheetNodeIntoView(cdp, `MobileSheetEntryOption:${frame.actionId}`);
    await touchNode(cdp, `MobileSheetEntryOption:${frame.actionId}`);
    const frameSelection = await waitForSnapshot(cdp, 'echo direction ' + frame.id,
      snapshot => snapshot.domain.entryFrames.find(({ selected }) => selected)?.id === frame.id);
    assert.equal(frameSelection.sheet.entry.frameDescription, frame.shortDescription, 'echo selection updates only the approved one-line direction');
    assert.equal(frameSelection.sheet.entry.frameDescription.includes('\n'), false, 'echo direction omits expanded detail text');
    assert.equal(frameSelection.sheet.entry.frameWraps, false, 'echo direction cannot wrap into a taller selector');
    assert.equal(frameSelection.sheet.entry.settingsOpen, true, 'echo selection stays in the settings overlay');
    const afterFrameSelection = await getRuntimeEvidence(cdp);
    assert.ok(afterFrameSelection.durableRevision > beforeFrameSelection.durableRevision, 'echo preparation persists its real configuration command');
  }
  await save('09c-entry-settings', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'MobileSheetEntrySettingsToggle');
  await waitForSnapshot(cdp, 'entry settings collapsed', snapshot => !snapshot.sheet.entry.settingsOpen);
  // Echo preparation is a real saved configuration command. Establish a fresh
  // baseline only after restoring the original frame; chapter browsing is local.
  entryBaseline = await getRuntimeEvidence(cdp);
  const choices = (await getSceneSnapshot(cdp)).domain.entryDungeons;
  const selectedChapters = [];
  const originalChapter = choices.find(({ selected }) => selected);
  assert.equal(new Set(choices.map(({ id }) => id)).size, 19, 'all 19 chapters are listed without cycling');
  for (const chapter of compactFlow ? [originalChapter] : [...choices.filter(({ selected }) => !selected), originalChapter]) {
    await bringSheetNodeIntoView(cdp, `MobileSheetEntryDungeon:${chapter.id}`);
    await touchNode(cdp, `MobileSheetEntryDungeon:${chapter.id}`);
    assert.equal((await getSceneSnapshot(cdp)).domain.entryDungeons.find(({ selected }) => selected)?.id,
      chapter.id, 'selecting a chapter updates the entry draft');
    selectedChapters.push(chapter.id);
    const selectedEntry = await getSceneSnapshot(cdp);
    assert.equal(selectedEntry.sheet.entry.cards.length, 19, 'chapter selection retains the single-page directory');
    assert.equal(selectedEntry.sheet.entry.settingsOpen, false, 'chapter selection does not open a settings page');
    assert.ok(Math.abs(selectedEntry.sheet.entry.footer.screen.bottom - entryFooterScreen.bottom) < 0.6,
      'long locked requirements may expand the footer upward while its bottom stays fixed');
    assert.ok(Math.abs(selectedEntry.sheet.entry.confirm.screen.bottom - entryConfirmScreen.bottom) < 0.6,
      'chapter selection keeps the entry button anchored at the same bottom position');
    assert.equal((await pointInsideHolder(cdp, 'MobileSheetEntryConfirm')).inside, true, 'entry control stays fully visible after chapter scrolling');
    if (chapter.status === 'locked') assert.equal(selectedEntry.sheet.entry.confirm.touchable, false, 'locked chapters can be selected but cannot enter');
  }
  assertSameDomainEvidence(entryBaseline, await getRuntimeEvidence(cdp), compactFlow ? 'choosing the opening chapter' : 'browsing every chapter');
  await touchNode(cdp, 'MobileSheetEntryConfirm');
  await waitForSnapshot(cdp, 'walkable exploration room', (snapshot) => matchesWalking(snapshot, 'explore'));
  const explore = await waitForWalkingArtwork(cdp, 'explore');
  assertWalking(explore, 'explore');
  assertDungeonGates(explore, false);
  await save('10-explore', explore);
  const blockedGateBaseline = await getRuntimeEvidence(cdp);
  await walkTo(cdp, { x: 500, y: 500 }, 'leave-lower-room-pillars-before-combat');
  await walkTo(cdp, { x: 790, y: 500 }, 'approach-blocked-east-door');
  await save('10b-blocked-stone-gate', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'WalkInteract');
  const blockedGate = await waitForSnapshot(cdp, 'blocked stone gate opens read-only map', snapshot => snapshot.sheet.kind === 'map');
  assert.equal(blockedGate.domain.currentNodeId, explore.domain.currentNodeId, 'blocked stone gate cannot change rooms');
  assertSameDomainEvidence(blockedGateBaseline, await getRuntimeEvidence(cdp), 'blocked stone-gate interaction');
  assertCompactMap(blockedGate);
  await touchNode(cdp, 'MobileSheetClose');
  await waitForSnapshot(cdp, 'blocked gate map dismissed', snapshot => !snapshot.sheet.kind);
  await walkTo(cdp, { x: 500, y: 500 }, 'return-from-blocked-east-door');
  let chapterCodex;
  if (!compactFlow) {
  const codexControl = await queryNodePoint(cdp, 'SceneCodex');
  assert.equal(codexControl.found && codexControl.hasTouch, true, 'existing chapter codex remains reachable');
  const codexBaseline = await getRuntimeEvidence(cdp);
  await touchNode(cdp, 'SceneCodex');
  let codex = await waitForSnapshot(cdp, 'chapter objective sheet', (snapshot) => snapshot.sheet.kind === 'objectives');
  assert.equal(codex.sheet.scroll.present, true, 'chapter tasks are presented in a real scroll region');
  assert.equal(codex.sheet.taskRows.length, 4, 'opening chapter retains all four task rows');
  assert.deepEqual(codex.sheet.taskRows.map(({ name }) => name),
    codex.domain.tasks.map(({ id }) => `MobileSheetTask:${id}`), 'every active task is reachable from the objectives list');
  const chapterTaskCount = codex.sheet.taskRows.length;
  const rulesControl = await queryNodePoint(cdp, 'MobileSheetObjectiveRules');
  assert.equal(rulesControl.found && rulesControl.hasTouch, true, 'chapter rules footer remains touchable');
  assert.equal((await pointInsideHolder(cdp, 'MobileSheetObjectiveRules')).inside, true,
    'chapter rules footer is fully visible without scrolling the task list');
  await touchNode(cdp, 'MobileSheetObjectiveRules');
  codex = await waitForSnapshot(cdp, 'chapter rules and exploration facts',
    (snapshot) => snapshot.sheet.kind === 'objectives' && snapshot.sheet.readoutTitles.length >= 5);
  // The existing task-list footer opens every semantic chapter section in one
  // scroll document; rules navigation and dragging must preserve domain state.
  assert.equal(codex.sheet.legacyPaging, false, 'regular sheet content no longer uses pagination');
  assert.equal(codex.sheet.scroll.present, true, 'chapter codex is presented in a scroll region');
  const codexTitles = [...codex.sheet.readoutTitles];
  assert.ok(codexTitles.length >= 5, `chapter codex retains its semantic sections (${codexTitles.length})`);
  const codexOverflows = codex.sheet.scroll.content.height > codex.sheet.scroll.view.height + 1;
  assert.equal(codex.sheet.scroll.thumb, codexOverflows, 'gold thumb reflects chapter facts overflowing the real view');
  const codexOffsetBefore = codex.sheet.scroll.contentY;
  await dragSheet(cdp, -220, codex.sheet.scroll.name);
  codex = await getSceneSnapshot(cdp);
  if (codexOverflows) assert.ok(codex.sheet.scroll.contentY > codexOffsetBefore + 1,
    'physical drag scrolls the overflowing codex document');
  else assert.equal(codex.sheet.scroll.offset, 0, 'fitting chapter facts keep their scroll offset at zero');
  chapterCodex = { pageTitles: codexTitles, pageCount: codexTitles.length, taskCount: chapterTaskCount,
    overflows: codexOverflows };
  await save('11-chapter-codex', codex);
  await touchNode(cdp, 'MobileSheetClose');
  await waitForSnapshot(cdp, 'walking after objectives', (snapshot) => matchesWalking(snapshot, 'explore') && !snapshot.sheet.kind);
  assertSameDomainEvidence(codexBaseline, await getRuntimeEvidence(cdp), 'codex scrolling');
  }
  await walkTo(cdp, { x: 500, y: 490 }, 'approach-opening-monster');
  assert.equal((await getSceneSnapshot(cdp)).phase, 'explore', 'monster proximity alone does not start combat');
  await touchNode(cdp, 'WalkInteract');
  let encounter = await waitForSnapshot(cdp, 'walkable combat room', (snapshot) => matchesWalking(snapshot, 'combat'));
  assertWalking(encounter, 'combat');
  await save('12-combat', encounter);
  if (combatOnly) {
    await verifyCombatChoices(cdp, save, sceneEvidence);
    return { artifacts, sceneEvidence, movementEvidence, chapterCodex,
      combatOutcome: 'spell-and-medicine-choices-verified', physicalAttackCount: 0 };
  }
  const disabledCombat = encounter.domain.availableActions.find((action) => !action.enabled && action.actionId === 'combat.action:use_thunder_talisman');
  assert.ok(disabledCombat, 'opening combat fixture has a skill or item whose limitation can be inspected');
  const disabledBaseline = await getRuntimeEvidence(cdp);
  await touchNode(cdp, await findPhysicalAction(cdp, disabledCombat.actionId, 'combat'));
  await waitForSnapshot(cdp, 'disabled combat action explanation', (snapshot) => snapshot.sheet.kind === 'menu');
  await save('12b-disabled-skill-details', await getSceneSnapshot(cdp));
  assert.equal((await queryNodePoint(cdp, `MobileSheetExecute:${disabledCombat.actionId}`)).hasTouch, false);
  await touchNode(cdp, 'MobileSheetClose');
  assertSameDomainEvidence(disabledBaseline, await getRuntimeEvidence(cdp), 'reading an unavailable combat action');
  const combatMovementBaseline = await getRuntimeEvidence(cdp);
  assertContinuousMovement(await holdKey(cdp, 'w', 650, 'combat-free-walking'), 'y', -1, 'up');
  assertSameDomainEvidence(combatMovementBaseline, await getRuntimeEvidence(cdp), 'combat movement alone');
  let physicalAttackCount = 0;
  const openingPlayerHp = encounter.domain.playerHp;
  let combatInjuryObserved = false;
  while (encounter.phase === 'combat' && physicalAttackCount < 12) {
    const before = await getSceneSnapshot(cdp);
    combatInjuryObserved ||= before.domain.playerHp < openingPlayerHp;
    const baseline = await getRuntimeEvidence(cdp);
    const actionName = await findPhysicalAction(cdp, 'combat.action:attack', 'combat');
    await touchNode(cdp, actionName);
    physicalAttackCount += 1;
    encounter = await waitForSnapshot(cdp, 'response to physical combat attack ' + physicalAttackCount,
      (snapshot) => !snapshot.combatAnimating && (snapshot.phase !== 'combat' || (matchesWalking(snapshot, 'combat')
        && snapshot.domain.combatTurn > before.domain.combatTurn
        && snapshot.actions.touchableNames.some(name => name === 'WalkCombatAction:combat.action:attack' || name === 'WalkCombatAction:combat.action:weapon_skill'))));
    const after = await getRuntimeEvidence(cdp);
    assert.notEqual(after.stateSha256, baseline.stateSha256, 'physical attack updates gameplay state');
    sceneEvidence.push({ stage: 'physical-attack-' + physicalAttackCount, before: baseline, after,
      enemyHpBefore: before.domain.enemyHp, enemyHpAfter: encounter.domain.enemyHp, phase: encounter.phase });
    if (physicalAttackCount === 1) await save('13-combat-after-attack', encounter);
  }
  assert.equal(encounter.phase, 'explore', 'physical attacks must win and return to exploration');
  assert.equal(encounter.domain.currentNodeCleared, true, 'victory clears the room encounter');
  encounter = await waitForWalkingArtwork(cdp, 'explore');
  assertWalking(encounter, 'explore');
  assert.equal(combatInjuryObserved, true, 'physical combat must injure the player before victory recovery');
  const recoveredHealth = encounter.walking.status?.match(/^(\d+)\s*\/\s*(\d+)$/u);
  assert.ok(recoveredHealth, 'post-combat exploration shows the actual health readout');
  assert.ok(Number(recoveredHealth[2]) > 0, 'post-combat maximum health is positive');
  assert.equal(recoveredHealth[1], recoveredHealth[2], 'victory animation finishes with full health in the real HUD');
  assertDungeonGates(encounter, true);
  await save('14-victory-explore', encounter);
  // A naturally reached optional event must not hide the underlying trap choices.
  await walkTo(cdp, { x: 500, y: 500 }, 'leave-lower-room-pillars');
  await walkTo(cdp, { x: 790, y: 500 }, 'approach-east-trap-door');
  const arrivedGate = await getSceneSnapshot(cdp);
  assert.ok(arrivedGate.walking.targets.some(target => target.stoneGate?.state === '已到达入口'),
    'approaching a legal stone gate updates its arrival feedback');
  await save('14a-available-stone-gate', arrivedGate);
  await touchNode(cdp, 'WalkInteract');
  await waitForSnapshot(cdp, 'blood rune trap room', (snapshot) => snapshot.domain.currentNodeId === 'blood_rune_trap');
  await walkTo(cdp, { x: 500, y: 490 }, 'approach-trap-event');
  await touchNode(cdp, 'WalkInteract');
  const trap = await waitForSnapshot(cdp, 'optional event sheet', (snapshot) => snapshot.sheet.kind === 'interaction');
  assert.equal(trap.domain.pendingKind, 'dungeon-event');
  await save('14d-optional-event', trap);
  await touchNode(cdp, await findMobileAction(cdp, 'node.trap:blood_rune_trap:risk'));
  await save('14e-trap-risk-confirmation', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'MobileSheetExecute:node.trap:blood_rune_trap:risk');
  await waitForSnapshot(cdp, 'trap resolved without buying event prerequisites', (snapshot) =>
    snapshot.phase === 'explore' && snapshot.domain.currentNodeId === 'blood_rune_trap'
      && snapshot.domain.currentNodeCleared && !snapshot.sheet.kind);
  await touchNode(cdp, 'SceneMap');
  const map = await waitForSnapshot(cdp, 'mobile map', (snapshot) => snapshot.sheet.kind === 'map');
  assertCompactMap(map);
  await save('14b-mobile-map', map);
  const mapBaseline = await getRuntimeEvidence(cdp);
  const visible = cell => cell.screen.left >= map.sheet.mapViewport.screen.left - 0.5
    && cell.screen.right <= map.sheet.mapViewport.screen.right + 0.5
    && cell.screen.top >= map.sheet.mapViewport.screen.top - 0.5
    && cell.screen.bottom <= map.sheet.mapViewport.screen.bottom + 0.5;
  const inspected = map.domain.mapNodes.find(node => node.state !== 'fogged' && node.state !== 'current'
    && map.sheet.mapCellDetails.some(cell => cell.name === 'MobileSheetMapCell:' + node.cellId && visible(cell)));
  assert.ok(inspected, 'natural room transition reveals another selectable region inside the map viewport');
  await touchNode(cdp, 'MobileSheetMapCell:' + inspected.cellId);
  const selectedMap = await waitForSnapshot(cdp, 'selected region details below the map', snapshot =>
    snapshot.sheet.kind === 'map' && snapshot.sheet.mapDetailTitle === inspected.title);
  assertCompactMap(selectedMap);
  assert.equal(selectedMap.domain.currentNodeId, map.domain.currentNodeId, 'inspecting another region preserves current location');
  assertSameDomainEvidence(mapBaseline, await getRuntimeEvidence(cdp), 'selecting inline map details');
  sceneEvidence.push({ stage: 'map-selection-leaves-domain-unchanged', selectedCellId: inspected.cellId,
    currentNodeId: selectedMap.domain.currentNodeId, before: mapBaseline, after: await getRuntimeEvidence(cdp) });
  await save('14f-mobile-map-selected', selectedMap);
  await touchNode(cdp, 'MobileSheetClose');
  await touchNode(cdp, 'SceneHelp');
  await waitForSnapshot(cdp, 'mobile menu in explore', (snapshot) => snapshot.sheet.kind === 'menu');
  await openMenuActions(cdp);
  await touchNode(cdp, 'MobileSheetAction:run.retreat');
  await save('14c-retreat-confirmation', await getSceneSnapshot(cdp));
  await touchNode(cdp, 'MobileSheetExecute:run.retreat');
  let result = await waitForSnapshot(cdp, 'retreat result', (snapshot) => snapshot.phase === 'result');
  if (result.details.open) {
    await touchNode(cdp, 'SceneReturn');
    result = await waitForSnapshot(cdp, 'result scene', (snapshot) => snapshot.result.present);
  }
  assert.match(result.result.outcome, /主动撤退/u, 'original settlement outcome remains');
  assert.ok(result.result.loot?.length > 0, 'settlement retains the loot readout');
  await save('15-result', result);
  await touchNode(cdp, await findPhysicalAction(cdp, 'result.return-hub', 'result'));
  const returned = await waitForSnapshot(cdp, 'walking courtyard after settlement', matchesCourtyardArt);
  assertWalking(returned, 'hub');
  assertCourtyard(returned);
  await save('16-hub-returned', returned);
  return { artifacts, sceneEvidence, movementEvidence, chapterCodex,
    selectedChapters, combatOutcome: 'victory-returned-to-explore', physicalAttackCount };
}

// Isolated renderer fixtures, deliberately separate from the physical-input playthrough.
// These expose each chapter's existing ViewModel for visual coverage, never change a save,
// and are not evidence of naturally completing/unlocking nineteen campaigns.
async function runDungeonRendererGallery(cdp, outputDir) {
  const bundle = await build({ stdin: { contents: `
    export { createInitialState, DUNGEON_ORDER } from '@infinite-flow/core';
    export { reduceGameCommand } from '@infinite-flow/application';
    export { buildGameViewModel } from '@infinite-flow/presentation';
    export { getInfiniteFlowSceneVisualKeys } from './cocos/assets/scripts/ui/scene-visuals.ts';
  `, resolveDir: projectDir, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node' });
  const { createInitialState, DUNGEON_ORDER, reduceGameCommand, buildGameViewModel, getInfiniteFlowSceneVisualKeys } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const initial = createInitialState();
  const fixtureHub = { ...initial, rewardPoints: 50000, lingyun: 500, completedDungeonIds: [...DUNGEON_ORDER],
    inventory: Object.fromEntries(Object.keys(initial.inventory).map((key) => [key, 50])) };
  const baseline = await getRuntimeEvidence(cdp);
  const findApp = String.raw`
    const cc = await System.import('cc'); const nodes = [];
    const visit = node => { nodes.push(node); node.children.forEach(visit); }; visit(cc.director.getScene());
    const app = nodes.map(node => node.getComponent('InfiniteFlowApp')).find(Boolean);
    if (!app?.view || typeof app.requestVisualAsset !== 'function' || typeof app.refreshViewModel !== 'function') {
      throw new Error('Gallery requires the App-owned visual resource lifecycle');
    }
  `;
  const originalUi = await evaluate(cdp, `(async () => {
    ${findApp}
    return { phase: app.viewModel.phase, worldKey: app.view.walkWorldKey, activityMessage: app.activityMessage,
      primaryKey: app.desiredVisualKey,
      sceneKeys: Array.from(app.desiredSceneVisualKeys) };
  })()`);
  const backdropReady = (snapshot, key) => {
    const backdrop = snapshot.walking?.backdrops?.find((entry) => entry.name === `WalkDungeonBackdrop:${key}`);
    const record = snapshot.diagnostics?.visualRecords?.find((entry) => entry.key === key);
    return backdrop?.frame?.loaded && backdrop.frame.valid
      && backdrop.frame.textureWidth > 0 && backdrop.frame.textureHeight > 0
      && record?.acquired && record.sceneDisplayed && record.width > 0 && record.height > 0
      && snapshot.sceneAssets === 'ready';
  };
  const artifacts = [];
  let previousBackgroundKey;
  try {
    for (const dungeonId of DUNGEON_ORDER) {
      const entered = reduceGameCommand(fixtureHub, { type: 'run/enter', dungeonId, protocolId: 'standard',
        seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 } });
      assert.equal(entered.status, 'committed', `${dungeonId} fixture entry`);
      const model = buildGameViewModel(entered.state, {});
      const sceneVisualKeys = getInfiniteFlowSceneVisualKeys(model);
      const backgroundKey = `scene:dungeon_world_${dungeonId}`;
      assert.equal(sceneVisualKeys.background, backgroundKey, `${dungeonId}: real chapter backdrop key`);
      const expectedWorldKey = `explore:${dungeonId}:${model.sections[1].detail.map.currentNodeId}`;
      await evaluate(cdp, `(async () => {
        ${findApp}
        // Override only the presentation projection so asynchronous App render callbacks
        // keep this fixture visible. The client, reducer and storage remain untouched.
        app.viewModel = ${JSON.stringify(model)};
        app.requestVisualAsset(app.viewModel.visualAssetKey, ${JSON.stringify(Object.values(sceneVisualKeys))});
        app.render();
        return true;
      })()`);
      await waitForSnapshot(cdp, `${dungeonId} real backdrop SpriteFrame and lease`, (snapshot) =>
        matchesWalking(snapshot, 'explore') && snapshot.walking.worldKey === expectedWorldKey
          && backdropReady(snapshot, backgroundKey));
      await evaluate(cdp, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
      const snapshot = await getSceneSnapshot(cdp);
      assert.equal(snapshot.walking.worldKey, expectedWorldKey, 'fixture remains rendered after engine frames');
      assert.equal(Boolean(backdropReady(snapshot, backgroundKey)), true, `${dungeonId}: backdrop ready immediately before capture`);
      assert.equal(snapshot.walking.backdrops.length, 1, `${dungeonId}: one real backdrop is displayed`);
      assert.equal(snapshot.diagnostics.labels.some((label) => label.includes('场景加载中')), false,
        `${dungeonId}: screenshot must not capture the scene loading placeholder`);
      assert.ok(snapshot.diagnostics.desiredVisualKeys.includes(backgroundKey));
      if (previousBackgroundKey !== undefined) {
        assert.equal(snapshot.diagnostics.desiredVisualKeys.includes(previousBackgroundKey), false,
          'switching chapters retires the previous background intent');
        assert.equal(snapshot.diagnostics.visualRecords.some((record) => record.key === previousBackgroundKey), false,
          'switching chapters releases the previous App-owned background lease');
      }
      const backdrop = snapshot.walking.backdrops[0];
      const record = snapshot.diagnostics.visualRecords.find((entry) => entry.key === backgroundKey);
      artifacts.push({ fixtureOnly: true, worldKey: expectedWorldKey,
        title: model.sections[1].detail.map.dungeonName, backgroundKey,
        backdrop: { name: backdrop.name, frame: backdrop.frame, box: backdrop.box,
          acquired: record.acquired, sceneDisplayed: record.sceneDisplayed, width: record.width, height: record.height },
        ...await captureStage(cdp, outputDir, `gallery-${dungeonId}.png`, `renderer-fixture:${dungeonId}`, snapshot) });
      previousBackgroundKey = backgroundKey;
    }
  } finally {
    await evaluate(cdp, `(async () => {
      ${findApp}
      app.activityMessage = ${JSON.stringify(originalUi.activityMessage)};
      // Rebuild from the untouched client and local UI state; the same lifecycle retires
      // gallery frames, textures and leases, then reloads the original scene resources.
      app.refreshViewModel();
      return true;
    })()`);
    const restored = await waitForSnapshot(cdp, 'live scene restored after renderer gallery', (snapshot) =>
      matchesWalking(snapshot, originalUi.phase) && snapshot.walking.worldKey === originalUi.worldKey
        && [originalUi.primaryKey, ...originalUi.sceneKeys].filter(Boolean).every((key) => {
          const record = snapshot.diagnostics.visualRecords.find((entry) => entry.key === key);
          return record?.acquired && record.width > 0 && record.height > 0
            && (!originalUi.sceneKeys.includes(key) || record.sceneDisplayed);
        })
        && snapshot.diagnostics.visualRecords.every((record) => !record.key.startsWith('scene:dungeon_world_')
          || originalUi.sceneKeys.includes(record.key)));
    await evaluate(cdp, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    assert.deepEqual([...restored.diagnostics.desiredVisualKeys].sort(), [...originalUi.sceneKeys].sort(),
      'renderer gallery restores the original scene resource requests');
    const restoredEvidence = await getRuntimeEvidence(cdp);
    assertSameDomainEvidence(baseline, restoredEvidence, 'renderer gallery never changes live gameplay');
    assert.equal(restoredEvidence.viewModelSha256, baseline.viewModelSha256,
      'renderer gallery restores the original public model from the unchanged client');
  }
  assert.equal(artifacts.length, 19, 'all nineteen real chapter backgrounds are captured');
  return { scope: '19 isolated real-ViewModel and real-resource renderer fixtures; not campaign completion',
    count: artifacts.length, artifacts };
}

// Isolated approved-art fixtures. They use the real presentation builders and
// App resource lifetimes; screenshots do not claim campaign unlock/completion.
async function runStyleRefreshGallery(cdp, outputDir) {
  const captureKey = '__INFINITE_FLOW_STYLE_SMOKE_MODELS__';
  globalThis[captureKey] = [];
  const bundle = await build({
    stdin: { contents: `
      import './packages/presentation/test/view-model.test.ts';
      export { createInitialState, DUNGEON_ORDER, DUNGEONS } from '@infinite-flow/core';
      export { reduceGameCommand } from '@infinite-flow/application';
      export { buildGameViewModel } from '@infinite-flow/presentation';
      export { signalFirstNodeClear } from '@infinite-flow/core/dungeon-laws';
      export { getInfiniteFlowSceneVisualKeys } from './cocos/assets/scripts/ui/scene-visuals.ts';
      export { buildWalkWorld } from './cocos/assets/scripts/ui/walk-world.ts';
    `, resolveDir: projectDir, loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'approved-art-real-projections', setup(builder) {
      builder.onLoad({ filter: /packages\/presentation\/src\/view-model\.ts$/ }, async ({ path: sourcePath }) => {
        const source = await readFile(sourcePath, 'utf8');
        assert.equal(source.split('export function buildGameViewModel(').length, 2);
        return { loader: 'ts', contents: source.replace('export function buildGameViewModel(', 'function capturedBuildGameViewModel(') + `
          export function buildGameViewModel(...args: Parameters<typeof capturedBuildGameViewModel>) {
            const model = capturedBuildGameViewModel(...args);
            (globalThis as any)[${JSON.stringify(captureKey)}]?.push(model);
            return model;
          }
        ` };
      });
    } }],
  });
  const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const models = globalThis[captureKey];
  delete globalThis[captureKey];
  const initial = api.createInitialState();
  const rich = { ...initial, rewardPoints: 50000, lingyun: 500, completedDungeonIds: [...api.DUNGEON_ORDER],
    inventory: Object.fromEntries(Object.keys(initial.inventory).map(key => [key, 50])) };
  for (const dungeonId of api.DUNGEON_ORDER) {
    const entered = api.reduceGameCommand(rich, { type: 'run/enter', dungeonId, protocolId: 'standard',
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 } });
    assert.equal(entered.status, 'committed');
    for (const node of api.DUNGEONS[dungeonId].nodes) {
      for (const cleared of [false, true]) {
        models.push(api.buildGameViewModel({ ...entered.state, run: { ...entered.state.run,
          currentNodeId: node.id, clearedNodeIds: cleared ? [node.id] : [],
          lawState: cleared ? api.signalFirstNodeClear(entered.state.run.lawState, { node, damageTaken: 0 }) : entered.state.run.lawState,
        } }, {}));
      }
    }
  }
  for (const hubPanel of ['methods', 'bloodlines', 'equipment', 'companions']) {
    models.push(api.buildGameViewModel(rich, { hubPanel }));
  }
  const enteredMirror = api.reduceGameCommand(rich, { type: 'run/enter', dungeonId: 'mirror_cycle_city', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 } });
  assert.equal(enteredMirror.status, 'committed');
  const retreatMirror = api.reduceGameCommand(enteredMirror.state, { type: 'run/retreat' });
  assert.equal(retreatMirror.status, 'committed');
  const mirrorModel = api.buildGameViewModel(retreatMirror.state, {});
  assert.equal(mirrorModel.visualAssetKey, 'dungeon:mirror_cycle_city');
  const sourceManifest = JSON.parse(await readFile(path.join(cocosDir, 'assets/config/asset-manifest.json'), 'utf8'));
  const approvedAssets = sourceManifest.assets.filter(asset => asset.sourceFile.includes('/prototype/style-refresh/assets/'));
  assert.equal(approvedAssets.length, 26, 'gallery scope matches the 26 approved source assets');
  const sourceByKey = new Map(await Promise.all(approvedAssets.map(async asset => {
    const meta = JSON.parse(await readFile(path.join(cocosDir, 'assets/resources', asset.resourceFile + '.meta'), 'utf8'));
    return [asset.key, { key: asset.key, resourcePath: asset.resourcePath, sourceUuid: meta.uuid,
      width: asset.width, height: asset.height, sha256: asset.targetSha256 }];
  })));
  const findApp = String.raw`
    const cc = await System.import('cc'); const nodes = [];
    const visit = node => { nodes.push(node); node.children.forEach(visit); }; visit(cc.director.getScene());
    const app = nodes.map(node => node.getComponent('InfiniteFlowApp')).find(Boolean);
    if (!app?.view || typeof app.requestVisualAsset !== 'function' || typeof app.primeSheetFigures !== 'function') {
      throw new Error('Approved-art gallery requires the existing App-owned scene and figure lifetimes');
    }
  `;
  const baseline = await getRuntimeEvidence(cdp);
  const originalUi = await evaluate(cdp, `(async () => { ${findApp}
    return { phase: app.viewModel.phase, worldKey: app.view.walkWorldKey, activityMessage: app.activityMessage,
      primaryKey: app.desiredVisualKey, sceneKeys: Array.from(app.desiredSceneVisualKeys), mobileSheet: app.view.mobileSheet };
  })()`);
  const frameReady = (entry, key) => entry?.frame?.loaded && entry.frame.valid
    && entry.frame.registeredResourceKeys.includes(key)
    && entry.frame.textureWidth === sourceByKey.get(key).width && entry.frame.textureHeight === sourceByKey.get(key).height;
  const loadedSprite = (snapshot, key, name) => snapshot.diagnostics?.activeSprites?.find(entry =>
    (name === undefined || entry.name === name) && frameReady(entry, key));
  const artifacts = [];
  const coveredKeys = new Set();
  async function show(model, sheet) {
    const keys = Object.values(api.getInfiniteFlowSceneVisualKeys(model));
    await evaluate(cdp, `(async () => { ${findApp}
      app.view.mobileSheet = undefined;
      app.viewModel = ${JSON.stringify(model)};
      app.requestVisualAsset(app.viewModel.visualAssetKey, ${JSON.stringify(keys)});
      app.primeSheetFigures();
      app.render();
      app.view.mobileSheet = ${JSON.stringify(sheet) ?? 'undefined'};
      app.render(); return true;
    })()`);
  }
  async function capture(name, snapshot, keys) {
    const frames = keys.map(key => {
      const preferredName = key.startsWith('item:') || key.startsWith('equipment:') ? 'CatalogDetailIcon:Sprite'
        : key === 'character:reincarnator' ? 'DollPortrait:Sprite'
          : key === 'npc:companion_guide' ? 'MobileSheetNpcPortrait:Sprite'
            : key === 'dungeon:mirror_cycle_city' ? 'WorldBackground:dungeon:mirror_cycle_city'
              : `WalkDungeonPropSprite:${key.slice('scene:dungeon_prop_'.length)}`;
      const sprite = loadedSprite(snapshot, key, preferredName);
      assert.ok(sprite, `${key}: current active scene has its acquired SpriteFrame`);
      const record = snapshot.diagnostics.visualRecords.find(record => record.key === key)
        ?? snapshot.sheet.figureRecords.find(record => record.key === key);
      assert.ok(record, `${key}: frame is owned by the existing asset lifecycle`);
      const source = sourceByKey.get(key);
      if (record.imageUuid) assert.equal(record.imageUuid, source.sourceUuid, `${key}: engine ImageAsset identity matches the source metadata`);
      coveredKeys.add(key);
      return { ...source, imageUuid: record.imageUuid, frame: sprite.frame, node: sprite.name, box: sprite.box, screen: sprite.screen };
    });
    artifacts.push({ fixtureOnly: true, keys, frames,
      ...await captureStage(cdp, outputDir, `style-refresh-${name}.png`, `approved-art-fixture:${name}`, snapshot) });
  }
  try {
    for (const kind of ['chest', 'exit', 'event', 'trap', 'survey', 'relic', 'shrine', 'law']) {
      const model = models.find(model => model.phase === 'explore' && api.buildWalkWorld(model).targets.some(target => target.kind === kind));
      assert.ok(model, `${kind}: authentic projection exists`);
      const key = `scene:dungeon_prop_${kind}`;
      await show(model);
      const snapshot = await waitForSnapshot(cdp, `approved ${kind} and debris frames`, snapshot =>
        matchesWalking(snapshot, 'explore') && loadedSprite(snapshot, key, `WalkDungeonPropSprite:${kind}`)
          && loadedSprite(snapshot, 'scene:dungeon_prop_debris', 'WalkDungeonPropSprite:debris')
          && snapshot.sceneAssets === 'ready');
      assert.equal(snapshot.diagnostics.desiredVisualKeys.includes('scene:hub_dungeon_portal'), false);
      await capture(kind, snapshot, [key, 'scene:dungeon_prop_debris']);
    }
    for (const asset of approvedAssets.filter(asset => ['item', 'equipment'].includes(asset.kind))) {
      const model = models.find(model => model.phase === 'hub' && model.sections[1].detail.shop?.rows.some(row => row.visualAssetKey === asset.key));
      assert.ok(model, `${asset.key}: unchanged catalog projection contains the approved image key`);
      const row = model.sections[1].detail.shop.rows.find(row => row.visualAssetKey === asset.key);
      await show(model, { kind: 'npc', page: 0, catalogRowId: row.id });
      const snapshot = await waitForSnapshot(cdp, `${asset.key} real catalog detail image`, snapshot =>
        snapshot.sheet?.catalogDetail?.present && loadedSprite(snapshot, asset.key, 'CatalogDetailIcon:Sprite'));
      await capture(asset.key.replace(':', '-'), snapshot, [asset.key]);
    }
    const guide = models.find(model => model.phase === 'hub' && model.sections[1].detail.shop?.portraitAssetKey === 'npc:companion_guide');
    assert.ok(guide);
    await show(guide, { kind: 'npc', page: 0 });
    const guideSnapshot = await waitForSnapshot(cdp, 'approved companion guide portrait', snapshot =>
      snapshot.sheet?.kind === 'npc' && loadedSprite(snapshot, 'npc:companion_guide', 'MobileSheetNpcPortrait:Sprite'));
    await capture('companion-guide', guideSnapshot, ['npc:companion_guide']);
    await show(api.buildGameViewModel(rich, { hubPanel: 'entry' }), { kind: 'character', page: 0 });
    const portraitSnapshot = await waitForSnapshot(cdp, 'approved reincarnator portrait', snapshot =>
      snapshot.sheet?.kind === 'character' && loadedSprite(snapshot, 'character:reincarnator', 'DollPortrait:Sprite'));
    await capture('reincarnator', portraitSnapshot, ['character:reincarnator']);
    await show(mirrorModel);
    const mirrorSnapshot = await waitForSnapshot(cdp, 'approved mirror city actual settlement cover', snapshot =>
      snapshot.result?.present && loadedSprite(snapshot, 'dungeon:mirror_cycle_city', 'WorldBackground:dungeon:mirror_cycle_city'));
    const mirrorWindow = mirrorSnapshot.diagnostics.worldBackgroundWindows.find(entry => entry.name === 'WorldBackgroundWindow:dungeon:mirror_cycle_city');
    assert.ok(mirrorWindow?.clipped, 'actual mirror settlement cover stays within its mask');
    assert.deepEqual({ width: mirrorWindow.box.width, height: mirrorWindow.box.height }, { width: 750, height: 600 }, 'mirror cover retains the actual settlement viewport');
    const mirrorArt = loadedSprite(mirrorSnapshot, 'dungeon:mirror_cycle_city', 'WorldBackground:dungeon:mirror_cycle_city');
    assert.equal(mirrorArt.box.width / mirrorArt.box.height, 3, 'mirror settlement cover preserves the approved 3:1 banner proportions');
    assert.deepEqual({ x: mirrorArt.box.x, y: mirrorArt.box.y, width: mirrorArt.box.width, height: mirrorArt.box.height }, { x: 0, y: 0, width: 1800, height: 600 }, 'mirror banner is centered and covers the settlement mask');
    await capture('mirror-city-result', mirrorSnapshot, ['dungeon:mirror_cycle_city']);
  } finally {
    await evaluate(cdp, `(async () => { ${findApp}
      app.activityMessage = ${JSON.stringify(originalUi.activityMessage)};
      app.view.mobileSheet = undefined; app.refreshViewModel();
      app.view.mobileSheet = ${JSON.stringify(originalUi.mobileSheet) ?? 'undefined'}; app.render(); return true;
    })()`);
    const restored = await waitForSnapshot(cdp, 'live gameplay restored after approved-art gallery', snapshot =>
      matchesWalking(snapshot, originalUi.phase) && snapshot.walking.worldKey === originalUi.worldKey
        && [originalUi.primaryKey, ...originalUi.sceneKeys].filter(Boolean).every(key => {
          const record = snapshot.diagnostics.visualRecords.find(record => record.key === key);
          return record?.acquired && record.width > 0 && record.height > 0;
        })
        && snapshot.diagnostics.visualRecords.every(record => !record.key.startsWith('scene:dungeon_prop_')));
    assert.deepEqual([...restored.diagnostics.desiredVisualKeys].sort(), [...originalUi.sceneKeys].sort());
    const evidence = await getRuntimeEvidence(cdp);
    assertSameDomainEvidence(baseline, evidence, 'approved-art gallery never changes live gameplay or storage');
    assert.equal(evidence.viewModelSha256, baseline.viewModelSha256, 'original public model is restored from the unchanged client');
  }
  assert.equal(coveredKeys.size, 26, 'all 26 approved image identities have real-engine SpriteFrame evidence');
  return { scope: 'isolated real projections and App-owned resources; not campaign completion',
    count: artifacts.length, coveredKeys: [...coveredKeys], artifacts };
}

const runtimeEvidenceExpression = String.raw`(async () => {
  try {
    const cc = await System.import('cc');
    const scene = cc.director.getScene();
    if (!scene) return { ready: false, reason: 'scene-unavailable' };
    const nodes = [];
    const walk = (node) => {
      nodes.push(node);
      for (const child of node.children) walk(child);
    };
    walk(scene);
    const app = nodes
      .map((node) => node.getComponent('InfiniteFlowApp'))
      .find((component) => component !== null && component !== undefined);
    if (!app || !app.client || typeof app.client.getState !== 'function'
      || typeof app.client.getRevisionStatus !== 'function') {
      return { ready: false, reason: 'runtime-unavailable' };
    }
    const stateJson = JSON.stringify(app.client.getState());
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stateJson));
    const stateSha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const viewModelDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(app.viewModel)));
    const viewModelSha256 = Array.from(new Uint8Array(viewModelDigest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const revision = app.client.getRevisionStatus();
    return {
      ready: true,
      rawActivity: app.activityMessage,
      durableRevision: revision.durableRevision,
      stateSha256,
      viewModelSha256,
    };
  } catch {
    // Never return or embed the state payload in diagnostics.
    return { ready: false, reason: 'runtime-evidence-failed' };
  }
})()`;


async function queryNodePoint(cdp, exactName) {
  return evaluate(cdp, String.raw`(async () => {
    const cc = await System.import('cc');
    const scene = cc.director.getScene();
    if (!scene) return { found: false, reason: 'scene unavailable' };
    const nodes = [];
    const walk = (node) => {
      nodes.push(node);
      for (const child of node.children) walk(child);
    };
    walk(scene);
    const node = nodes.find((candidate) => candidate.name === ${JSON.stringify(exactName)} && candidate.activeInHierarchy);
    if (!node) return { found: false, reason: 'node unavailable' };
    const cameraNode = nodes.find((candidate) => candidate.getComponent(cc.Camera));
    const camera = cameraNode?.getComponent(cc.Camera);
    const canvas = document.querySelector('canvas');
    const transform = node.getComponent(cc.UITransform);
    if (!camera || !canvas || !transform) return { found: false, reason: 'camera, canvas, or UITransform unavailable' };
    const screen = new cc.Vec3();
    camera.worldToScreen(node.worldPosition, screen);
    const rect = canvas.getBoundingClientRect();
    const corner = new cc.Vec3();
    camera.worldToScreen(transform.convertToWorldSpaceAR(new cc.Vec3(
      transform.contentSize.width / 2, transform.contentSize.height / 2, 0,
    )), corner);
    const touchEvents = [
      cc.Node.EventType.TOUCH_START,
      cc.Node.EventType.TOUCH_MOVE,
      cc.Node.EventType.TOUCH_END,
      cc.Node.EventType.TOUCH_CANCEL,
    ];
    return {
      found: true,
      name: node.name,
      width: transform.contentSize.width,
      height: transform.contentSize.height,
      screenWidth: Math.abs(corner.x - screen.x) * 2 / canvas.width * rect.width,
      screenHeight: Math.abs(corner.y - screen.y) * 2 / canvas.height * rect.height,
      hasTouch: touchEvents.some((eventName) => node.hasEventListener(eventName)),
      x: rect.left + (screen.x / canvas.width) * rect.width,
      y: rect.top + ((canvas.height - screen.y) / canvas.height) * rect.height,
    };
  })()`);
}

let physicalTouchSequence = 0;
async function touchNode(cdp, exactName) {
  const target = await queryNodePoint(cdp, exactName);
  assert.equal(target.found, true, `${exactName} must be freshly queryable before physical input: ${target.reason ?? ''}`);
  assert.equal(target.hasTouch, true, `${exactName} must expose an enabled Cocos touch listener`);
  assert.ok(target.width >= 44 && target.height >= 44, `${exactName} must retain a >=44 design-pixel touch target`);
  assert.ok(target.x >= 0 && target.x <= viewport.width, `${exactName} touch x must be inside the viewport`);
  assert.ok(target.y >= 0 && target.y <= viewport.height, `${exactName} touch y must be inside the viewport`);
  // CDP identifiers only need to be unique among active points. Reuse the
  // browser adapter's bounded single-touch slots after every completed END.
  const touchId = (physicalTouchSequence % 3) + 1;
  physicalTouchSequence += 1;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{
      x: target.x,
      y: target.y,
      id: touchId,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    }],
  });
  await delay(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// Dispatch one physical touch at raw viewport coordinates.
async function tapScreen(cdp, x, y) {
  const touchId = (physicalTouchSequence % 3) + 1;
  physicalTouchSequence += 1;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: touchId, radiusX: 2, radiusY: 2, force: 1 }],
  });
  await delay(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(160);
}

// Physically drag the sheet's scroll region by `distance` screen px (negative
// scrolls content upward). The region is a real ScrollView, so this exercises
// momentum, masking and inner-event cancellation rather than a pager button.
async function dragSheet(cdp, distance, regionName = 'MobileSheetScroll') {
  const region = await queryNodePoint(cdp, regionName);
  assert.equal(region.found, true, `${regionName} scroll region must be queryable`);
  assert.ok(region.screenHeight > 48, `${regionName} must have physical room for an in-window drag`);
  distance = Math.sign(distance) * Math.min(Math.abs(distance), region.screenHeight - 48);
  const startX = region.x;
  // Up and down drags both begin opposite their travel direction, with both
  // endpoints fully inside the real masked region.
  const startY = region.y - distance / 2;
  const touchId = (physicalTouchSequence % 3) + 1;
  physicalTouchSequence += 1;
  const steps = 8;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY, id: touchId, radiusX: 2, radiusY: 2, force: 1 }],
  });
  for (let step = 1; step <= steps; step += 1) {
    await delay(16);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: startY + (distance * step) / steps, id: touchId, radiusX: 2, radiusY: 2, force: 1 }],
    });
  }
  await delay(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(260);
}

function pointInsideHolder(cdp, nodeName) {  return evaluate(cdp, String.raw`(async () => {
    const cc = await System.import('cc');
    const scene = cc.director.getScene();
    const nodes = [];
    const walk = (node) => { nodes.push(node); for (const child of node.children) walk(child); };
    walk(scene);
    const find = (name) => nodes.find((candidate) => candidate.name === name && candidate.activeInHierarchy);
    const target = find(${JSON.stringify(nodeName)});
    let holder = target?.parent;
    while (holder && !holder.getComponent(cc.ScrollView)) holder = holder.parent;
    if (!target) return { inside: false };
    const cameraNode = nodes.find((candidate) => candidate.getComponent(cc.Camera));
    const screen = new cc.Vec3();
    cameraNode.getComponent(cc.Camera).worldToScreen(target.worldPosition, screen);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const toCanvasY = (sy) => rect.top + ((canvas.height - sy) / canvas.height) * rect.height;
    const ty = toCanvasY(screen.y);
    const screenHeight = (node) => {
      const transform = node.getComponent(cc.UITransform);
      const top = transform.convertToWorldSpaceAR(new cc.Vec3(0, transform.contentSize.height / 2, 0));
      const bottom = transform.convertToWorldSpaceAR(new cc.Vec3(0, -transform.contentSize.height / 2, 0));
      const a = new cc.Vec3(), b = new cc.Vec3();
      cameraNode.getComponent(cc.Camera).worldToScreen(top, a);
      cameraNode.getComponent(cc.Camera).worldToScreen(bottom, b);
      return Math.abs(toCanvasY(a.y) - toCanvasY(b.y));
    };
    const targetHalf = screenHeight(target) / 2;
    const roundingTolerance = 0.0001;
    // Catalog footers and fixed character controls already sit outside the
    // scrolling region. They need no drag when their full target is visible.
    if (!holder) return { inside: ty - targetHalf >= rect.top - roundingTolerance
      && ty + targetHalf <= rect.bottom + roundingTolerance, fixed: true };
    const hScreen = new cc.Vec3();
    cameraNode.getComponent(cc.Camera).worldToScreen(holder.worldPosition, hScreen);
    const hy = toCanvasY(hScreen.y);
    const h = screenHeight(holder);
    const scroll = holder.getComponent(cc.ScrollView);
    const maxDrag = targetHalf > h * 0.35 ? 48 : Math.max(48, h / 2 - 24);
    return { inside: ty - targetHalf >= hy - h / 2 - roundingTolerance
        && ty + targetHalf <= hy + h / 2 + roundingTolerance,
      y: ty, holderY: hy, holderName: holder.name,
      holderHeight: h, targetHeight: targetHalf * 2,
      offset: scroll.getScrollOffset().y,
      dragDistance: Math.sign(hy - ty) * Math.min(maxDrag, Math.max(8, Math.abs(hy - ty) / 2)) };
  })()`);
}

// Scroll the open sheet until an offscreen card is inside the masked region.
async function bringSheetNodeIntoView(cdp, nodeName) {
  let lastOffset = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const hit = await pointInsideHolder(cdp, nodeName);
    if (hit.fixed && hit.inside) return;
    assert.ok(Number.isFinite(hit.offset), `${nodeName} must expose its actual masked ScrollView offset`);
    if (hit.inside) {
      // A physical drag leaves Cocos inertia running after the finger lifts.
      // Wait for it to settle before deriving the next physical tap position.
      let previous = hit.offset;
      for (let settle = 0; settle < 15; settle += 1) {
        await delay(120);
        const current = (await pointInsideHolder(cdp, nodeName)).offset;
        assert.ok(Number.isFinite(current), `${nodeName} scroll offset remains observable while inertia settles`);
        if (Math.abs(current - previous) < 0.1) break;
        previous = current;
      }
      if ((await pointInsideHolder(cdp, nodeName)).inside) return;
    }
    if (lastOffset !== null && Math.abs(hit.offset - lastOffset) < 0.5) {
      throw new Error(`sheet scroll reached its end without revealing ${nodeName}`);
    }
    lastOffset = hit.offset;
    // Large carry cards retain small drags. Compact rows use the actual view
    // height, so a complete chapter list can be crossed in bounded gestures.
    await dragSheet(cdp, hit.dragDistance, hit.holderName);
  }
  throw new Error(`sheet scroll did not reveal ${nodeName}`);
}


function readPngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.subarray(0, 8).equals(signature), true, 'captured artifact must be a PNG');
  return Object.freeze({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
}


function isFaviconUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).pathname === '/favicon.ico';
  } catch {
    return value.includes('favicon.ico');
  }
}

function collectBrowserFailures(events) {
  const requestUrls = new Map();
  for (const event of events) {
    if (event.method === 'Network.requestWillBeSent') {
      requestUrls.set(event.params?.requestId, event.params?.request?.url);
    }
  }
  return events.flatMap((event) => {
    if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params?.exceptionDetails;
      return [`runtime.exception: ${details?.exception?.description ?? details?.text ?? 'unknown exception'}`];
    }
    if (event.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(event.params?.type)) {
      const args = (event.params?.args ?? []).map((arg) => (
        arg.value ?? arg.unserializableValue ?? arg.description ?? arg.type
      ));
      return [`console.${event.params.type}: ${args.join(' ')}`];
    }
    if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') {
      const entry = event.params.entry;
      if (isFaviconUrl(entry.url) || entry.text?.includes('favicon.ico')) return [];
      return [`log.error: ${entry.url ?? 'unknown URL'} ${entry.text ?? 'unknown error'}`];
    }
    if (event.method === 'Network.loadingFailed') {
      const failure = event.params;
      const url = requestUrls.get(failure?.requestId);
      if (isFaviconUrl(url) || failure?.canceled) return [];
      return [`network.failed: ${url ?? 'unknown URL'} ${failure?.errorText ?? 'unknown failure'}`];
    }
    if (event.method === 'Network.responseReceived' && event.params?.response?.status >= 400) {
      const response = event.params.response;
      if (isFaviconUrl(response.url)) return [];
      return [`http.${response.status}: ${response.url}`];
    }
    return [];
  });
}

// --- Debug style gallery (?gallery=1) ---------------------------------------

const gallerySnapshotExpression = String.raw`(async () => {
  const cc = await System.import('cc');
  const scene = cc.director.getScene();
  if (!scene) return { ready: false, reason: 'scene unavailable' };
  const all = [];
  const walk = (node, output = all) => { output.push(node); for (const child of node.children) walk(child, output); };
  walk(scene, all);
  const host = all.find((node) => node.name === 'SheetGalleryHost' && node.activeInHierarchy);
  if (!host) return { ready: false, reason: 'gallery host unavailable' };
  const nodes = [];
  walk(host, nodes);
  const find = (name) => nodes.find((node) => node.name === name && node.activeInHierarchy);
  const label = (name) => find(name)?.getComponent(cc.Label)?.string;
  const control = (name) => {
    const node = find(name);
    const transform = node?.getComponent(cc.UITransform);
    return {
      present: Boolean(node),
      height: transform?.contentSize.height ?? 0,
      touchStart: Boolean(node?.hasEventListener(cc.Node.EventType.TOUCH_START)),
      touchEnd: Boolean(node?.hasEventListener(cc.Node.EventType.TOUCH_END)),
    };
  };
  const mountedSheet = ['character', 'menu', 'inventory']
    .map((kind) => ({ kind, present: Boolean(find('MobileInfoSheet:' + kind)) }))
    .filter((entry) => entry.present);
  return {
    ready: true,
    caption: label('CaptionTitle'),
    reference: label('CaptionReference'),
    bar: Boolean(find('SheetGalleryBar')),
    mountedSheet: mountedSheet[0]?.kind,
    shortcuts: nodes.filter((node) => node.name.startsWith('MobileSheetShortcut:') && node.activeInHierarchy).length,
    items: nodes.filter((node) => node.name.startsWith('MobileSheetItem:') && node.activeInHierarchy).length,
    seals: nodes.filter((node) => node.name === 'ItemCarriedSeal' && node.activeInHierarchy).length,
    equipSlots: nodes.filter((node) => node.name.startsWith('MobileSheetEquip:') && node.activeInHierarchy).length,
    prevTheme: control('SheetGalleryPrevTheme'),
    nextTheme: control('SheetGalleryNextTheme'),
    exit: control('SheetGalleryExit'),
    kindControls: ['character', 'menu', 'inventory'].map((kind) => control('SheetGalleryKind:' + kind)),
  };
})()`;

async function getGallerySnapshot(cdp) {
  return evaluate(cdp, gallerySnapshotExpression);
}

async function waitForGallery(cdp, label) {
  return waitForPredicate(cdp, label, async () => {
    const snapshot = await getGallerySnapshot(cdp);
    return snapshot.ready ? snapshot : undefined;
  });
}

async function waitForPredicate(cdp, label, read) {
  const deadline = Date.now() + stateTimeoutMs;
  let lastSnapshot;
  let lastError;
  while (Date.now() < deadline) {
    try {
      lastSnapshot = await read();
      if (lastSnapshot) return lastSnapshot;
    } catch (error) { lastError = error; }
    await delay(120);
  }
  throw new Error('Timed out waiting for ' + label + '. Last scene: '
    + JSON.stringify(lastSnapshot) + (lastError ? ' Evaluation error: ' + formatError(lastError) : ''));
}

const GALLERY_KIND_NAMES = ['character', 'menu', 'inventory'];

async function runSheetStyleGallery(cdp, outputDir) {
  // Second navigation into the debug-only query entry; the static server ignores
  // the query string and serves the same web-mobile build.
  await cdp.send('Page.navigate', { url: `${staticServerUrl}?gallery=1` });
  let snapshot = await waitForGallery(cdp, 'style gallery overlay');
  await evaluate(cdp, "(async () => { const cc = await System.import('cc'); cc.profiler.hideStats(); return true; })()");
  snapshot = await getGallerySnapshot(cdp);
  assert.equal(snapshot.mountedSheet, 'character', 'gallery opens on the character sheet');
  assert.equal(snapshot.caption, '1 / 10 · 赤金铁券', 'gallery caption for style 1');
  assert.equal(snapshot.bar, true, 'switcher bar visible');
  assert.equal(snapshot.prevTheme.touchStart, false, 'previous control disabled at first style');
  assert.equal(snapshot.nextTheme.touchStart, true, 'next control enabled at first style');
  for (const kind of GALLERY_KIND_NAMES) {
    const queried = await queryNodePoint(cdp, `SheetGalleryKind:${kind}`);
    assert.equal(queried.found, true, `${kind}: kind control on screen`);
    assert.equal(queried.hasTouch, true, `${kind}: kind control touch bound`);
    assert.equal(queried.height, 104, `${kind}: 104 design-px touch height`);
  }

  // Physically drag the character metric ScrollView once: real momentum/mask
  // path under gallery theming, not a pager button.
  const metricScroll = await queryNodePoint(cdp, 'MobileSheetScroll');
  assert.equal(metricScroll.found, true, 'character metric scroll region queryable');
  await dragSheet(cdp, -220);
  assert.equal((await queryNodePoint(cdp, 'MobileSheetScroll')).found, true, 'scroll region survives the physical drag');

  const artifacts = [];
  const galleryViewSnapshot = { walking: { present: false }, result: { present: false } };
  const shot = async (index, kind, frame) => {
    const file = `sheet-gallery-${String(index + 1).padStart(2, '0')}-${kind}.png`;
    const captured = await captureStage(cdp, outputDir, file, `sheet-gallery-${index + 1}-${kind}`, galleryViewSnapshot);
    artifacts.push({ themeIndex: index, kind, file: captured.file, caption: frame.caption });
  };

  // Walk styles 1..10 via the real next control and visit all three sheets per
  // style, so every style x sheet combination is captured (30 screenshots).
  for (let index = 0; index < 10; index += 1) {
    if (index > 0) {
      await touchNode(cdp, 'SheetGalleryNextTheme');
      snapshot = await waitForGallery(cdp, `style ${index + 1} advance`);
    }
    for (let kindCursor = 0; kindCursor < GALLERY_KIND_NAMES.length; kindCursor += 1) {
      const kind = GALLERY_KIND_NAMES[kindCursor];
      // Style 1 opens already on character; every other step needs an explicit touch.
      if (!(index === 0 && kindCursor === 0)) {
        await touchNode(cdp, `SheetGalleryKind:${kind}`);
        snapshot = await waitForGallery(cdp, `style ${index + 1} ${kind}`);
      }
      assert.ok(snapshot.caption.startsWith(`${index + 1} / 10 · `), `style ${index + 1}: caption prefix`);
      assert.equal(snapshot.mountedSheet, kind, `style ${index + 1}: ${kind} sheet mounted`);
      assert.equal(snapshot.bar, true, 'switcher bar stays mounted');
      if (kind === 'menu') assert.equal(snapshot.shortcuts, 9, 'menu: nine shortcut tiles');
      if (kind === 'inventory') {
        assert.equal(snapshot.items, 3, 'inventory 道具 tab: three supply cells');
        assert.equal(snapshot.seals, 0, 'inventory 道具 tab: no prepared seals');
      }
      if (kind === 'character') assert.equal(snapshot.equipSlots, 7, 'character: seven equip slots');
      await shot(index, kind, snapshot);
    }
  }
  assert.ok(snapshot.caption.startsWith('10 / 10 ·'), 'walkthrough ends at style 10');
  assert.equal(snapshot.nextTheme.touchStart, false, 'next control disabled at last style');
  assert.equal(snapshot.prevTheme.touchStart, true, 'previous control enabled at last style');

  // Exit removes the gallery overlay from this page...
  await touchNode(cdp, 'SheetGalleryExit');
  await waitForPredicate(cdp, 'gallery teardown', async () => {
    const gallery = await getGallerySnapshot(cdp);
    return gallery.ready ? undefined : { gone: true };
  });
  // ...and a fresh no-query load restores the ordinary preview.
  await cdp.send('Page.navigate', { url: staticServerUrl });
  const restored = await waitForSnapshot(cdp, 'normal preview restored after gallery', (entry) => matchesWalking(entry, 'hub'));
  assert.equal((await getGallerySnapshot(cdp)).ready, false, 'plain preview URL hosts no gallery');

  return Object.freeze({
    artifacts,
    screenshotCount: artifacts.length,
    restoredPhase: restored.phase,
    evidenceBoundary: 'Local debug web-mobile gallery (?gallery=1) in headless Chrome; not a WeChat build or release artifact.',
  });
}

// --- Debug layout gallery (?gallery=2) --------------------------------------

const layoutGallerySnapshotExpression = String.raw`(async () => {
  const cc = await System.import('cc');
  const scene = cc.director.getScene();
  if (!scene) return { ready: false, reason: 'scene unavailable' };
  const all = [];
  const walk = (node, output = all) => { output.push(node); for (const child of node.children) walk(child, output); };
  walk(scene, all);
  const host = all.find((node) => node.name === 'SheetLayoutGalleryHost' && node.activeInHierarchy);
  if (!host) return { ready: false, reason: 'layout gallery host unavailable' };
  const nodes = [];
  walk(host, nodes);
  const find = (name) => nodes.find((node) => node.name === name && node.activeInHierarchy);
  const label = (name) => find(name)?.getComponent(cc.Label)?.string;
  const control = (name) => {
    const node = find(name);
    const transform = node?.getComponent(cc.UITransform);
    return {
      present: Boolean(node),
      width: transform?.contentSize.width ?? 0,
      height: transform?.contentSize.height ?? 0,
      touchStart: Boolean(node?.hasEventListener(cc.Node.EventType.TOUCH_START)),
    };
  };
  const regionInfo = (holderName, contentName) => {
    const holder = find(holderName);
    if (!holder) return { present: false };
    const content = holder.children.find((child) => child.name === contentName);
    return { present: true, x: content?.position.x ?? 0, y: content?.position.y ?? 0 };
  };
  const mountedSheet = ['character', 'menu', 'inventory']
    .map((kind) => ({ kind, present: Boolean(find('MobileInfoSheet:' + kind)) }))
    .filter((entry) => entry.present);
  return {
    ready: true,
    caption: label('CaptionTitle'),
    reference: label('CaptionReference'),
    loading: label('CaptionTitle') === '展卷中…',
    bar: Boolean(find('SheetGalleryBar')),
    mountedSheet: mountedSheet[0]?.kind,
    shortcuts: nodes.filter((node) => node.name.startsWith('MobileSheetShortcut:') && node.activeInHierarchy).length,
    items: nodes.filter((node) => node.name.startsWith('MobileSheetItem:') && node.activeInHierarchy).length,
    seals: nodes.filter((node) => node.name === 'ItemCarriedSeal' && node.activeInHierarchy).length,
    equipSlots: nodes.filter((node) => node.name.startsWith('MobileSheetEquip:') && node.activeInHierarchy).length,
    actions: nodes.filter((node) => node.name.startsWith('MobileSheetAction:') && node.activeInHierarchy).length,
    readouts: nodes.filter((node) => node.name === 'MobileSheetReadout' && node.activeInHierarchy).length,
    pager: regionInfo('MobileSheetPager', 'MobileSheetPagerContent'),
    strip: regionInfo('MobileSheetHStrip', 'MobileSheetHStripContent'),
    scrolls: nodes.filter((node) => node.name === 'MobileSheetScroll' && node.activeInHierarchy).length,
    prevStyle: control('SheetGalleryPrevStyle'),
    nextStyle: control('SheetGalleryNextStyle'),
    exit: control('SheetGalleryExit'),
    kindControls: ['character', 'menu', 'inventory'].map((kind) => control('SheetGalleryKind:' + kind)),
  };
})()`;

async function getLayoutGallerySnapshot(cdp) {
  return evaluate(cdp, layoutGallerySnapshotExpression);
}

async function waitForLayoutGallery(cdp, label) {
  return waitForPredicate(cdp, label, async () => {
    const snapshot = await getLayoutGallerySnapshot(cdp);
    if (!snapshot.ready || snapshot.loading || !snapshot.mountedSheet) return undefined;
    return snapshot;
  });
}

// Read a pager/strip content node's local x (ScrollView tracks the finger by
// moving content), independent of where momentum settles afterwards.
function regionContentOffset(cdp, holderName, contentName) {
  return evaluate(cdp, String.raw`(async () => {
    const cc = await System.import('cc');
    const scene = cc.director.getScene();
    const nodes = [];
    const walk = (node) => { nodes.push(node); for (const child of node.children) walk(child); };
    walk(scene);
    const holder = nodes.find((candidate) => candidate.name === ${JSON.stringify(holderName)}
      && candidate.activeInHierarchy);
    const content = holder?.children.find((child) => child.name === ${JSON.stringify(contentName)});
    return content ? content.position.x : null;
  })()`);
}

// Horizontally swipe a real ScrollView region (carousel pager or drawer strip)
// by `distance` screen px (positive = swipe toward the left edge). Returns the
// content x before the gesture, at finger release and after momentum settles.
async function dragRegionHorizontal(cdp, regionName, contentName, distance) {
  const region = await queryNodePoint(cdp, regionName);
  assert.equal(region.found, true, `${regionName} horizontal region must be queryable`);
  const scale = viewport.width / designViewport.width;
  const startX = Math.min(region.x + Math.abs(distance) / 2 + 12, region.x + (region.width * scale) / 2 - 24);
  const startY = region.y;
  const touchId = (physicalTouchSequence % 3) + 1;
  physicalTouchSequence += 1;
  const steps = 8;
  const before = await regionContentOffset(cdp, regionName, contentName);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY, id: touchId, radiusX: 2, radiusY: 2, force: 1 }],
  });
  for (let step = 1; step <= steps; step += 1) {
    await delay(16);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX - (distance * step) / steps, y: startY, id: touchId, radiusX: 2, radiusY: 2, force: 1 }],
    });
  }
  // Sample while the finger is still held: ScrollView content must have
  // tracked the gesture regardless of where momentum/brake settle it.
  await delay(16);
  const held = await regionContentOffset(cdp, regionName, contentName);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(260);
  const settled = await regionContentOffset(cdp, regionName, contentName);
  return { before, held, settled };
}

function inViewport(point) {
  return point.found && point.x >= 0 && point.x <= viewport.width && point.y >= 0 && point.y <= viewport.height;
}

// Mask-aware visibility for a tile: it is physically tappable only when its
// screen point lies within the screen rect of its nearest ScrollView carrier
// (the Mask clips the hit area). A node with no carrier uses plain viewport
// containment.
function queryReachablePoint(cdp, exactName) {
  return evaluate(cdp, String.raw`(async () => {
    const cc = await System.import('cc');
    const scene = cc.director.getScene();
    if (!scene) return { found: false, reason: 'scene unavailable' };
    const nodes = [];
    const walk = (node) => { nodes.push(node); for (const child of node.children) walk(child); };
    walk(scene);
    const node = nodes.find((candidate) => candidate.name === ${JSON.stringify(exactName)} && candidate.activeInHierarchy);
    if (!node) return { found: false, reason: 'node unavailable' };
    const cameraNode = nodes.find((candidate) => candidate.getComponent(cc.Camera));
    const camera = cameraNode?.getComponent(cc.Camera);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const screenOf = (target) => {
      const s = new cc.Vec3();
      camera.worldToScreen(target.worldPosition, s);
      return {
        x: rect.left + (s.x / canvas.width) * rect.width,
        y: rect.top + ((canvas.height - s.y) / canvas.height) * rect.height,
      };
    };
    const point = screenOf(node);
    let carrier = node.parent;
    while (carrier && !carrier.getComponent(cc.ScrollView)) carrier = carrier.parent;
    const hasTouch = [cc.Node.EventType.TOUCH_START, cc.Node.EventType.TOUCH_END]
      .some((eventName) => node.hasEventListener(eventName));
    const transform = node.getComponent(cc.UITransform);
    if (!carrier) {
      const reachable = point.x >= 0 && point.x <= window.innerWidth
        && point.y >= 0 && point.y <= window.innerHeight;
      return { found: true, reachable, x: point.x, y: point.y,
        width: transform.contentSize.width, height: transform.contentSize.height,
        hasTouch, carrier: null };
    }
    // Clip rects in CSS px: project each clip node's OWN rect (NOT
    // getBoundingBoxToWorld, which unions the oversized scroll content) through
    // the camera (contentSize is in design units; the design->screen scale is
    // not derivable from the canvas backing-store ratio alone on small views).
    const screenRectOf = (target) => {
      const uiTransform = target.getComponent(cc.UITransform);
      const wp = target.worldPosition;
      const ws = target.worldScale;
      const halfW = (uiTransform.contentSize.width * ws.x) / 2;
      const halfH = (uiTransform.contentSize.height * ws.y) / 2;
      const a = new cc.Vec3();
      const b = new cc.Vec3();
      camera.worldToScreen(new cc.Vec3(wp.x - halfW, wp.y - halfH, wp.z), a);
      camera.worldToScreen(new cc.Vec3(wp.x + halfW, wp.y + halfH, wp.z), b);
      const ax = rect.left + (a.x / canvas.width) * rect.width;
      const bx = rect.left + (b.x / canvas.width) * rect.width;
      const ay = rect.top + ((canvas.height - a.y) / canvas.height) * rect.height;
      const by = rect.top + ((canvas.height - b.y) / canvas.height) * rect.height;
      const x0 = Math.min(ax, bx);
      const x1 = Math.max(ax, bx);
      const y0 = Math.min(ay, by);
      const y1 = Math.max(ay, by);
      return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, halfW: (x1 - x0) / 2, halfH: (y1 - y0) / 2 };
    };
    let frame = node.parent;
    while (frame && !String(frame.name).startsWith('MobileInfoSheet:')) frame = frame.parent;
    const clipRects = [];
    if (carrier) clipRects.push(screenRectOf(carrier));
    if (frame) clipRects.push(screenRectOf(frame));
    const reachable = clipRects.every((clip) => point.x >= clip.x - clip.halfW && point.x <= clip.x + clip.halfW
      && point.y >= clip.y - clip.halfH && point.y <= clip.y + clip.halfH)
      && point.x >= 0 && point.x <= window.innerWidth
      && point.y >= 0 && point.y <= window.innerHeight;
    const carrierRect = carrier ? screenRectOf(carrier) : null;
    return {
      found: true, reachable, x: point.x, y: point.y,
      width: transform.contentSize.width, height: transform.contentSize.height, hasTouch,
      carrier: carrierRect ? { ...carrierRect,
        horizontal: Boolean(carrier.getComponent(cc.ScrollView).horizontal) } : null,
    };
  })()`);
}

// Physically drag at a screen point by the given deltas (dy positive moves the
// finger downward; positive dy in steps moves content toward the top).
async function dragAt(cdp, origin, dx, dy) {
  const touchId = (physicalTouchSequence % 3) + 1;
  physicalTouchSequence += 1;
  const steps = 8;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: origin.x, y: origin.y, id: touchId, radiusX: 2, radiusY: 2, force: 1 }],
  });
  for (let step = 1; step <= steps; step += 1) {
    await delay(16);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: origin.x - (dx * step) / steps, y: origin.y + (dy * step) / steps, id: touchId, radiusX: 2, radiusY: 2, force: 1 }],
    });
  }
  await delay(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(260);
}

// Engines with tab strips expose MobileSheetTab:actions; tile engines (drawer,
// ledger, carousel) enter through the MobileSheetShortcut:actions destination,
// which may live on a later pager page or below the fold.
async function openMenuActions(cdp) {
  const tabEntry = await queryNodePoint(cdp, 'MobileSheetTab:actions');
  if (inViewport(tabEntry)) {
    await touchNode(cdp, 'MobileSheetTab:actions');
    return;
  }
  const visibleTile = await queryReachablePoint(cdp, 'MobileSheetShortcut:actions');
  if (visibleTile.found && visibleTile.reachable) {
    await touchNode(cdp, 'MobileSheetShortcut:actions');
    return;
  }
  // Either a later pager page (carousel) or a row below the fold (ledger,
  // drawer, split rail). Swipe the pager until the tile is on screen; for
  // vertical ledgers use the production-proven reveal helper, which drags the
  // scroll region carrying the tile until its point is inside the mask.
  const snapshot = await getLayoutGallerySnapshot(cdp);
  if (snapshot.pager?.present) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await dragRegionHorizontal(cdp, 'MobileSheetPager', 'MobileSheetPagerContent',
        Math.round(viewport.width * 0.62));
      const candidate = await queryReachablePoint(cdp, 'MobileSheetShortcut:actions');
      if (candidate.found && candidate.reachable) {
        await touchNode(cdp, 'MobileSheetShortcut:actions');
        return;
      }
    }
    throw new Error('actions destination never paged into the visible viewport');
  }
  // Vertical ledger/rail: repeatedly drag the tile's own ScrollView carrier
  // until its screen point falls inside the carrier mask (mask-aware, since a
  // content child's world position ignores clipping).
  let lastY = null;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const candidate = await queryReachablePoint(cdp, 'MobileSheetShortcut:actions');
    if (candidate.found && candidate.reachable) break;
    if (!candidate.found || !candidate.carrier) {
      throw new Error('actions destination has no vertical carrier to reveal it');
    }
    if (lastY !== null && Math.abs(candidate.y - lastY) < 1) {
      throw new Error('actions destination reached the carrier end without becoming reachable');
    }
    lastY = candidate.y;
    await dragAt(cdp, { x: candidate.carrier.x, y: candidate.carrier.y }, 0, -240);
  }
  const finalTile = await queryReachablePoint(cdp, 'MobileSheetShortcut:actions');
  assert.ok(finalTile.found && finalTile.reachable, 'actions destination reachable after carrier drags');
  await touchNode(cdp, 'MobileSheetShortcut:actions');
}

async function closeMenuActions(cdp) {
  const returnTab = await queryNodePoint(cdp, 'MobileSheetTab:shortcuts');
  if (inViewport(returnTab)) {
    await touchNode(cdp, 'MobileSheetTab:shortcuts');
  } else {
    await touchNode(cdp, 'MobileSheetActionBack');
  }
}

async function runSheetLayoutGallery(cdp, outputDir) {
  await cdp.send('Page.navigate', { url: `${staticServerUrl}?gallery=2` });
  let snapshot = await waitForLayoutGallery(cdp, 'layout gallery overlay');
  await evaluate(cdp, "(async () => { const cc = await System.import('cc'); cc.profiler.hideStats(); return true; })()");
  snapshot = await waitForLayoutGallery(cdp, 'layout gallery first style settled');
  assert.equal(snapshot.mountedSheet, 'character', 'layout gallery opens on the character sheet');
  assert.equal(snapshot.caption, '1 / 10 · 赤金铁券·中轴', 'layout gallery caption for style 1');
  assert.equal(snapshot.bar, true, 'layout switcher bar visible');
  assert.equal(snapshot.prevStyle.touchStart, false, 'previous style control disabled at first style');
  assert.equal(snapshot.nextStyle.touchStart, true, 'next style control enabled at first style');
  for (const kind of GALLERY_KIND_NAMES) {
    const queried = await queryNodePoint(cdp, `SheetGalleryKind:${kind}`);
    assert.equal(queried.found, true, `${kind}: kind control on screen`);
    assert.equal(queried.hasTouch, true, `${kind}: kind control touch bound`);
    assert.equal(queried.height, 104, `${kind}: 104 design-px touch height`);
  }

  const artifacts = [];
  const galleryViewSnapshot = { walking: { present: false }, result: { present: false } };
  const shot = async (index, kind, frame) => {
    const file = `sheet-layout-gallery-${String(index + 1).padStart(2, '0')}-${kind}.png`;
    const captured = await captureStage(cdp, outputDir, file, `sheet-layout-gallery-${index + 1}-${kind}`, galleryViewSnapshot);
    artifacts.push({ styleIndex: index, kind, file: captured.file, caption: frame.caption });
  };

  // Walk styles 1..10 via the real next control and visit all three sheets per
  // style (30 screenshots). Each mounted frame also exercises the real
  // ScrollViews its engine owns: vertical lists, horizontal strips and pager
  // pages get physical touch gestures, not pager-button substitutions.
  for (let index = 0; index < 10; index += 1) {
    if (index > 0) {
      await touchNode(cdp, 'SheetGalleryNextStyle');
      snapshot = await waitForLayoutGallery(cdp, `style ${index + 1} advance`);
    }
    for (let kindCursor = 0; kindCursor < GALLERY_KIND_NAMES.length; kindCursor += 1) {
      const kind = GALLERY_KIND_NAMES[kindCursor];
      if (!(index === 0 && kindCursor === 0)) {
        await touchNode(cdp, `SheetGalleryKind:${kind}`);
        snapshot = await waitForLayoutGallery(cdp, `style ${index + 1} ${kind}`);
      }
      assert.ok(snapshot.caption.startsWith(`${index + 1} / 10 · `), `style ${index + 1}: caption prefix`);
      assert.equal(snapshot.mountedSheet, kind, `style ${index + 1}: ${kind} sheet mounted`);
      assert.equal(snapshot.bar, true, 'switcher bar stays mounted');
      if (kind === 'menu') assert.equal(snapshot.shortcuts, 9, 'menu: nine shortcut destinations');
      if (kind === 'inventory') {
        if (index === 0) {
          assert.equal(snapshot.items, 3, 'inventory production 道具 tab: three supply cells');
          assert.equal(snapshot.seals, 0, 'inventory production 道具 tab: no prepared seals');
        } else {
          assert.equal(snapshot.items, 9, 'inventory alternate engine: nine tactical cells');
          assert.equal(snapshot.seals, 3, 'inventory alternate engine: three prepared seals');
        }
      }
      if (kind === 'character') {
        assert.equal(snapshot.equipSlots, 7, 'character: seven equip slots');
        // One physical vertical drag per engine (the two styles of an engine
        // pair share the gesture); no-op for engines without a vertical region.
        if (index % 2 === 0 && snapshot.scrolls > 0) {
          await dragSheet(cdp, -220);
          assert.equal((await queryNodePoint(cdp, 'MobileSheetScroll')).found, true,
            'vertical scroll region survives the physical drag');
          snapshot = await getLayoutGallerySnapshot(cdp);
        }
      }
      // Carousel engines: physically swipe the hPager. All pages stay in the
      // tree, so the gesture proves the real ScrollView path rather than a button.
      if (snapshot.pager?.present) {
        const move = await dragRegionHorizontal(cdp, 'MobileSheetPager', 'MobileSheetPagerContent',
          Math.round(viewport.width * 0.62));
        const after = (await getLayoutGallerySnapshot(cdp)).pager;
        assert.equal(after.present, true, 'pager region survives the horizontal drag');
        assert.ok(Math.abs(move.held - move.before) > 2,
          `pager content tracked the held drag (before=${move.before} held=${move.held} settled=${move.settled})`);
        snapshot = await getLayoutGallerySnapshot(cdp);
      }
      // Drawer strip engines: physically drag the free horizontal strip.
      if (snapshot.strip?.present) {
        const move = await dragRegionHorizontal(cdp, 'MobileSheetHStrip', 'MobileSheetHStripContent',
          Math.round(viewport.width * 0.5));
        const after = (await getLayoutGallerySnapshot(cdp)).strip;
        assert.equal(after.present, true, 'strip region survives the horizontal drag');
        assert.ok(Math.abs(move.held - move.before) > 2,
          `strip content tracked the held drag (before=${move.before} held=${move.held} settled=${move.settled})`);
        snapshot = await getLayoutGallerySnapshot(cdp);
      }
      await shot(index, kind, snapshot);

      // The menu of every engine must reach the real shared action list and
      // return to the destinations, whether its engine uses tabs or tiles.
      // The hub fixture legitimately has zero advanced actions, so the shared
      // composite renders its empty-list readout — that page (not the tiles)
      // is what must appear.
      if (kind === 'menu') {
        await openMenuActions(cdp);
        const actionsFrame = await waitForPredicate(cdp, `style ${index + 1} action list`, async () => {
          const frame = await getLayoutGallerySnapshot(cdp);
          return frame.ready && frame.shortcuts === 0 && (frame.actions > 0 || frame.readouts > 0)
            ? frame
            : undefined;
        });
        assert.ok(actionsFrame.actions > 0 || actionsFrame.readouts > 0,
          `style ${index + 1}: action page renders actions or the real empty-list readout`);
        await closeMenuActions(cdp);
        await waitForPredicate(cdp, `style ${index + 1} destinations restored`, async () => {
          const frame = await getLayoutGallerySnapshot(cdp);
          // Readouts may legitimately remain (the split engine keeps a
          // permanent briefing doc beside its destination rail).
          return frame.ready && frame.shortcuts === 9 && frame.actions === 0 ? frame : undefined;
        });
      }
    }
  }
  snapshot = await getLayoutGallerySnapshot(cdp);
  assert.ok(snapshot.caption.startsWith('10 / 10 ·'), 'walkthrough ends at style 10');
  assert.equal(snapshot.nextStyle.touchStart, false, 'next style control disabled at last style');
  assert.equal(snapshot.prevStyle.touchStart, true, 'previous style control enabled at last style');

  // Exit tears the gallery down; a fresh no-query load restores the hub.
  await touchNode(cdp, 'SheetGalleryExit');
  await waitForPredicate(cdp, 'layout gallery teardown', async () => {
    const gallery = await getLayoutGallerySnapshot(cdp);
    return gallery.ready ? undefined : { gone: true };
  });
  await cdp.send('Page.navigate', { url: staticServerUrl });
  const restored = await waitForSnapshot(cdp, 'normal preview restored after layout gallery', (entry) => matchesWalking(entry, 'hub'));
  assert.equal((await getLayoutGallerySnapshot(cdp)).ready, false, 'plain preview URL hosts no layout gallery');

  return Object.freeze({
    artifacts,
    screenshotCount: artifacts.length,
    restoredPhase: restored.phase,
    evidenceBoundary: 'Local debug web-mobile layout gallery (?gallery=2) in headless Chrome; not a WeChat build or release artifact.',
  });
}

let staticServerUrl = '';

async function main() {
  const build = await assertFreshBuild();  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run cocos:web-mobile:smoke.');
  }
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${viewport.width}x${viewport.height}-${process.pid}`;
  const outputDir = path.join(artifactRootDir, runId);
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(path.join(tmpdir(), 'infinite-flow-web-mobile-canvas-'));
  let staticServer;
  let chrome;
  let cdp;

  try {
    staticServer = await startStaticServer();
    staticServerUrl = staticServer.url;
    chrome = spawn(chromePath, [
      '--headless=new',
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--no-proxy-server',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--force-device-scale-factor=1',
      `--window-size=${viewport.width},${viewport.height}`,
      'about:blank',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...processGroupSpawnOptions(),
    });
    const getChromeOutput = captureChildOutput(chrome);
    const debugPort = await waitForDevToolsPort(profileDir, chrome, getChromeOutput);
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`, 'Chrome page target');
    const target = targets.find((candidate) => candidate.type === 'page');
    if (!target?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a debuggable page target.');
    cdp = new CdpSession(target.webSocketDebuggerUrl);
    await cdp.open();
    await Promise.all([
      cdp.send('Page.enable'),
      cdp.send('Runtime.enable'),
      cdp.send('Log.enable'),
      cdp.send('Network.enable'),
    ]);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      mobile: true,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
      screenOrientation: { type: 'portraitPrimary', angle: 0 },
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Page.navigate', { url: staticServer.url });
    const flowResult = await runCanvasFlow(cdp, outputDir);
    const styleRefreshGallery = dungeonOnly || !focusedFlow
      ? await runStyleRefreshGallery(cdp, outputDir)
      : { scope: 'skipped: ' + scope, count: 0, coveredKeys: [], artifacts: [] };
    const dungeonRendererGallery = focusedFlow
      ? { scope: 'skipped: ' + scope, count: 0, artifacts: [] }
      : await runDungeonRendererGallery(cdp, outputDir);
    // The 750px design viewport walks both galleries; the 320px small-viewport
    // run focuses on the layout gallery touch-target-in-screen assertions.
    const sheetStyleGallery = !focusedFlow && viewport.width === designViewport.width
      ? await runSheetStyleGallery(cdp, outputDir)
      : { artifacts: [], screenshotCount: 0, restoredPhase: null,
        evidenceBoundary: focusedFlow ? 'skipped: ' + scope : 'skipped at narrow viewport' };
    const sheetLayoutGallery = focusedFlow
      ? { artifacts: [], screenshotCount: 0, restoredPhase: null, evidenceBoundary: 'skipped: ' + scope }
      : await runSheetLayoutGallery(cdp, outputDir);
    await delay(200);
    const browserFailures = collectBrowserFailures(cdp.events);
    assert.deepEqual(browserFailures, [], `browser/runtime failures:\n${browserFailures.join('\n')}`);
    const manifest = Object.freeze({
      schemaVersion: 2,
      scope,
      generatedAt: new Date().toISOString(),
      build: {
        root: path.relative(projectDir, buildDir),
        entry: path.relative(projectDir, build.entryPath),
        entryModifiedAt: build.entryModifiedAt,
        newestInput: build.newestInput,
        newestInputModifiedAt: build.newestInputModifiedAt,
      },
      viewport,
      designViewport,
      flow: flowResult.artifacts.map(({ stage }) => stage),
      input: 'Chrome DevTools Protocol Input.dispatchKeyEvent and Input.dispatchTouchEvent',
      movementEvidence: flowResult.movementEvidence,
      evidenceBoundary: 'Local Cocos Web Mobile preview in headless Chrome with emulated touch; not WeChat DevTools or a WeChat physical-device acceptance result.',
      sceneEvidence: flowResult.sceneEvidence,
      combatOutcome: flowResult.combatOutcome,
      physicalAttackCount: flowResult.physicalAttackCount,
      chapterCodex: flowResult.chapterCodex,
      selectedChapters: flowResult.selectedChapters,
      dungeonRendererGallery,
      styleRefreshGallery,
      sheetStyleGallery: {
        screenshots: sheetStyleGallery.artifacts,
        screenshotCount: sheetStyleGallery.screenshotCount,
        restoredPhase: sheetStyleGallery.restoredPhase,
        evidenceBoundary: sheetStyleGallery.evidenceBoundary,
      },
      sheetLayoutGallery: {
        screenshots: sheetLayoutGallery.artifacts,
        screenshotCount: sheetLayoutGallery.screenshotCount,
        restoredPhase: sheetLayoutGallery.restoredPhase,
        evidenceBoundary: sheetLayoutGallery.evidenceBoundary,
      },
      artifacts: flowResult.artifacts,
      browserFailureCount: browserFailures.length,
    });
    const manifestPath = path.join(outputDir, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[canvas-smoke] fresh build entry: ${path.relative(projectDir, build.entryPath)} (${build.entryModifiedAt})`);
    console.log(`[canvas-smoke] combat outcome: ${flowResult.combatOutcome} (${flowResult.physicalAttackCount} physical attacks)`);
    console.log(combatOnly
      ? '[canvas-smoke] passed physical NPC method learning -> spell selection/cancel/confirm -> independent technique limits -> medicine/full-health/consumption -> bag use (Web preview only; not WeChat device acceptance)'
      : dungeonOnly
      ? '[canvas-smoke] passed physical portal entry -> blocked/available stone gates -> combat victory -> legal room transition -> icon map and inline details -> result -> hub (Web preview only; not WeChat device acceptance)'
      : carryOnly
      ? '[canvas-smoke] passed physical purchase -> character/owned configuration -> carry equip/remove -> fixed slots with scrolling list -> supply bag (Web preview only; not WeChat device acceptance)'
      : '[canvas-smoke] passed continuous keyboard/touch walking -> collision/camera -> merchant/details/help -> portal -> explore/codex -> combat victory -> result -> hub (Web preview only; not WeChat device acceptance)');
    console.log(`[canvas-smoke] manifest: ${path.relative(projectDir, manifestPath)}`);
  } catch (error) {
    if (cdp) {
      try {
        const snapshot = await getSceneSnapshot(cdp);
        if (snapshot.ready) await captureStage(cdp, outputDir, 'failure.png', 'failed-state', snapshot);
        const failurePath = path.join(outputDir, 'failure.json');
        await writeFile(failurePath, `${JSON.stringify({
          error: formatError(error), snapshot, movementEvidence,
          browserFailures: collectBrowserFailures(cdp.events),
          evidenceBoundary: 'Local Web Mobile preview only; not WeChat physical-device acceptance.',
        }, null, 2)}\n`, 'utf8');
        console.log(`[canvas-smoke] failure evidence: ${path.relative(projectDir, failurePath)}`);
      } catch (captureError) {
        console.error(`[canvas-smoke] unable to capture failure evidence: ${formatError(captureError)}`);
      }
    }
    throw error;
  } finally {
    try {
      cdp?.close();
      await stopProcess(chrome);
      await stopStaticServer(staticServer?.server);
      await rm(profileDir, { recursive: true, force: true });
      try {
        const handle = await open(profileDir, 'r');
        await handle.close();
        throw new Error(`Chrome profile cleanup failed: ${profileDir} still exists.`);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    } finally {
      await stopEsbuild();
    }
  }
}

main().catch((error) => {
  console.error(`[canvas-smoke] failed: ${formatError(error)}`);
  process.exitCode = 1;
});
