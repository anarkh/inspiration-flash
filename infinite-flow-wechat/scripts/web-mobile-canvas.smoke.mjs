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
import { build } from 'esbuild';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cocosDir = path.join(projectDir, 'cocos');
const buildDir = path.join(cocosDir, 'build', 'web-mobile');
const artifactRootDir = path.join(cocosDir, 'build', 'web-mobile-canvas-smoke');
const designViewport = Object.freeze({ width: 750, height: 1334 });
const viewportArguments = process.argv.slice(2);
if (viewportArguments.length > 1 || (viewportArguments.length === 1
  && !/^--viewport=(?:750x1334|320x568)$/u.test(viewportArguments[0]))) {
  throw new Error('Usage: node scripts/web-mobile-canvas.smoke.mjs [--viewport=750x1334|--viewport=320x568]');
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
  const text = (node) => {
    if (!node) return undefined;
    const descendants = [];
    walk(node, descendants);
    return descendants.map((item) => item.getComponent(cc.Label)?.string).filter(Boolean).join(' | ');
  };
  const control = (name) => {
    const node = exact(name);
    return {
      present: Boolean(node), box: box(node),
      touchable: Boolean(node?.hasEventListener(cc.Node.EventType.TOUCH_START)
        && node?.hasEventListener(cc.Node.EventType.TOUCH_END)),
      text: text(node),
    };
  };
  const frameInfo = (frame) => frame ? {
    uuid: frame.uuid,
    rect: { x: frame.rect.x, y: frame.rect.y, width: frame.rect.width, height: frame.rect.height },
    textureWidth: frame.texture?.width, textureHeight: frame.texture?.height,
    loaded: Boolean(frame.texture),
    valid: frame.isValid === true && frame.texture?.isValid === true,
  } : undefined;
  const bodySprite = exact('WalkPlayerBody')?.getComponent(cc.Sprite);
  const atlas = app?.view?.sceneVisuals?.get('character:reincarnator_walk');
  const frames = atlas?.frames ?? [];
  const detail = app?.viewModel?.sections?.[1]?.detail;
  const activeNodes = nodes.filter((node) => node.activeInHierarchy);
  const actionNames = activeNodes.filter((node) =>
    ['Action:', 'WorldAction:', 'WalkCombatAction:'].some((prefix) => node.name.startsWith(prefix))
  ).map((node) => node.name);
  const labels = activeNodes.map((node) => node.getComponent(cc.Label)?.string).filter(Boolean);
  return {
    ready: true, phase: app?.viewModel?.phase, rootCount: roots.length, rootUuid: root.uuid,
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
      player: box(exact('WalkPlayer')),
      playerUuid: exact('WalkPlayer')?.uuid,
      camera: box(exact('WalkCamera')),
      cameraUuid: exact('WalkCamera')?.uuid,
      playerFrame: frameInfo(bodySprite?.spriteFrame),
      backdrops: matching('WalkDungeonBackdrop:').map((node) => ({
        name: node.name, box: box(node), frame: frameInfo(node.getComponent(cc.Sprite)?.spriteFrame),
      })),
      environmentLoading: label('WalkEnvironmentLoading'),
      backdropPending: Boolean(exact('WalkDungeonBackdropPending')),
      atlas: {
        count: frames.length,
        rects: frames.map((frame) => frameInfo(frame)?.rect),
        sharedTexture: frames.length > 0 && frames.every((frame) => frame.texture === frames[0].texture),
        width: atlas?.width, height: atlas?.height,
      },
      joystick: control('WalkJoystick'),
      thumb: box(exact('WalkJoystickThumb')),
      interact: control('WalkInteract'),
      interactionHint: label('WalkInteractionHint'),
      targets: matching('WalkTarget:').map((node) => ({ name: node.name, box: box(node), text: text(node) })),
      wallCount: matching('WalkWall:').length + matching('WalkObstacleFootprint:').length,
      status: label('WalkPlayerStatus'),
      storageNotice: label('WalkStorageNotice'),
      feedback: label('WalkFeedback'),
      enemyHealth: label('WalkEnemyHealthLabel'),
      combatPage: label('WalkCombatPage'),
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
      entryDungeons: detail?.entryServices?.find(({ id }) => id === 'dungeon')?.options
        .map(({ id, name, selected, action }) => ({ id, name, selected, actionId: action.actionId })),
      mapNodeCount: detail?.kind === 'explore' ? detail.map.nodes.length : undefined,
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
      readoutTitles: matching('ReadoutTitle').map((node) => node.getComponent(cc.Label)?.string),
      close: control('MobileSheetClose'),
      legacyPaging: Boolean(exact('MobileSheetNext') || exact('MobileSheetPrevious') || exact('MobileSheetPageCount')),
      scroll: (() => {
        const holder = exact('MobileSheetMapScroll') ?? exact('MobileSheetCatalogScroll') ?? exact('MobileSheetScroll');
        const content = holder?.getChildByName('MobileSheetMapContent') ?? holder?.getChildByName('MobileSheetScrollContent');
        const scroll = holder?.getComponent(cc.ScrollView);
        return {
          present: Boolean(holder),
          view: box(holder),
          content: box(content),
          contentY: content?.position.y,
          contentX: content?.position.x,
          offset: scroll?.getScrollOffset()?.y,
          offsetX: scroll ? -scroll.getScrollOffset().x : undefined,
          horizontal: scroll?.horizontal,
          vertical: scroll?.vertical,
          thumb: Boolean(exact('MobileSheetScrollThumb')),
        };
      })(),
      blocker: Boolean(exact('MobileSheetBackdrop')?.getComponent(cc.BlockInputEvents)),
      topmost: root.children.at(-1)?.name === 'MobileSheetBackdrop',
      catalogRows: activeNodes.filter(node => /^MobileSheetShop(?:Row|Tile):/.test(node.name)).map(node => node.name),
      mapCells: [...matching('MobileSheetMapCell:'), ...matching('MobileSheetFog:')].map(node => node.name),
      catalogTiles: matching('MobileSheetShopTile:').map(node => ({ name: node.name, text: text(node) })),
      catalogDetail: control('MobileSheetCatalogDetail'),
      shopActions: matching('MobileSheetShopAction:').map((node) => node.name),
      actions: matching('MobileSheetAction:').map((node) => node.name),
      helpEntries: matching('MobileSheetHelp:').map((node) => node.name),
      itemCells: matching('MobileSheetItem:').map((node) => node.name),
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
    diagnostics: {
      activeNodeNames: activeNodes.map((node) => node.name),
      desiredVisualKeys: Array.from(app?.desiredSceneVisualKeys ?? []),
      visualRecords: Array.from(app?.visualRecords ?? [], ([key, value]) => ({
        key, acquired: value.acquired, sceneDisplayed: value.sceneDisplayed,
        width: value.image?.width, height: value.image?.height,
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
  assert.ok(snapshot.walking.wallCount >= 4, 'the walking room must contain collision walls');
  assert.equal(snapshot.walking.atlas.sharedTexture, true, 'all 16 walker frames must share one atlas texture');
  assert.equal(new Set(snapshot.walking.atlas.rects.map((rect) => JSON.stringify(rect))).size, 16,
    'walking atlas must contain 16 distinct source rectangles');
  assert.equal(new Set(snapshot.walking.atlas.rects.map((rect) => rect.x)).size, 4, 'atlas has four animation columns');
  assert.equal(new Set(snapshot.walking.atlas.rects.map((rect) => rect.y)).size, 4, 'atlas has four facing rows');
  assert.equal(snapshot.diagnostics.activeNodeNames.some((name) => name.startsWith('WorldPlayer:')), false,
    'free walking must render the world actor without a portrait actor');
  assert.equal(snapshot.diagnostics.activeNodeNames.some((name) => name.startsWith('WorldAction:')), false,
    'walking hub, exploration and combat must use spatial controls');
}

function compactWalking(snapshot) {
  const value = snapshot.walking;
  return {
    at: new Date().toISOString(), phase: snapshot.phase, worldKey: value.worldKey,
    position: value.position, facing: value.facing, inputAxis: value.inputAxis,
    player: value.player, playerUuid: value.playerUuid,
    sceneUuid: value.sceneUuid, cameraUuid: value.cameraUuid, camera: value.camera,
    frame: value.playerFrame, thumb: value.thumb, hint: value.interactionHint,
  };
}

const movementEvidence = [];
const KEY_EVENTS = Object.freeze({
  w: { key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 },
  s: { key: 's', code: 'KeyS', windowsVirtualKeyCode: 83, nativeVirtualKeyCode: 83 },
  a: { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 },
  d: { key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 },
  e: { key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69, nativeVirtualKeyCode: 69 },
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
      if (screenshotCallback && samples.length <= 4) await screenshotCallback(snapshot, samples.length - 1);
    }
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
  }
  assert.ok(movingSamples >= 3, record.label + ': movement is continuous across at least three samples');
  assert.equal(last.facing, facing, record.label + ': four-direction facing');
  assert.ok(new Set(record.samples.slice(1).map((sample) => JSON.stringify(sample.frame?.rect))).size >= 2,
    record.label + ': walking changes the atlas animation rectangle');
  assertStopped(record);
}

async function holdJoystick(cdp, direction, milliseconds, label, screenshotCallback) {
  const target = await queryNodePoint(cdp, 'WalkJoystick');
  assert.equal(target.found && target.hasTouch, true, 'live joystick must accept touch');
  const samples = [compactWalking(await getSceneSnapshot(cdp))];
  const id = (physicalTouchSequence++ % 3) + 1;
  const point = (x, y) => ({ x, y, id, radiusX: 2, radiusY: 2, force: 1 });
  const scale = viewport.width / designViewport.width;
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
      if (screenshotCallback && samples.length <= 4) await screenshotCallback(snapshot, samples.length - 1);
    }
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
      const holdMs = Math.max(18, Math.min(280, Math.abs(distance) / 220 * 1000 - 8));
      await dispatchKey(cdp, key, 'keyDown');
      try { await delay(holdMs); } finally { await dispatchKey(cdp, key, 'keyUp'); }
      await delay(35);
      const after = await getSceneSnapshot(cdp);
      movementEvidence.push({ label: label + ':' + axis, input: 'Input.dispatchKeyEvent',
        key, requestedHoldMs: holdMs, samples: [compactWalking(before), compactWalking(after)] });
      stagnant = Math.abs(after.walking.position[axis] - before.walking.position[axis]) < 0.5 ? stagnant + 1 : 0;
      assert.ok(stagnant < 3, label + ': route encountered an unexpected wall at ' + JSON.stringify(after.walking.position));
    }
    const snapshot = await getSceneSnapshot(cdp);
    assert.ok(Math.abs(destination[axis] - snapshot.walking.position[axis]) <= 6,
      label + ': physically reach ' + axis + '=' + destination[axis]);
  }
  return getSceneSnapshot(cdp);
}

async function findPhysicalAction(cdp, actionId, surface = 'details') {
  const prefix = surface === 'combat' ? 'WalkCombatAction:' : surface === 'result' ? 'WorldAction:' : 'Action:';
  const previous = surface === 'combat' ? 'WalkCombatPagePrevious' : surface === 'result' ? 'ScenePagePrevious' : 'PagePrevious';
  const next = surface === 'combat' ? 'WalkCombatPageNext' : surface === 'result' ? 'ScenePageNext' : 'PageNext';
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

async function runCanvasFlow(cdp, outputDir) {
  const artifacts = [];
  const sceneEvidence = [];
  const save = async (name, snapshot) => {
    artifacts.push(await captureStage(cdp, outputDir, name + '.png', name, snapshot));
  };
  let hub = await waitForSnapshot(cdp, 'hub with loaded four-direction walking sprite', (snapshot) => matchesWalking(snapshot, 'hub'));
  await evaluate(cdp, "(async () => { const cc = await System.import('cc'); cc.profiler.hideStats(); return true; })()");
  assertWalking(hub, 'hub');
  assert.deepEqual(hub.walking.position, { x: 640, y: 820 }, 'hub starts at physical world spawn');
  assert.match(hub.walking.storageNotice, /刷新.*丢失/u, 'Web preview discloses temporary progress');
  await save('01-hub', hub);
  const movementBaseline = await getRuntimeEvidence(cdp);

  // Interaction is proximity-gated, and walking across the room alone is not a domain command.
  await touchNode(cdp, 'WalkInteract');
  await keyTap(cdp, 'e');
  assertSameDomainEvidence(movementBaseline, await getRuntimeEvidence(cdp), 'interaction while far from objects');
  const up = await holdKey(cdp, 'w', 700, 'keyboard-w-up',
    (snapshot, index) => save('02-w-up-frame-' + index, snapshot));
  assertContinuousMovement(up, 'y', -1, 'up');
  assertContinuousMovement(await holdKey(cdp, 's', 700, 'keyboard-s-down'), 'y', 1, 'down');
  assertContinuousMovement(await holdKey(cdp, 'a', 550, 'keyboard-a-left'), 'x', -1, 'left');
  assertContinuousMovement(await holdKey(cdp, 'd', 550, 'keyboard-d-right'), 'x', 1, 'right');
  assertContinuousMovement(await holdKey(cdp, 'ArrowUp', 700, 'arrow-up'), 'y', -1, 'up');
  assertContinuousMovement(await holdKey(cdp, 'ArrowDown', 700, 'arrow-down'), 'y', 1, 'down');
  const directions = movementEvidence.filter((record) => record.key && record.samples.length > 3);
  assert.equal(new Set(directions.map((record) => record.samples.at(-1).frame.rect.y)).size, 4,
    'four physical directions must select four different atlas rows');

  const joystick = await holdJoystick(cdp, { x: 0, y: -1 }, 750, 'touch-joystick-up',
    (snapshot, index) => save('03-touch-up-frame-' + index, snapshot));
  assertContinuousMovement(joystick, 'y', -1, 'up');
  assert.ok(joystick.samples.some((sample) => sample.thumb.y > 30), 'touch drag moves the visible joystick thumb');
  assert.ok(Math.abs(joystick.stopped.thumb.x) < 0.5 && Math.abs(joystick.stopped.thumb.y) < 0.5,
    'touch end recenters the joystick thumb');
  await walkTo(cdp, { x: 640, y: 670 }, 'approach-pillar');
  const collision = await holdKey(cdp, 'd', 1200, 'pillar-collision');
  const collisionEnd = collision.stopped.position;
  assert.ok(Math.abs(collisionEnd.x - 761) < 1 && Math.abs(collisionEnd.y - 670) <= 6,
    'player feet stop before the pillar at x=775 using the 14-unit collision radius');
  assert.ok(Math.abs(collision.samples.at(-1).position.x - collision.samples.at(-2).position.x) < 0.5,
    'held input remains blocked by the pillar');
  assertStopped(collision);
  await save('04-pillar-collision', await getSceneSnapshot(cdp));

  await walkTo(cdp, { x: 640, y: 500 }, 'leave-pillar');
  const cameraBefore = (await getSceneSnapshot(cdp)).walking.camera;
  const wall = await holdKey(cdp, 'a', 3400, 'outer-wall-collision');
  assert.ok(Math.abs(wall.stopped.position.x - 54) < 1, 'outer wall blocks the actor at x=40 + foot radius 14');
  assertStopped(wall);
  assert.ok(Math.abs(wall.stopped.camera.x - cameraBefore.x) > 150,
    'the world camera follows continuous player movement across the room');
  await save('05-wall-and-camera', await getSceneSnapshot(cdp));
  assertSameDomainEvidence(movementBaseline, await getRuntimeEvidence(cdp), 'walking, animation and collisions');
  sceneEvidence.push({ stage: 'walking-leaves-domain-unchanged', baseline: movementBaseline, after: await getRuntimeEvidence(cdp) });

  // A clear corridor reaches the merchant; interaction opens a modal over the world.
  await walkTo(cdp, { x: 950, y: 500 }, 'cross-merchant-corridor');
  const merchantPosition = await walkTo(cdp, { x: 950, y: 380 }, 'approach-supply-merchant');
  assert.match(merchantPosition.walking.interactionHint, /补给/u);
  await save('06-merchant-proximity', merchantPosition);
  await touchNode(cdp, 'WalkInteract');
  const details = await waitForSnapshot(cdp, 'merchant detail panel from spatial interaction',
    (snapshot) => snapshot.sheet.kind === 'npc' && snapshot.domain.activePanel === 'supplies' && snapshot.sheet.close.touchable);
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
  await touchNode(cdp, 'MobileSheetCatalogDetailClose');
  await touchNode(cdp, 'MobileSheetClose');
  hub = await waitForSnapshot(cdp, 'return to walking world', (snapshot) => matchesWalking(snapshot, 'hub'));
  assert.ok(Math.hypot(hub.walking.position.x - merchantPosition.walking.position.x,
    hub.walking.position.y - merchantPosition.walking.position.y) < 1, 'detail round-trip preserves physical position');
  const catalogBaseline = await getRuntimeEvidence(cdp);
  const visits = [
    { panel: 'equipment', count: 65, path: [{ x: 950, y: 500 }, { x: 330, y: 500 }, { x: 330, y: 380 }] },
    { panel: 'pets', count: 6, path: [{ x: 330, y: 530 }] },
    { panel: 'bloodlines', count: 4, path: [{ x: 330, y: 800 }] },
    { panel: 'tasks', count: 63, path: [{ x: 640, y: 800 }, { x: 640, y: 960 }] },
    { panel: 'companions', count: 3, path: [{ x: 950, y: 960 }, { x: 950, y: 800 }] },
    { panel: 'methods', count: 7, path: [{ x: 950, y: 530 }] },
  ];
  for (const visit of visits) {
    for (const destination of visit.path) await walkTo(cdp, destination, 'approach-' + visit.panel);
    await touchNode(cdp, 'WalkInteract');
    const catalog = await waitForSnapshot(cdp, visit.panel + ' full catalog', (snapshot) =>
      snapshot.sheet.kind === 'npc' && snapshot.domain.activePanel === visit.panel
      && snapshot.sheet.catalogRows.length === visit.count);
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
  await walkTo(cdp, { x: 950, y: 500 }, 'return-merchant-corridor');
  await walkTo(cdp, { x: 950, y: 380 }, 'return-merchant-position');
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

  // WoW-style sheet walkthrough: character paper doll -> equipment tooltip,
  // then the 5x100 bag with a real carry-toggle command.
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
  await touchNode(cdp, 'MobileSheetTab:loadout');
  const owned = await waitForSnapshot(cdp, 'owned loadout list', (snapshot) => snapshot.sheet.catalogRows.length > 0);
  assert.equal(owned.sheet.shopActions.some((name) => /\.buy:|\.recruit:|\.cultivate:/.test(name)), false,
    'owned loadout contains configuration rather than shop transactions');
  await save('13c-character-loadout', owned);
  const ownedRowId = owned.sheet.catalogRows[0].slice('MobileSheetShopRow:'.length);
  await touchNode(cdp, 'MobileSheetShopInfo:' + ownedRowId);
  await waitForSnapshot(cdp, 'owned equipment details', (snapshot) => snapshot.sheet.catalogDetail.present);
  await touchNode(cdp, 'MobileSheetCatalogDetailClose');
  await waitForSnapshot(cdp, 'owned equipment details closed', (snapshot) => !snapshot.sheet.catalogDetail.present);
  await touchNode(cdp, 'MobileSheetClose');

  await touchNode(cdp, 'SceneHelp');
  await waitForSnapshot(cdp, 'mobile menu for bag', (snapshot) => snapshot.sheet.kind === 'menu');
  await touchNode(cdp, 'MobileSheetShortcut:inventory');
  const bag = await waitForSnapshot(cdp, 'tabbed 5x100 bag', (snapshot) =>
    snapshot.sheet.kind === 'inventory'
    && snapshot.diagnostics.activeNodeNames.includes('MobileSheetTab:items')
    && snapshot.diagnostics.activeNodeNames.includes('MobileSheetTab:carry'));
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
  // Switch to the 携行 tab: an independent 5×100 grid with the six carried
  // special items.
  await touchNode(cdp, 'MobileSheetTab:carry');
  const carryBag = await waitForSnapshot(cdp, '携行 tab grid', (snapshot) =>
    snapshot.sheet.itemCells.length === 6 && snapshot.sheet.blankCells === 94);
  assert.ok(carryBag.sheet.itemCells.includes('MobileSheetItem:gate_sigil'), '携行 tab lists the gate sigil');
  assert.equal((await queryNodePoint(cdp, 'MobileSheetBlank:6')).found, true, 'decorative cells exist in the 携行 grid');
  await save('14a-bag-grid-carry', await getSceneSnapshot(cdp));
  const sigilPoint = await queryNodePoint(cdp, 'MobileSheetItem:gate_sigil');
  assert.equal(sigilPoint.found && sigilPoint.hasTouch, true, 'real cells are tappable');
  await touchNode(cdp, 'MobileSheetItem:gate_sigil');
  const itemTip = await waitForSnapshot(cdp, 'item tooltip with carry action',
    (snapshot) => snapshot.sheet.tip.present && Boolean(snapshot.sheet.tip.carry?.touchable));
  assert.match(itemTip.sheet.tip.texts.join(' | '), /小界门符|兑换价/u, 'item tooltip shows catalog copy');
  assert.match(itemTip.sheet.tip.carry.label, /设为携行/u, 'hub tooltip offers the real carry command');
  const carryBaseline = await getRuntimeEvidence(cdp);
  await touchNode(cdp, itemTip.sheet.tip.carry.name);
  await waitForSnapshot(cdp, 'carry command committed', (snapshot) =>
    snapshot.sheet.tip.present && /取消携行/u.test(snapshot.sheet.tip.carry?.label ?? '') && snapshot.sheet.carriedSeals === 1);
  assert.notEqual((await getRuntimeEvidence(cdp)).stateSha256, carryBaseline.stateSha256,
    'carry toggle dispatches hub/configure-tactical-loadout');
  await save('14b-item-tooltip-carried', await getSceneSnapshot(cdp));
  // Tap outside the frame (above the vertically-centered sheet) to dismiss.
  await tapScreen(cdp, viewport.width / 2, 24);
  await waitForSnapshot(cdp, 'tooltip dismissed from outside', (snapshot) => !snapshot.sheet.tip.present);
  // Physically browse the lower (fully decorative) rows.
  const bagScrollBefore = (await getSceneSnapshot(cdp)).sheet.scroll.contentY;
  await dragSheet(cdp, -300);
  const lowerBag = await getSceneSnapshot(cdp);
  assert.equal(lowerBag.sheet.blankCells, 94, 'scrolling keeps all 携行 grid cells mounted');
  assert.ok(lowerBag.sheet.scroll.contentY > bagScrollBefore + 5, 'the 100-cell grid physically scrolls');
  await save('14c-bag-scrolled', lowerBag);
  await touchNode(cdp, 'MobileSheetClose');
  await waitForSnapshot(cdp, 'walking after bag', (snapshot) => matchesWalking(snapshot, 'hub'));

  await walkTo(cdp, { x: 950, y: 500 }, 'leave-merchant');
  await walkTo(cdp, { x: 640, y: 240 }, 'approach-entry-portal');
  const portal = await getSceneSnapshot(cdp);
  assert.equal(portal.phase, 'hub', 'walking into portal range does not automatically enter a run');
  assert.match(portal.walking.interactionHint, /传送门/u);
  await save('09-portal-proximity', portal);
  // Entry selection and cost inspection are local-only; only explicit confirmation enters.
  await keyTap(cdp, 'e');
  await waitForSnapshot(cdp, 'entry configuration sheet',
    (snapshot) => snapshot.sheet.kind === 'entry' && snapshot.domain.activePanel === 'entry');
  await save('09b-entry-sheet', await getSceneSnapshot(cdp));
  const entryBaseline = await getRuntimeEvidence(cdp);
  const choices = (await getSceneSnapshot(cdp)).domain.entryDungeons;
  const originalChapter = choices.find(({ selected }) => selected);
  assert.equal(new Set(choices.map(({ id }) => id)).size, 19, 'all 19 chapters are listed without cycling');
  for (const chapter of [...choices.filter(({ selected }) => !selected), originalChapter]) {
    await bringSheetNodeIntoView(cdp, `MobileSheetEntryDungeon:${chapter.id}`);
    await touchNode(cdp, `MobileSheetEntryDungeon:${chapter.id}`);
    assert.equal((await getSceneSnapshot(cdp)).domain.entryDungeons.find(({ selected }) => selected)?.id,
      chapter.id, 'selecting a chapter updates the entry draft');
    if (chapter.id !== originalChapter.id) await touchNode(cdp, 'MobileSheetEntryBack');
  }
  assertSameDomainEvidence(entryBaseline, await getRuntimeEvidence(cdp), 'browsing every chapter');
  await touchNode(cdp, 'MobileSheetEntryConfirm');
  const explore = await waitForSnapshot(cdp, 'walkable exploration room', (snapshot) => matchesWalking(snapshot, 'explore'));
  assertWalking(explore, 'explore');
  await save('10-explore', explore);
  const codexControl = await queryNodePoint(cdp, 'SceneCodex');
  assert.equal(codexControl.found && codexControl.hasTouch, true, 'existing chapter codex remains reachable');
  const codexBaseline = await getRuntimeEvidence(cdp);
  await touchNode(cdp, 'SceneCodex');
  let codex = await waitForSnapshot(cdp, 'chapter objective sheet', (snapshot) => snapshot.sheet.kind === 'objectives');
  // Every semantic codex section is one card in a single scroll document.
  assert.equal(codex.sheet.legacyPaging, false, 'regular sheet content no longer uses pagination');
  assert.equal(codex.sheet.scroll.present, true, 'chapter codex is presented in a scroll region');
  const codexTitles = [...codex.sheet.readoutTitles];
  assert.ok(codexTitles.length >= 5, `chapter codex retains its semantic sections (${codexTitles.length})`);
  // Physically drag the document: content offset moves and the gold thumb is present.
  assert.equal(codex.sheet.scroll.thumb, true, 'long codex shows the gold scroll thumb');
  const codexOffsetBefore = codex.sheet.scroll.contentY;
  await dragSheet(cdp, -220);
  codex = await getSceneSnapshot(cdp);
  assert.ok(codex.sheet.scroll.contentY > codexOffsetBefore + 1, 'physical drag scrolls the codex document');
  const chapterCodex = { pageTitles: codexTitles, pageCount: codexTitles.length };
  await save('11-chapter-codex', codex);
  await touchNode(cdp, 'MobileSheetClose');
  await waitForSnapshot(cdp, 'walking after objectives', (snapshot) => matchesWalking(snapshot, 'explore') && !snapshot.sheet.kind);
  assertSameDomainEvidence(codexBaseline, await getRuntimeEvidence(cdp), 'codex scrolling');
  await walkTo(cdp, { x: 500, y: 490 }, 'approach-opening-monster');
  assert.equal((await getSceneSnapshot(cdp)).phase, 'explore', 'monster proximity alone does not start combat');
  await touchNode(cdp, 'WalkInteract');
  let encounter = await waitForSnapshot(cdp, 'walkable combat room', (snapshot) => matchesWalking(snapshot, 'combat'));
  assertWalking(encounter, 'combat');
  await save('12-combat', encounter);
  const disabledCombat = encounter.domain.availableActions.find((action) => !action.enabled && action.actionId.startsWith('combat.action:'));
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
  while (encounter.phase === 'combat' && physicalAttackCount < 12) {
    const before = await getSceneSnapshot(cdp);
    const baseline = await getRuntimeEvidence(cdp);
    const actionName = await findPhysicalAction(cdp, 'combat.action:attack', 'combat');
    await touchNode(cdp, actionName);
    physicalAttackCount += 1;
    encounter = await waitForSnapshot(cdp, 'response to physical combat attack ' + physicalAttackCount,
      (snapshot) => snapshot.phase !== 'combat' || (matchesWalking(snapshot, 'combat')
        && snapshot.domain.combatTurn > before.domain.combatTurn
        && snapshot.actions.touchableNames.includes('WalkCombatAction:combat.action:attack')));
    const after = await getRuntimeEvidence(cdp);
    assert.notEqual(after.stateSha256, baseline.stateSha256, 'physical attack updates gameplay state');
    sceneEvidence.push({ stage: 'physical-attack-' + physicalAttackCount, before: baseline, after,
      enemyHpBefore: before.domain.enemyHp, enemyHpAfter: encounter.domain.enemyHp, phase: encounter.phase });
    if (physicalAttackCount === 1) await save('13-combat-after-attack', encounter);
  }
  assert.equal(encounter.phase, 'explore', 'physical attacks must win and return to exploration');
  assert.equal(encounter.domain.currentNodeCleared, true, 'victory clears the room encounter');
  assertWalking(encounter, 'explore');
  await save('14-victory-explore', encounter);
  // A naturally reached optional event must not hide the underlying trap choices.
  await walkTo(cdp, { x: 500, y: 500 }, 'leave-lower-room-pillars');
  await walkTo(cdp, { x: 790, y: 500 }, 'approach-east-trap-door');
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
  assert.equal(map.sheet.mapCells.length, map.domain.mapNodeCount, 'the map mounts every known and fogged cell together');
  assert.equal(map.sheet.legacyPaging, false, 'the complete map has no page controls');
  assert.ok(map.sheet.scroll.horizontal && map.sheet.scroll.vertical, 'the complete map scrolls in both directions');
  assert.ok(map.sheet.scroll.content.width >= map.sheet.scroll.view.width
    && map.sheet.scroll.content.height >= map.sheet.scroll.view.height, 'the map content spans its full grid');
  await save('14b-mobile-map', map);
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
  const returned = await waitForSnapshot(cdp, 'walking hub after settlement', (snapshot) => matchesWalking(snapshot, 'hub'));
  assertWalking(returned, 'hub');
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
      && !snapshot.walking.environmentLoading && !snapshot.walking.backdropPending;
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
  // queryNodePoint returns x/y in CSS px but height in design px, so scale
  // the view half-height when keeping the drag start inside the region.
  const scale = viewport.width / designViewport.width;
  distance = Math.sign(distance) * Math.min(Math.abs(distance), region.height * scale - 48);
  const startX = region.x;
  const startY = Math.min(region.y + Math.abs(distance) / 2 + 12, region.y + (region.height * scale) / 2 - 24);
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
    if (!target || !holder) return { inside: false };
    const cameraNode = nodes.find((candidate) => candidate.getComponent(cc.Camera));
    const screen = new cc.Vec3();
    cameraNode.getComponent(cc.Camera).worldToScreen(target.worldPosition, screen);
    const hScreen = new cc.Vec3();
    cameraNode.getComponent(cc.Camera).worldToScreen(holder.worldPosition, hScreen);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const toCanvasY = (sy) => rect.top + ((canvas.height - sy) / canvas.height) * rect.height;
    const ty = toCanvasY(screen.y);
    const hy = toCanvasY(hScreen.y);
    const screenHeight = (node) => {
      const transform = node.getComponent(cc.UITransform);
      const top = transform.convertToWorldSpaceAR(new cc.Vec3(0, transform.contentSize.height / 2, 0));
      const bottom = transform.convertToWorldSpaceAR(new cc.Vec3(0, -transform.contentSize.height / 2, 0));
      const a = new cc.Vec3(), b = new cc.Vec3();
      cameraNode.getComponent(cc.Camera).worldToScreen(top, a);
      cameraNode.getComponent(cc.Camera).worldToScreen(bottom, b);
      return Math.abs(toCanvasY(a.y) - toCanvasY(b.y));
    };
    const h = screenHeight(holder);
    const targetHalf = screenHeight(target) / 2;
    return { inside: ty - targetHalf >= hy - h / 2 && ty + targetHalf <= hy + h / 2, y: ty, holderY: hy, holderName: holder.name };
  })()`);
}

// Scroll the open sheet until an offscreen card is inside the masked region.
async function bringSheetNodeIntoView(cdp, nodeName) {
  let lastContentY = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const hit = await pointInsideHolder(cdp, nodeName);
    if (hit.inside) {
      // A physical drag leaves Cocos inertia running after the finger lifts.
      // Wait for it to settle before deriving the next physical tap position.
      let previous = (await getSceneSnapshot(cdp)).sheet.scroll.offset;
      for (let settle = 0; settle < 15; settle += 1) {
        await delay(120);
        const current = (await getSceneSnapshot(cdp)).sheet.scroll.offset;
        if (Math.abs(current - previous) < 0.1) break;
        previous = current;
      }
      if ((await pointInsideHolder(cdp, nodeName)).inside) return;
    }
    const snapshot = await getSceneSnapshot(cdp);
    if (lastContentY !== null && Math.abs(snapshot.sheet.scroll.contentY - lastContentY) < 0.5) {
      throw new Error(`sheet scroll reached its end without revealing ${nodeName}`);
    }
    lastContentY = snapshot.sheet.scroll.contentY;
    await dragSheet(cdp, hit.y < hit.holderY ? 100 : -100, hit.holderName);
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
    const dungeonRendererGallery = await runDungeonRendererGallery(cdp, outputDir);
    // The 750px design viewport walks both galleries; the 320px small-viewport
    // run focuses on the layout gallery touch-target-in-screen assertions.
    const sheetStyleGallery = viewport.width === designViewport.width
      ? await runSheetStyleGallery(cdp, outputDir)
      : { artifacts: [], screenshotCount: 0, restoredPhase: null, evidenceBoundary: 'skipped at narrow viewport' };
    const sheetLayoutGallery = await runSheetLayoutGallery(cdp, outputDir);
    await delay(200);
    const browserFailures = collectBrowserFailures(cdp.events);
    assert.deepEqual(browserFailures, [], `browser/runtime failures:\n${browserFailures.join('\n')}`);
    const manifest = Object.freeze({
      schemaVersion: 2,
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
    console.log('[canvas-smoke] passed continuous keyboard/touch walking -> collision/camera -> merchant/details/help -> portal -> explore/codex -> combat victory -> result -> hub (Web preview only; not WeChat device acceptance)');
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
  }
}

main().catch((error) => {
  console.error(`[canvas-smoke] failed: ${formatError(error)}`);
  process.exitCode = 1;
});
