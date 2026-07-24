#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORAGE_KEY = 'infinite-flow:save:v1';
const CAMPAIGN_ROUTE_DUNGEON_NAMES = [
  '妖塔一层',
  '镜潮地铁',
  '星坠矿井',
  '锈疫病院',
  '灰烬竞技场',
  '梦档案馆',
  '虚界城',
  '时序观测庭',
  '因果清算所',
  '熵海方舟',
  '镜海轮回城',
  '删界终稿院',
  '亡队遗产拍卖庭',
  '众生原型库',
  '寂声广播塔',
  '失联避难所',
  '伪证裁定庭',
  '战痕复演场',
  '天幕监察城'
];
const DUNGEON_COUNT = CAMPAIGN_ROUTE_DUNGEON_NAMES.length;
const ITEM_IDS = [
  'healing_pill',
  'thunder_talisman',
  'dispel_talisman',
  'gate_sigil',
  'echo_coin',
  'capture_net',
  'spirit_bait',
  'armor_patch',
  'focus_incense',
  'demon_bone',
  'hidden_stone',
  'medicine_ash',
  'mirror_shell',
  'star_iron',
  'method_page',
  'cracked_core',
  'rift_dust',
  'chronal_glass',
  'causal_seal',
  'entropy_crystal',
  'phase_glass',
  'redaction_ink',
  'legacy_scrip',
  'genesis_serum',
  'silence_core',
  'rescue_badge',
  'truth_fragment',
  'combat_reel',
  'observation_shard'
];
const TACTICAL_ITEM_IDS = ITEM_IDS.slice(0, 9);
const DEFAULT_PREPARED_TACTICAL_ITEM_IDS = ['healing_pill', 'dispel_talisman', 'gate_sigil'];
const BASIC_EQUIPMENT_LEVELS = {
  training_blade: 1,
  patched_headwrap: 1,
  patched_coat: 1,
  patched_gloves: 1,
  patched_boots: 1,
  patched_belt: 1,
  plain_charm: 1
};
const BASIC_EQUIPPED = {
  weapon: 'training_blade',
  head: 'patched_headwrap',
  armor: 'patched_coat',
  hands: 'patched_gloves',
  feet: 'patched_boots',
  waist: 'patched_belt',
  charm: 'plain_charm'
};
const BASIC_OWNED_EQUIPMENT = Object.keys(BASIC_EQUIPMENT_LEVELS);
const LEGACY_EQUIPMENT_LEVELS = {
  training_blade: 1,
  patched_coat: 1,
  plain_charm: 1
};
const LEGACY_EQUIPPED = {
  weapon: 'training_blade',
  armor: 'patched_coat',
  charm: 'plain_charm'
};
const ADVANCED_OWNED_EQUIPMENT = [
  'training_blade',
  'patched_headwrap',
  'patched_coat',
  'patched_gloves',
  'patched_boots',
  'patched_belt',
  'plain_charm',
  'armor_piercing_sword',
  'bone_spear',
  'ember_staff',
  'mist_hood',
  'spirit_robe',
  'guardian_plate',
  'guardian_gauntlets',
  'cloudstep_boots',
  'rift_belt',
  'cloudstep_charm',
  'rift_charm',
  'starforged_edge',
  'void_lantern'
];
const ADVANCED_EQUIPMENT_LEVELS = {
  training_blade: 1,
  patched_headwrap: 1,
  patched_coat: 1,
  patched_gloves: 1,
  patched_boots: 1,
  patched_belt: 1,
  plain_charm: 1,
  armor_piercing_sword: 3,
  bone_spear: 3,
  ember_staff: 3,
  mist_hood: 3,
  spirit_robe: 3,
  guardian_plate: 3,
  guardian_gauntlets: 3,
  cloudstep_boots: 3,
  rift_belt: 3,
  cloudstep_charm: 3,
  rift_charm: 3,
  starforged_edge: 3,
  void_lantern: 3
};
const ADVANCED_EQUIPPED = {
  weapon: 'starforged_edge',
  head: 'mist_hood',
  armor: 'guardian_plate',
  hands: 'guardian_gauntlets',
  feet: 'cloudstep_boots',
  waist: 'rift_belt',
  charm: 'cloudstep_charm'
};
const FORGE_RESONANCE_ATTUNEMENTS = {
  starforged_edge: 'forge_overdrive',
  guardian_plate: 'forge_overdrive',
  guardian_gauntlets: 'forge_overdrive'
};
const CHRONAL_EQUIPMENT_IDS = ['chronal_edge', 'chronal_aegis', 'chronal_lens'];
const CHRONAL_EQUIPMENT_LEVELS = {
  chronal_edge: 3,
  chronal_aegis: 3,
  chronal_lens: 3
};
const CHRONAL_ATTUNEMENTS = {
  chronal_edge: 'chronal_acceleration',
  chronal_aegis: 'chronal_acceleration',
  chronal_lens: 'chronal_acceleration'
};
const CHRONAL_TEMPER_RANKS = {
  chronal_edge: 1,
  chronal_aegis: 1,
  chronal_lens: 1
};
const TEMPORAL_PRIOR_DUNGEON_IDS = [
  'demon_tower_1',
  'metro_abyss',
  'starfall_mine',
  'rust_hospital',
  'ash_arena',
  'dream_archive',
  'void_citadel'
];
const TEMPORAL_PRIOR_MAINLINE_TASK_IDS = TEMPORAL_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const CAUSAL_PRIOR_DUNGEON_IDS = [...TEMPORAL_PRIOR_DUNGEON_IDS, 'temporal_observatory'];
const CAUSAL_PRIOR_MAINLINE_TASK_IDS = CAUSAL_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const ENTROPY_PRIOR_DUNGEON_IDS = [...CAUSAL_PRIOR_DUNGEON_IDS, 'causal_clearinghouse'];
const ENTROPY_PRIOR_MAINLINE_TASK_IDS = ENTROPY_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const MIRROR_PRIOR_DUNGEON_IDS = [...ENTROPY_PRIOR_DUNGEON_IDS, 'entropy_ark'];
const MIRROR_PRIOR_MAINLINE_TASK_IDS = MIRROR_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const REDACTION_PRIOR_DUNGEON_IDS = [...MIRROR_PRIOR_DUNGEON_IDS, 'mirror_cycle_city'];
const REDACTION_PRIOR_MAINLINE_TASK_IDS = REDACTION_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const AUCTION_PRIOR_DUNGEON_IDS = [...REDACTION_PRIOR_DUNGEON_IDS, 'redaction_scriptorium'];
const AUCTION_PRIOR_MAINLINE_TASK_IDS = AUCTION_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const GENESIS_PRIOR_DUNGEON_IDS = [...AUCTION_PRIOR_DUNGEON_IDS, 'legacy_auction_court'];
const GENESIS_PRIOR_MAINLINE_TASK_IDS = GENESIS_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const BROADCAST_PRIOR_DUNGEON_IDS = [...GENESIS_PRIOR_DUNGEON_IDS, 'genesis_vault'];
const BROADCAST_PRIOR_MAINLINE_TASK_IDS = BROADCAST_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const SHELTER_PRIOR_DUNGEON_IDS = [...BROADCAST_PRIOR_DUNGEON_IDS, 'silent_broadcast_tower'];
const SHELTER_PRIOR_MAINLINE_TASK_IDS = SHELTER_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const VERDICT_PRIOR_DUNGEON_IDS = [...SHELTER_PRIOR_DUNGEON_IDS, 'lost_shelter'];
const VERDICT_PRIOR_MAINLINE_TASK_IDS = VERDICT_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const REPLAY_PRIOR_DUNGEON_IDS = [...VERDICT_PRIOR_DUNGEON_IDS, 'false_testimony_court'];
const REPLAY_PRIOR_MAINLINE_TASK_IDS = REPLAY_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const PANOPTICON_PRIOR_DUNGEON_IDS = [...REPLAY_PRIOR_DUNGEON_IDS, 'combat_replay_stage'];
const PANOPTICON_PRIOR_MAINLINE_TASK_IDS = PANOPTICON_PRIOR_DUNGEON_IDS.map(
  (dungeonId) => `mainline_clear_${dungeonId}`
);
const EQUIPMENT_COMMISSION_EQUIPMENT_IDS = ['ember_staff', 'spirit_robe'];
const EQUIPMENT_COMMISSION_MATERIAL_ID = 'medicine_ash';
const EQUIPMENT_COMMISSION_PRIOR_DUNGEON_IDS = ['metro_abyss', 'starfall_mine'];
const EQUIPMENT_COMMISSION_START_RESOURCES = {
  rewardPoints: 1500,
  lingyun: 5,
  material: 4
};
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processGroupSpawnOptions() {
  return process.platform === 'win32' ? {} : { detached: true };
}

function hasProcessExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForProcessExitOrClose(child, timeoutMs) {
  if (hasProcessExited(child)) return Promise.resolve(true);

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

function signalProcessTree(child, signal) {
  if (!child.pid) return;

  try {
    // Non-Windows smoke children run in their own process group, so this also
    // terminates Vite and Chrome helper processes.
    process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') child.kill(signal);
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not allocate a local port.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
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
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  return findOnPath(['google-chrome', 'chromium', 'chromium-browser', 'chrome']);
}

function getLocalViteCommand() {
  const viteEntry = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteEntry)) {
    throw new Error(`Local Vite entry was not found at ${viteEntry}. Run npm install before smoke:ui.`);
  }
  return { command: process.execPath, args: [viteEntry] };
}

function formatProcessOutput(label, output) {
  return `${label}:\n${output.trim() || '(empty)'}`;
}

async function waitForHttp(url, label, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }

  throw new Error(`Timed out waiting for ${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function waitForHttpOrChildError(child, url, label) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off('error', onError);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };

    child.once('error', onError);
    waitForHttp(url, label).then(
      (response) => {
        cleanup();
        resolve(response);
      },
      (error) => {
        cleanup();
        reject(error);
      }
    );
  });
}

async function stopProcess(child) {
  if (!child || hasProcessExited(child)) return;

  const termWait = waitForProcessExitOrClose(child, 1500);
  signalProcessTree(child, 'SIGTERM');
  if (await termWait) return;

  const killWait = waitForProcessExitOrClose(child, 1500);
  signalProcessTree(child, 'SIGKILL');
  await killWait;
  child.stdout?.destroy();
  child.stderr?.destroy();
}

class CdpSession {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.webSocket = new WebSocket(webSocketUrl);
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.webSocket.addEventListener('open', resolve, { once: true });
      this.webSocket.addEventListener('error', reject, { once: true });
    });

    this.webSocket.addEventListener('message', (event) => {
      const payload = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
      const message = JSON.parse(payload);
      if (!message.id) {
        this.events.push(message);
        return;
      }

      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;

    const payload = JSON.stringify({ id, method, params });
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.webSocket.send(payload);

    return promise;
  }

  close() {
    this.webSocket.close();
  }
}

async function createPage(debugPort, appUrl) {
  const createResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrl)}`, {
    method: 'PUT'
  });

  if (createResponse.ok) return createResponse.json();

  const listResponse = await waitForHttp(`http://127.0.0.1:${debugPort}/json/list`, 'Chrome targets');
  const targets = await listResponse.json();
  const target = targets.find((candidate) => candidate.type === 'page');
  if (!target) throw new Error('Chrome did not expose a debuggable page target.');
  return target;
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(detail);
  }

  return result.result.value;
}

async function waitForPage(cdp, expression, label, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      if (await evaluate(cdp, `Boolean(${expression})`)) return;
    } catch (error) {
      lastError = error;
    }
    await delay(120);
  }

  throw new Error(`Timed out waiting for ${label}: ${lastError instanceof Error ? lastError.message : 'condition stayed false'}`);
}

async function clickButton(cdp, label) {
  await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        !candidate.disabled && candidate.textContent.includes(${JSON.stringify(label)})
      );
      if (!button) throw new Error('Missing enabled button: ${label}');
      button.click();
      return true;
    })()`
  );
}

async function clickButtonByPointer(cdp, label, scopeSelector = 'body') {
  const point = await evaluate(
    cdp,
    `(() => {
      const scope = document.querySelector(${JSON.stringify(scopeSelector)});
      if (!scope) throw new Error('Missing button scope: ${scopeSelector}');
      const button = [...scope.querySelectorAll('button')].find((candidate) =>
        !candidate.disabled && candidate.textContent.includes(${JSON.stringify(label)})
      );
      if (!button) throw new Error('Missing enabled button: ${label}');
      button.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !button.contains(hit)) {
        throw new Error('Button is not the pointer target: ${label}');
      }
      return { x, y };
    })()`
  );
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function clickElementByPointer(cdp, selector) {
  const pointerState = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing pointer target: ${selector}');
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      const candidates = [
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { x: rect.left + 4, y: rect.top + 4 },
        { x: rect.right - 4, y: rect.top + 4 },
        { x: rect.left + 4, y: rect.bottom - 4 }
      ];
      const point = candidates.find(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return Boolean(hit && element.contains(hit));
      });
      return {
        point,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        hitTag: point ? '' : document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.outerHTML?.slice(0, 180) ?? ''
      };
    })()`
  );
  if (!pointerState.point) {
    throw new Error(`Element is not the pointer target: ${selector} ${JSON.stringify(pointerState)}`);
  }
  const point = pointerState.point;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function clickDialogButton(cdp, label) {
  const point = await evaluate(
    cdp,
    `(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!dialog) throw new Error('Missing open dialog');
      const button = [...dialog.querySelectorAll('button')].find((candidate) =>
        !candidate.disabled && candidate.textContent.includes(${JSON.stringify(label)})
      );
      if (!button) throw new Error('Missing enabled dialog button: ${label}');
      button.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !button.contains(hit)) {
        throw new Error('Dialog button is not the pointer target: ${label}');
      }
      return { x, y };
    })()`
  );
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function getModalLifecycleState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      const appContent = document.querySelector('.app-content');
      const taskTrigger = document.querySelector('.task-trigger');
      const characterTrigger = document.querySelector('.character-trigger');
      const taskDialog = document.querySelector('.task-sheet[role="dialog"][aria-modal="true"]');
      const characterDialog = document.querySelector('.character-sheet[role="dialog"][aria-modal="true"]');
      return {
        anyDialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
        hasTaskDialog: Boolean(taskDialog),
        hasCharacterDialog: Boolean(characterDialog),
        taskDialogText: taskDialog?.textContent ?? '',
        characterDialogText: characterDialog?.textContent ?? '',
        bodyHasModalOpen: document.body.classList.contains('modal-open'),
        appContentInert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
        focusOnTaskTrigger: document.activeElement === taskTrigger,
        focusOnCharacterTrigger: document.activeElement === characterTrigger,
        visibleTaskPanels: [...document.querySelectorAll('.mainline-task-panel, .chapter-side-task-panel, .side-task-card')].filter(isVisible).length,
        visibleCharacterPanels: [...document.querySelectorAll('.character-panel, .inventory-grid')].filter(isVisible).length
      };
    })()`
  );
}

async function getCharacterSheetState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      const trigger = [...document.querySelectorAll('button')].find((candidate) => compactText(candidate).includes('角色'));
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      const closeButton = document.querySelector('.character-close');
      const appContent = document.querySelector('.app-content');
      const activeElement = document.activeElement;
      const activeElementText = compactText(activeElement);
      trigger?.focus();
      const backgroundFocusBlocked = !dialog || document.activeElement !== trigger;
      if (activeElement instanceof HTMLElement) activeElement.focus();
      return {
        hasTrigger: Boolean(trigger),
        triggerText: compactText(trigger),
        hasDialog: Boolean(dialog),
        dialogText: compactText(dialog),
        focusInsideDialog: Boolean(dialog?.contains(activeElement)),
        focusOnCloseButton: activeElement === closeButton,
        activeElementText,
        bodyHasModalOpen: document.body.classList.contains('modal-open'),
        appContentInert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
        backgroundFocusBlocked,
        visibleCharacterPanels: [...document.querySelectorAll('.character-panel')].filter(isVisible).length,
        visibleInventoryGrids: [...document.querySelectorAll('.inventory-grid')].filter(isVisible).length
      };
    })()`
  );
}

async function assertCharacterSheetClosed(cdp, label) {
  const sheet = await getCharacterSheetState(cdp);
  if (!sheet.hasTrigger || !/角色/.test(sheet.triggerText) || !/生命|HP|战力/.test(sheet.triggerText)) {
    throw new Error(`${label} should show a compact character/status trigger, got ${JSON.stringify(sheet)}`);
  }
  if (sheet.hasDialog || sheet.visibleCharacterPanels > 0 || sheet.visibleInventoryGrids > 0) {
    throw new Error(`${label} should hide character panel and inventory until opened, got ${JSON.stringify(sheet)}`);
  }
}

async function openCharacterSheet(cdp, label) {
  await clickElementByPointer(cdp, '.character-trigger');
  await waitForPage(
    cdp,
    `(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      return Boolean(dialog) &&
        dialog.getAttribute('aria-labelledby') &&
        dialog.textContent.includes('轮回者面板') &&
        dialog.textContent.includes('当前装配') &&
        dialog.textContent.includes('出战位') &&
        dialog.textContent.includes('道具与材料');
    })()`,
    `${label} character sheet opens`
  );
  const sheet = await getCharacterSheetState(cdp);
  if (!sheet.dialogText.includes('轮回者面板') || !sheet.dialogText.includes('当前装配') || !sheet.dialogText.includes('道具与材料')) {
    throw new Error(`${label} character sheet missing expected sections: ${JSON.stringify(sheet)}`);
  }
  if (!sheet.focusOnCloseButton && !sheet.focusInsideDialog) {
    throw new Error(`${label} character sheet should move focus into the dialog, got ${JSON.stringify(sheet)}`);
  }
  if (!sheet.bodyHasModalOpen) {
    throw new Error(`${label} character sheet should lock body scroll with modal-open, got ${JSON.stringify(sheet)}`);
  }
  if (!sheet.appContentInert || !sheet.backgroundFocusBlocked) {
    throw new Error(`${label} character sheet should inert background content, got ${JSON.stringify(sheet)}`);
  }
  const modalState = await getModalLifecycleState(cdp);
  if (!modalState.hasCharacterDialog || modalState.hasTaskDialog || modalState.anyDialogCount !== 1) {
    throw new Error(`${label} character sheet should be mutually exclusive with the task modal, got ${JSON.stringify(modalState)}`);
  }
  const loadoutState = await evaluate(
    cdp,
    `(() => {
      const requiredLabels = ${JSON.stringify(['武器', '头部', '身体', '手部', '足部', '腰部', '护符'])};
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      const text = compactText(dialog);
      return {
        rowCount: document.querySelectorAll('.loadout-row').length,
        missingLabels: requiredLabels.filter((entry) => !text.includes(entry)),
        text
      };
    })()`
  );
  if (loadoutState.rowCount < 7 || loadoutState.missingLabels.length > 0) {
    throw new Error(`${label} character sheet should show weapon, five armor slots, and charm, got ${JSON.stringify(loadoutState)}`);
  }
  return sheet;
}

async function closeCharacterSheet(cdp, label) {
  await clickElementByPointer(cdp, '.character-close');
  await waitForPage(
    cdp,
    `(() => {
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      return !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        ![...document.querySelectorAll('.character-panel')].some(isVisible) &&
        ![...document.querySelectorAll('.inventory-grid')].some(isVisible);
    })()`,
    `${label} character sheet closes`
  );
}

async function assertCharacterBackdropCloses(cdp, label) {
  await evaluate(
    cdp,
    `(() => {
      const backdrop = document.querySelector('.character-backdrop');
      if (!backdrop) throw new Error('Missing character backdrop');
      backdrop.click();
      return true;
    })()`
  );
  await waitForPage(
    cdp,
    `(() => {
      const appContent = document.querySelector('.app-content');
      const trigger = document.querySelector('.character-trigger');
      return !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        !document.body.classList.contains('modal-open') &&
        !Boolean(appContent?.hasAttribute('inert') || appContent?.inert) &&
        document.activeElement === trigger;
    })()`,
    `${label} character backdrop closes and unlocks the page`
  );
  const modalState = await getModalLifecycleState(cdp);
  if (modalState.anyDialogCount || modalState.bodyHasModalOpen || modalState.appContentInert || !modalState.focusOnCharacterTrigger) {
    throw new Error(`${label} character backdrop should close the modal, unlock the page, and restore trigger focus, got ${JSON.stringify(modalState)}`);
  }
}

async function pressEscape(cdp) {
  await cdp.send('Page.bringToFront');
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  });
}

async function assertEscapeClosesCharacterSheet(cdp, label) {
  await pressEscape(cdp);
  await waitForPage(
    cdp,
    `(() => {
      const trigger = document.querySelector('.character-trigger');
      return !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        !document.body.classList.contains('modal-open') &&
        document.activeElement === trigger;
    })()`,
    `${label} Escape closes character sheet and restores trigger focus`
  );
}

async function getTaskModalState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      const trigger = document.querySelector('.task-trigger');
      const dialog = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].find((candidate) =>
        candidate.classList.contains('task-sheet') ||
        (candidate.textContent.includes('主线任务') && candidate.textContent.includes('章节支线'))
      );
      const closeButton = document.querySelector('.task-close');
      const appContent = document.querySelector('.app-content');
      const activeElement = document.activeElement;
      const activeElementText = compactText(activeElement);
      trigger?.focus();
      const backgroundFocusBlocked = !dialog || document.activeElement !== trigger;
      if (activeElement instanceof HTMLElement) activeElement.focus();
      return {
        hasTrigger: Boolean(trigger),
        triggerText: compactText(trigger),
        hasDialog: Boolean(dialog),
        hasTaskPanel: Boolean(dialog?.querySelector('.task-panel')),
        dialogText: compactText(dialog),
        focusInsideDialog: Boolean(dialog?.contains(activeElement)),
        focusOnCloseButton: activeElement === closeButton,
        activeElementText,
        bodyHasModalOpen: document.body.classList.contains('modal-open'),
        appContentInert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
        backgroundFocusBlocked,
        visibleMainlinePanels: [...document.querySelectorAll('.mainline-task-panel')].filter(isVisible).length,
        visibleChapterSidePanels: [...document.querySelectorAll('.chapter-side-task-panel')].filter(isVisible).length,
        visibleSideTaskCards: [...document.querySelectorAll('.side-task-card')].filter(isVisible).length,
        visibleTaskPanelsInAppContent: [...document.querySelectorAll('.app-content .mainline-task-panel, .app-content .chapter-side-task-panel, .app-content .side-task-card')].filter(isVisible).length
      };
    })()`
  );
}

async function assertTaskModalClosed(cdp, label) {
  const taskModal = await getTaskModalState(cdp);
  if (!taskModal.hasTrigger || !/任务/.test(taskModal.triggerText)) {
    throw new Error(`${label} should show a compact task trigger, got ${JSON.stringify(taskModal)}`);
  }
  if (
    taskModal.hasDialog ||
    taskModal.visibleMainlinePanels > 0 ||
    taskModal.visibleChapterSidePanels > 0 ||
    taskModal.visibleSideTaskCards > 0 ||
    taskModal.visibleTaskPanelsInAppContent > 0
  ) {
    throw new Error(`${label} should keep task panels hidden until the task modal opens, got ${JSON.stringify(taskModal)}`);
  }
  return taskModal;
}

async function openTaskModal(cdp, label) {
  await clickElementByPointer(cdp, '.task-trigger');
  await waitForPage(
    cdp,
    `(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      return Boolean(dialog) &&
        dialog.textContent.includes('主线任务') &&
        dialog.textContent.includes('章节支线') &&
        dialog.textContent.includes('妖塔一层') &&
        document.querySelectorAll('.side-task-card').length >= 2;
    })()`,
    `${label} task modal opens`
  );
  const taskModal = await getTaskModalState(cdp);
  if (
    !taskModal.hasTaskPanel ||
    !taskModal.dialogText.includes('主线任务') ||
    !taskModal.dialogText.includes('章节支线') ||
    !taskModal.dialogText.includes('妖塔一层') ||
    taskModal.visibleSideTaskCards < 2 ||
    taskModal.visibleTaskPanelsInAppContent > 0
  ) {
    throw new Error(`${label} task modal missing expected task sections: ${JSON.stringify(taskModal)}`);
  }
  if (!taskModal.focusOnCloseButton && !taskModal.focusInsideDialog) {
    throw new Error(`${label} task modal should move focus into the dialog, got ${JSON.stringify(taskModal)}`);
  }
  if (!taskModal.bodyHasModalOpen) {
    throw new Error(`${label} task modal should lock body scroll with modal-open, got ${JSON.stringify(taskModal)}`);
  }
  if (!taskModal.appContentInert || !taskModal.backgroundFocusBlocked) {
    throw new Error(`${label} task modal should inert background content, got ${JSON.stringify(taskModal)}`);
  }
  const modalState = await getModalLifecycleState(cdp);
  if (!modalState.hasTaskDialog || modalState.hasCharacterDialog || modalState.anyDialogCount !== 1) {
    throw new Error(`${label} task modal should be mutually exclusive with the character sheet, got ${JSON.stringify(modalState)}`);
  }
  return taskModal;
}

async function closeTaskModal(cdp, label) {
  await clickButtonByPointer(cdp, '关闭', '.task-sheet');
  await waitForPage(
    cdp,
    `(() => {
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      return ![...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some((candidate) =>
          candidate.textContent.includes('主线任务')
        ) &&
        ![...document.querySelectorAll('.mainline-task-panel')].some(isVisible) &&
        ![...document.querySelectorAll('.chapter-side-task-panel')].some(isVisible) &&
        ![...document.querySelectorAll('.side-task-card')].some(isVisible);
    })()`,
    `${label} task modal closes`
  );
}

async function assertTaskBackdropCloses(cdp, label) {
  await evaluate(
    cdp,
    `(() => {
      const backdrop = document.querySelector('.task-backdrop');
      if (!backdrop) throw new Error('Missing task backdrop');
      backdrop.click();
      return true;
    })()`
  );
  await waitForPage(
    cdp,
    `(() => {
      const appContent = document.querySelector('.app-content');
      const trigger = document.querySelector('.task-trigger');
      return !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        !document.body.classList.contains('modal-open') &&
        !Boolean(appContent?.hasAttribute('inert') || appContent?.inert) &&
        document.activeElement === trigger;
    })()`,
    `${label} task backdrop closes and unlocks the page`
  );
  const modalState = await getModalLifecycleState(cdp);
  if (modalState.anyDialogCount || modalState.bodyHasModalOpen || modalState.appContentInert || !modalState.focusOnTaskTrigger) {
    throw new Error(`${label} task backdrop should close the modal, unlock the page, and restore trigger focus, got ${JSON.stringify(modalState)}`);
  }
}

async function assertEscapeClosesTaskModal(cdp, label) {
  await pressEscape(cdp);
  await waitForPage(
    cdp,
    `(() => {
      const appContent = document.querySelector('.app-content');
      const trigger = document.querySelector('.task-trigger');
      return !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        !document.body.classList.contains('modal-open') &&
        !Boolean(appContent?.hasAttribute('inert') || appContent?.inert) &&
        document.activeElement === trigger;
    })()`,
    `${label} Escape closes task modal and restores trigger focus`
  );
  const modalState = await getModalLifecycleState(cdp);
  if (modalState.anyDialogCount || modalState.bodyHasModalOpen || modalState.appContentInert || !modalState.focusOnTaskTrigger) {
    throw new Error(`${label} Escape should close the task modal, unlock the page, and restore trigger focus, got ${JSON.stringify(modalState)}`);
  }
}

async function clickCardButton(cdp, selector, cardText, buttonText) {
  await evaluate(
    cdp,
    `(() => {
      const card = [...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(cardText)})
      );
      if (!card) throw new Error('Missing card: ${cardText}');
      const button = [...card.querySelectorAll('button')].find((candidate) =>
        !candidate.disabled && candidate.textContent.includes(${JSON.stringify(buttonText)})
      );
      if (!button) throw new Error('Missing enabled ${buttonText} button in ${cardText}');
      button.click();
      return true;
    })()`
  );
}

async function revealHiddenHubCardByPointer(cdp, selector, cardText) {
  const hubActionBySelector = {
    '.dungeon-card': 'open-hub-dungeons',
    '.shop-card': 'open-hub-supplies',
    '.equipment-card': 'open-hub-equipment',
    '.pet-card': 'open-hub-pets'
  };
  const actionId = hubActionBySelector[selector];
  if (!actionId) return;
  const cardState = await evaluate(
    cdp,
    `(() => {
      const card = [...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(cardText)})
      );
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      return { exists: Boolean(card), visible: isVisible(card) };
    })()`
  );
  if (!cardState.exists || cardState.visible) return;
  await clickElementByPointer(cdp, `[data-action="${actionId}"]`);
  await waitForPage(
    cdp,
    `(() => {
      const card = [...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(cardText)})
      );
      return Boolean(card?.getClientRects().length) &&
        getComputedStyle(card).display !== 'none' &&
        getComputedStyle(card).visibility !== 'hidden';
    })()`,
    `${cardText} hub directory card becomes visible`
  );
}

async function clickCardButtonByPointer(cdp, selector, cardText, buttonText) {
  await revealHiddenHubCardByPointer(cdp, selector, cardText);
  const point = await evaluate(
    cdp,
    `(() => {
      const card = [...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(cardText)})
      );
      if (!card) throw new Error('Missing card: ${cardText}');
      const button = [...card.querySelectorAll('button')].find((candidate) =>
        !candidate.disabled && candidate.textContent.includes(${JSON.stringify(buttonText)})
      );
      if (!button) throw new Error('Missing enabled ${buttonText} button in ${cardText}');
      button.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !button.contains(hit)) {
        throw new Error('Card button is not the pointer target: ${cardText} / ${buttonText}');
      }
      return { x, y };
    })()`
  );
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function getWeaponSkillControlState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const panel = document.querySelector('.combat-panel');
      const actions = panel?.querySelector('.combat-actions');
      const button = actions?.querySelector('[data-action="combat-weapon_skill"]');
      const status = panel?.querySelector('.weapon-skill-state');
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.state;
      if (button) button.scrollIntoView({ block: 'center', inline: 'nearest' });
      const buttonRect = button?.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      const hit = buttonRect
        ? document.elementFromPoint(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2)
        : null;
      return {
        exists: Boolean(button),
        disabled: Boolean(button?.disabled),
        text: compactText(button),
        statusState: status?.dataset.weaponSkillState ?? '',
        statusText: compactText(status),
        actionCount: actions?.querySelectorAll('button').length ?? 0,
        buttonIndex: button ? [...actions.querySelectorAll('button')].indexOf(button) : -1,
        buttonWidth: buttonRect?.width ?? 0,
        buttonHeight: buttonRect?.height ?? 0,
        actionsWidth: actionsRect?.width ?? 0,
        actionsHeight: actionsRect?.height ?? 0,
        pointerTarget: Boolean(button && hit && button.contains(hit)),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        phase: saved?.phase,
        monsterHp: saved?.combat?.monsterHp,
        playerHp: saved?.player?.hp,
        playerMaxHp: saved?.player?.maxHp,
        weaponFocus: saved?.combat?.weaponFocus,
        weaponSkillUsed: saved?.combat?.weaponSkillUsed,
        hasLegacyWeaponSkillUsed: Object.prototype.hasOwnProperty.call(saved?.combat ?? {}, 'weaponSkillUsed'),
        bossPhase: saved?.combat?.bossPhase,
        combatLog: saved?.combat?.log?.join(' ') ?? ''
      };
    })()`
  );
}

async function finishActiveCombatByAttack(cdp, label) {
  for (let round = 0; round < 8; round += 1) {
    const inCombat = await evaluate(cdp, `Boolean(document.querySelector('.combat-panel'))`);
    if (!inCombat) break;
    await clickButtonByPointer(cdp, '攻击', '.combat-panel');
  }

  await waitForPage(
    cdp,
    `!document.querySelector('.combat-panel') && document.querySelector('.grid-node.current.cleared')`,
    `${label} monster clears before movement`
  );
}

async function clearCurrentMonsterByAttack(cdp, label) {
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel')`, `${label} combat starts`);
  const unloadedSkill = await getWeaponSkillControlState(cdp);
  if (
    unloadedSkill.exists ||
    unloadedSkill.statusState !== 'unloaded' ||
    !unloadedSkill.statusText.includes('未装载') ||
    !unloadedSkill.statusText.includes('训练短刃没有武器战技') ||
    unloadedSkill.pageScrollWidth > unloadedSkill.pageClientWidth + 1
  ) {
    throw new Error(`${label} should show a compact unloaded state without a skill button: ${JSON.stringify(unloadedSkill)}`);
  }

  try {
    await finishActiveCombatByAttack(cdp, label);
  } catch (error) {
    const diagnostic = await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.state;
        return {
          phase: saved?.phase,
          playerHp: saved?.player?.hp,
          equippedWeapon: saved?.equipped?.weapon,
          combat: saved?.combat,
          currentNodeId: saved?.run?.currentNodeId,
          currentNodeText: document.querySelector('.grid-node.current')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
          currentNodeCleared: document.querySelector('.grid-node.current')?.classList.contains('cleared') ?? false,
          hasEquipmentOffer: Boolean(document.querySelector('.equipment-loot-offer')),
          resultText: document.querySelector('.result-panel')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
        };
      })()`
    );
    throw new Error(`${error instanceof Error ? error.message : String(error)}; state=${JSON.stringify(diagnostic)}`);
  }
}

async function getRouteLockState(cdp, currentActionText) {
  return evaluate(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const status = document.querySelector('.route-lock-status');
      const blockedCells = [...document.querySelectorAll('.grid-node.route-blocked')];
      const distantCells = [...document.querySelectorAll('.grid-node.distant')];
      const currentAction = [...document.querySelectorAll('.node-action-panel button')].find((button) =>
        button.textContent.includes(${JSON.stringify(currentActionText)})
      );
      return {
        statusText: compactText(status),
        statusClientWidth: status?.clientWidth ?? 0,
        statusScrollWidth: status?.scrollWidth ?? 0,
        blockedCells: blockedCells.map(compactText),
        blockedAllDisabled: blockedCells.every((cell) => cell.disabled),
        blockedAllDescribed: blockedCells.every((cell) => cell.getAttribute('aria-describedby') === 'route-lock-reason'),
        enabledMovableCount: document.querySelectorAll('.grid-node.movable:not(:disabled)').length,
        distantCount: distantCells.length,
        distantAllDisabled: distantCells.every((cell) => cell.disabled),
        distantKeepDistanceCopy: distantCells.every((cell) =>
          compactText(cell).includes('未相邻') || compactText(cell).includes('已清理')
        ),
        currentActionExists: Boolean(currentAction),
        currentActionEnabled: Boolean(currentAction && !currentAction.disabled)
      };
    })()`
  );
}

async function assertRouteLocked(cdp, label, reasonText, currentActionText) {
  const routeLock = await getRouteLockState(cdp, currentActionText);
  if (
    !routeLock.statusText.includes('路线封锁') ||
    !routeLock.statusText.includes(reasonText) ||
    routeLock.blockedCells.length === 0 ||
    !routeLock.blockedAllDisabled ||
    !routeLock.blockedAllDescribed ||
    routeLock.enabledMovableCount !== 0 ||
    routeLock.distantCount === 0 ||
    !routeLock.distantAllDisabled ||
    !routeLock.distantKeepDistanceCopy ||
    !routeLock.currentActionExists ||
    !routeLock.currentActionEnabled ||
    routeLock.statusScrollWidth > routeLock.statusClientWidth + 1
  ) {
    throw new Error(`${label} should expose the route lock while keeping the current action usable: ${JSON.stringify(routeLock)}`);
  }
  return routeLock;
}

async function assertRouteUnlocked(cdp, label, expectMovable = true) {
  const routeState = await getRouteLockState(cdp, '');
  if (
    routeState.statusText ||
    routeState.blockedCells.length > 0 ||
    (expectMovable && routeState.enabledMovableCount === 0)
  ) {
    throw new Error(`${label} should remove the route lock and restore movement: ${JSON.stringify(routeState)}`);
  }
  return routeState;
}

async function clickGridCell(cdp, cellText) {
  const point = await evaluate(
    cdp,
    `(() => {
      const cell = [...document.querySelectorAll('.grid-node')].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(cellText)})
      );
      if (!cell) throw new Error('Missing grid cell: ${cellText}');
      const button = cell.matches('button') ? cell : cell.querySelector('button');
      if (!button || button.disabled) throw new Error('Grid cell is not movable: ${cellText}');
      button.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !button.contains(hit)) {
        throw new Error('Grid cell is not the pointer target: ${cellText}');
      }
      return { x, y };
    })()`
  );
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function setViewport(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile: width <= 620
  });
  await delay(100);
}

async function assertResponsiveSurface(
  cdp,
  {
    width,
    height,
    rootSelector,
    targetSelectors,
    buttonSelectors = [],
    minimumButtonHeight = 0,
    checkRootOverflow = false,
    label
  }
) {
  await setViewport(cdp, width, height);
  const snapshot = await evaluate(
    cdp,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      if (!root) throw new Error('Missing responsive root: ${rootSelector}');
      const inspect = (selector, requireButton = false) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, exists: false };
        element.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = Math.max(2, Math.min(window.innerHeight - 2, rect.top + rect.height / 2));
        const hit = document.elementFromPoint(x, y);
        return {
          selector,
          exists: true,
          enabled: !requireButton || !element.disabled,
          insideX: rect.left >= -1 && rect.right <= window.innerWidth + 1,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          scrollX: window.scrollX,
          pointerTarget: Boolean(hit && element.contains(hit))
        };
      };
      const targetSelectors = ${JSON.stringify(targetSelectors)};
      const targets = targetSelectors.map((selector) => inspect(selector));
      const buttons = ${JSON.stringify(buttonSelectors)}.map((selector) => inspect(selector, true));
      const elements = targetSelectors.map((selector) => document.querySelector(selector));
      const overlaps = [];
      for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
          const left = elements[leftIndex];
          const right = elements[rightIndex];
          if (!left || !right || left.contains(right) || right.contains(left)) continue;
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          const overlapX = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
          const overlapY = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
          if (overlapX > 1 && overlapY > 1) overlaps.push([targetSelectors[leftIndex], targetSelectors[rightIndex]]);
        }
      }
      root.scrollIntoView({ block: 'center', inline: 'center' });
      const rootRect = root.getBoundingClientRect();
      return {
        viewport: [window.innerWidth, window.innerHeight],
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
        rootOverflow: root.scrollWidth > root.clientWidth + 1,
        rootInsideX: rootRect.left >= -1 && rootRect.right <= window.innerWidth + 1,
        targets,
        buttons,
        overlaps
      };
    })()`
  );
  const invalidTargets = snapshot.targets.filter(
    (target) => !target.exists || !target.insideX || target.width <= 0 || !target.pointerTarget
  );
  const invalidButtons = snapshot.buttons.filter(
    (button) =>
      !button.exists ||
      !button.enabled ||
      !button.insideX ||
      button.width <= 0 ||
      button.height < minimumButtonHeight ||
      !button.pointerTarget
  );
  if (
    snapshot.viewport[0] !== width ||
    snapshot.viewport[1] !== height ||
    snapshot.pageOverflow ||
    (checkRootOverflow && snapshot.rootOverflow) ||
    !snapshot.rootInsideX ||
    invalidTargets.length > 0 ||
    invalidButtons.length > 0 ||
    snapshot.overlaps.length > 0
  ) {
    throw new Error(`${label} should fit ${width}x${height} without horizontal overflow or occlusion: ${JSON.stringify(snapshot)}`);
  }
  return snapshot;
}

async function runMobileDungeonMapSmoke(cdp, appUrl) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    screenWidth: 390,
    screenHeight: 844,
    deviceScaleFactor: 1,
    mobile: true
  });

  try {
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, '390px first screen');
    await clickCardButton(cdp, '.dungeon-card', '妖塔一层', '进入副本');
    await waitForPage(
      cdp,
      `document.querySelector('.dungeon-map') &&
        document.querySelectorAll('.dungeon-map > .grid-node').length === 30 &&
        JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'fog_lesser_demon'`,
      '390px demon tower map'
    );
    await assertRouteLocked(cdp, '390px starting node', '先处理当前怪物', '进入战斗');

    const layout = await evaluate(
      cdp,
      `(() => {
        const tolerance = 1;
        const map = document.querySelector('.dungeon-map');
        const panel = map?.closest('.panel');
        if (!map || !panel) throw new Error('Missing mobile dungeon map or containing panel');

        map.scrollIntoView({ block: 'start', inline: 'nearest' });
        const columns = Number.parseInt(getComputedStyle(map).getPropertyValue('--dungeon-grid-columns'), 10);
        const cells = [...map.children].filter((element) => element.matches('.grid-node, .grid-cell'));
        const firstRow = cells.slice(0, columns);
        const rightColumn = cells.filter((_, index) => (index + 1) % columns === 0);
        const rectOf = (element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        };
        const mapRect = rectOf(map);
        const panelRect = rectOf(panel);
        const withinMapHorizontally = (rect) => rect.left >= mapRect.left - tolerance && rect.right <= mapRect.right + tolerance;
        const hitTest = (element) => {
          element.scrollIntoView({ block: 'center', inline: 'nearest' });
          const rect = rectOf(element);
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return {
            text: element.textContent.replace(/\\s+/g, ' ').trim(),
            rect,
            insideViewport:
              rect.left >= -tolerance &&
              rect.right <= window.innerWidth + tolerance &&
              rect.top >= -tolerance &&
              rect.bottom <= window.innerHeight + tolerance,
            hitInsideNode: Boolean(hit && (hit === element || element.contains(hit)))
          };
        };
        const firstRowRects = firstRow.map(rectOf);
        const rightColumnRects = rightColumn.map(rectOf);
        const firstRowWidths = firstRowRects.map((rect) => rect.width);

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          page: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
          body: { clientWidth: document.body.clientWidth, scrollWidth: document.body.scrollWidth },
          panel: { clientWidth: panel.clientWidth, scrollWidth: panel.scrollWidth, rect: panelRect },
          map: { clientWidth: map.clientWidth, scrollWidth: map.scrollWidth, rect: mapRect },
          columns,
          firstRowCount: firstRow.length,
          rightColumnCount: rightColumn.length,
          minNodeWidth: Math.min(...firstRowWidths),
          maxNodeWidth: Math.max(...firstRowWidths),
          firstRowInsideMap: firstRowRects.every(withinMapHorizontally),
          rightColumnInsideMap: rightColumnRects.every(withinMapHorizontally),
          firstRowHits: firstRow.map(hitTest),
          rightColumnHits: rightColumn.map(hitTest)
        };
      })()`
    );

    const overflowed = ['page', 'body', 'panel', 'map'].filter(
      (key) => layout[key].scrollWidth > layout[key].clientWidth + 1
    );
    const missedNodes = [...layout.firstRowHits, ...layout.rightColumnHits].filter(
      (node) => !node.insideViewport || !node.hitInsideNode
    );
    if (
      layout.viewport.width !== 390 ||
      layout.viewport.height !== 844 ||
      layout.columns !== 6 ||
      layout.firstRowCount !== 6 ||
      layout.rightColumnCount !== 5 ||
      overflowed.length > 0 ||
      !layout.firstRowInsideMap ||
      !layout.rightColumnInsideMap ||
      layout.minNodeWidth < 44 ||
      layout.maxNodeWidth - layout.minNodeWidth > 1 ||
      missedNodes.length > 0
    ) {
      throw new Error(`390px dungeon map should fit six stable, hittable columns: ${JSON.stringify({ ...layout, overflowed, missedNodes })}`);
    }

    await clearCurrentMonsterByAttack(cdp, '390px starting node');
    await assertRouteUnlocked(cdp, '390px cleared starting node');
    await clickGridCell(cdp, '血字阶梯');
    await waitForPage(
      cdp,
      `document.querySelector('.grid-node.current')?.textContent.includes('血字阶梯') &&
        document.querySelector('.dungeon-event-card')?.textContent.includes('血字阶梯的呼吸')`,
      '390px real pointer grid move'
    );
    await clickButton(cdp, '重开');
    await waitForPage(
      cdp,
      `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
        document.querySelector('.resource-strip')?.textContent.includes('850')`,
      '390px restart after map smoke'
    );
    console.log(
      `[smoke] 390x844 dungeon map fits ${layout.columns} equal columns at ${layout.minNodeWidth.toFixed(1)}px and keeps first-row/right-column centers hittable`
    );
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'desktop state after mobile map smoke');
}

async function runBossFlowSmoke(cdp, appUrl) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    screenWidth: 390,
    screenHeight: 844,
    deviceScaleFactor: 1,
    mobile: true
  });

  try {
    let bossExploreTemplate;
    const makeBossExploreState = (currentNodeId) => {
      const state = JSON.parse(JSON.stringify(bossExploreTemplate));
      state.phase = 'explore';
      state.rewardPoints = 850;
      state.lingyun = 1;
      state.player = {
        ...state.player,
        hp: 200,
        maxHp: 200,
        base: { body: 8, spirit: 2, agility: 2, luck: 1 }
      };
      state.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, 'armor_piercing_sword'];
      state.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, armor_piercing_sword: 1 };
      state.equipped = { ...BASIC_EQUIPPED, weapon: 'armor_piercing_sword' };
      state.run = { ...state.run, dungeonId: 'demon_tower_1', currentNodeId, clearedNodeIds: [] };
      state.log = ['boss pointer smoke save'];
      return state;
    };

    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'legacy boss save fresh hub');
    await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '进入副本');
    await waitForPage(cdp, `document.querySelector('.grid-node.current')`, 'legacy boss save fresh demon tower');
    const legacyExploreState = await evaluate(
      cdp,
      `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
    );
    bossExploreTemplate = legacyExploreState;
    legacyExploreState.run.currentNodeId = 'bone_lane_monster';
    legacyExploreState.run.clearedNodeIds = [];
    await injectGameState(cdp, legacyExploreState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('.node-action-panel')?.textContent.includes('进入战斗')`,
      'legacy boss save pre-combat renders'
    );
    await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
    await waitForPage(cdp, `document.querySelector('.combat-panel')`, 'legacy boss save enters combat');
    await evaluate(
      cdp,
      `(() => {
        const raw = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
        delete raw.state.combat.bossPhase;
        raw.state.combat.log = ['legacy boss save without bossPhase'];
        localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(raw));
        return true;
      })()`
    );
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.combat-panel')`, 'legacy boss save without bossPhase renders');
    const legacyBossState = await evaluate(
      cdp,
      `(() => {
        const panel = document.querySelector('.combat-panel');
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
        return {
          panel: panel?.outerHTML.slice(0, 500) ?? '',
          panelText: panel?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
          bodyHasLegacyLog: document.body.textContent.includes('legacy boss save without bossPhase'),
          savedPhase: saved?.state?.phase,
          savedCombat: saved?.state?.combat,
          savedRun: saved?.state?.run
        };
      })()`
    );
    if (
      !legacyBossState.panelText.includes('雾塔剔骨监斩官') ||
      !legacyBossState.bodyHasLegacyLog ||
      !legacyBossState.panel.includes('data-boss-phase="sealed"')
    ) {
      throw new Error(`legacy boss save without bossPhase should normalize to sealed: ${JSON.stringify(legacyBossState)}`);
    }

    await injectGameState(cdp, makeBossExploreState('tower_exit'));
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('.grid-node.current')?.textContent.includes('白光裂口') &&
        document.querySelector('.exit-seal-reason')?.textContent.includes('雾塔剔骨监斩官')`,
      'sealed exit renders its boss requirement'
    );
    const sealedExitButton = await getButtonState(cdp, '完成副本');
    if (!sealedExitButton.disabled || !sealedExitButton.text.includes('封印中') || !sealedExitButton.text.includes('雾塔剔骨监斩官')) {
      throw new Error(`Uncleared boss should disable exit settlement with a clear reason: ${JSON.stringify(sealedExitButton)}`);
    }

    await injectGameState(cdp, makeBossExploreState('bone_lane_monster'));
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('.grid-node.current.boss-node[data-boss-node="true"]')?.textContent.includes('首领') &&
        document.querySelector('.boss-seal-progress[data-boss-seal="sealed"]')?.textContent.includes('雾塔剔骨监斩官') &&
        document.querySelector('.node-action-panel')?.textContent.includes('进入战斗')`,
      'boss node and sealed progress render before combat'
    );
    const bossMapState = await evaluate(
      cdp,
      `(() => ({
        bossNodes: document.querySelectorAll('.dungeon-map .boss-node[data-boss-node="true"]').length,
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        sealText: document.querySelector('.boss-seal-progress')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      }))()`
    );
    if (
      bossMapState.bossNodes !== 1 ||
      bossMapState.pageScrollWidth > bossMapState.pageClientWidth + 1 ||
      !bossMapState.sealText.includes('出口封印 0/1')
    ) {
      throw new Error(`390x844 exploration should mark exactly one boss without horizontal overflow: ${JSON.stringify(bossMapState)}`);
    }

    // Every transition below is a CDP pointer event; storage only seeds the reproducible starting position.
    await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
    await waitForPage(cdp, `document.querySelector('.combat-panel[data-boss-phase="sealed"]')`, 'legal boss combat starts sealed');
    const sealedCombat = await evaluate(
      cdp,
      `(() => {
        const panel = document.querySelector('.combat-panel');
        const attack = [...panel.querySelectorAll('button')].find((button) => !button.disabled && button.textContent.includes('攻击'));
        attack.scrollIntoView({ block: 'center', inline: 'nearest' });
        const rect = attack.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          phase: panel.dataset.bossPhase,
          maxHp: panel.dataset.bossMaxHp,
          text: panel.textContent.replace(/\\s+/g, ' ').trim(),
          attackHeight: rect.height,
          attackPointerTarget: Boolean(hit && attack.contains(hit)),
          pageClientWidth: document.documentElement.clientWidth,
          pageScrollWidth: document.documentElement.scrollWidth
        };
      })()`
    );
    if (
      sealedCombat.phase !== 'sealed' ||
      sealedCombat.maxHp !== '83' ||
      !sealedCombat.text.includes('雾塔剔骨监斩官') ||
      !sealedCombat.text.includes('封印阶段') ||
      !sealedCombat.text.includes('强化生命 83') ||
      !sealedCombat.text.includes('83/83') ||
      !sealedCombat.text.includes('剔骨塔卒') ||
      sealedCombat.attackHeight < 41.5 ||
      !sealedCombat.attackPointerTarget ||
      sealedCombat.pageScrollWidth > sealedCombat.pageClientWidth + 1
    ) {
      throw new Error(`Boss combat should use the profiled title, sealed phase, and enhanced max HP: ${JSON.stringify(sealedCombat)}`);
    }

    await clickButtonByPointer(cdp, '攻击', '.combat-panel');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.combat?.bossPhase === 'awakened' &&
          saved.combat.monsterHp > 0 &&
          saved.combat.monsterHp <= 41 &&
          document.querySelector('.combat-panel[data-boss-phase="awakened"]')?.textContent.includes('血骨开铡');
      })()`,
      'real first attack triggers half-health awakening'
    );

    // Reload proves the legal awakened value survives save validation and still renders from the Boss profile.
    const awakenedSaveBeforeReload = await evaluate(cdp, `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = raw === null ? null : JSON.parse(raw).state;
      return {
        localStorageExists: raw !== null,
        statePhase: saved?.phase ?? null,
        run: saved?.run ? { dungeonId: saved.run.dungeonId, currentNodeId: saved.run.currentNodeId } : null,
        combat: saved?.combat ? {
          keys: Object.keys(saved.combat),
          bossPhase: saved.combat.bossPhase ?? null,
          monsterHp: saved.combat.monsterHp ?? null,
          effects: saved.combat.effects ?? null
        } : null
      };
    })()`);
    if (
      !awakenedSaveBeforeReload.localStorageExists ||
      awakenedSaveBeforeReload.statePhase !== 'combat' ||
      awakenedSaveBeforeReload.run?.dungeonId !== 'demon_tower_1' ||
      awakenedSaveBeforeReload.run?.currentNodeId !== 'bone_lane_monster' ||
      awakenedSaveBeforeReload.combat?.bossPhase !== 'awakened' ||
      !(awakenedSaveBeforeReload.combat.monsterHp > 0 && awakenedSaveBeforeReload.combat.monsterHp <= 41) ||
      awakenedSaveBeforeReload.combat.effects?.deadAirEcho !== false
    ) {
      throw new Error(`Awakened Boss save should contain the normalized v1 combat snapshot before reload: ${JSON.stringify(awakenedSaveBeforeReload)}`);
    }
    await cdp.send('Page.navigate', { url: appUrl });
    try {
      await waitForPage(
        cdp,
        `document.querySelector('.combat-panel[data-boss-phase="awakened"]')?.textContent.includes('血骨开铡')`,
        'awakened boss save restores'
      );
    } catch (error) {
      const reloadEvidence = await evaluate(cdp, `(() => {
        const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
        let payload;
        let parseError = '';
        try { payload = raw === null ? null : JSON.parse(raw); } catch (error) { parseError = String(error); }
        const saved = payload?.state;
        const panel = document.querySelector('.combat-panel');
        return {
          localStorageExists: raw !== null,
          localStorageLength: raw?.length ?? 0,
          parseError,
          statePhase: saved?.phase ?? null,
          run: saved?.run ? {
            dungeonId: saved.run.dungeonId ?? null,
            currentNodeId: saved.run.currentNodeId ?? null
          } : null,
          combat: saved?.combat ? {
            keys: Object.keys(saved.combat),
            nodeId: saved.combat.nodeId ?? null,
            monsterId: saved.combat.monsterId ?? null,
            bossPhase: saved.combat.bossPhase ?? null,
            monsterHp: saved.combat.monsterHp ?? null,
            effects: saved.combat.effects ?? null
          } : null,
          combatPanel: panel ? {
            bossPhase: panel.dataset.bossPhase ?? null,
            text: panel.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 1200) ?? ''
          } : null,
          documentText: document.body?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 1600) ?? ''
        };
      })()`);
      throw new Error(`${error instanceof Error ? error.message : String(error)}; pre-reload=${JSON.stringify(awakenedSaveBeforeReload)}; reload evidence=${JSON.stringify(reloadEvidence)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
    const mobileAwakenedSkillBefore = await getWeaponSkillControlState(cdp);
    if (
      mobileAwakenedSkillBefore.viewportWidth !== 390 ||
      mobileAwakenedSkillBefore.viewportHeight !== 844 ||
      !mobileAwakenedSkillBefore.exists ||
      !mobileAwakenedSkillBefore.disabled ||
      mobileAwakenedSkillBefore.statusState !== 'charging' ||
      !(mobileAwakenedSkillBefore.weaponFocus >= 0 && mobileAwakenedSkillBefore.weaponFocus < 3) ||
      mobileAwakenedSkillBefore.bossPhase !== 'awakened' ||
      !mobileAwakenedSkillBefore.pointerTarget ||
      mobileAwakenedSkillBefore.buttonHeight < 53.5 ||
      mobileAwakenedSkillBefore.pageScrollWidth > mobileAwakenedSkillBefore.pageClientWidth + 1
    ) {
      throw new Error(`390x844 awakened Boss focus command should fit and remain stable while charging: ${JSON.stringify(mobileAwakenedSkillBefore)}`);
    }
    await finishActiveCombatByAttack(cdp, 'awakened boss focus smoke');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return document.querySelector('.equipment-loot-offer') &&
          document.querySelector('.loot-bag')?.dataset.lootRewardPoints === '370' &&
          saved.run?.lootBag?.rewardPoints === 370 &&
          document.querySelector('.boss-seal-progress[data-boss-seal="cleared"]')?.textContent.includes('出口封印 1/1') &&
          saved.run?.pendingEquipmentOffer?.equipmentIds?.length > 0;
      })()`,
      'real awakened Boss combat flows into victory and equipment offer'
    );
    await assertRouteLocked(cdp, 'boss offer before selection', '先处理当前精英战利品', '选择');

    const victoryState = await evaluate(
      cdp,
      `(() => {
        const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const offer = document.querySelector('.equipment-loot-offer');
        const options = [...document.querySelectorAll('.loot-offer-option')].map((option) => ({
          equipmentId: option.dataset.lootEquipmentId,
          name: compactText(option.querySelector('h3')),
          text: compactText(option),
          hasCore: compactText(option.querySelector('.loot-equipment-core')).length > 0,
          hasPreview: Boolean(option.querySelector('.equipment-swap-preview')),
          hasSelect: Boolean(option.querySelector('button:not(:disabled)'))
        }));
        return {
          pageText: compactText(document.body),
          resourceText: compactText(document.querySelector('.resource-strip')),
          bagText: compactText(document.querySelector('.loot-bag')),
          offerText: compactText(offer),
          options,
          savedRewardPoints: saved.rewardPoints,
          savedBag: saved.run?.lootBag,
          pendingOffer: saved.run?.pendingEquipmentOffer,
          ownedEquipment: saved.ownedEquipment
        };
      })()`
    );
    if (
      victoryState.savedRewardPoints !== 1220 ||
      victoryState.savedBag?.rewardPoints !== 370 ||
      victoryState.options.length < 1 ||
      victoryState.options.length > 3 ||
      !victoryState.resourceText.includes('已入账奖励点 850') ||
      !victoryState.resourceText.includes('袋中 +370') ||
      !victoryState.pageText.includes('剔骨塔卒倒下') ||
      !victoryState.pageText.includes('白骨闭门阵') ||
      !victoryState.bagText.includes('妖骨 x4') ||
      !victoryState.offerText.includes('放弃') ||
      victoryState.options.some(
        (option) =>
          !option.equipmentId ||
          !option.name ||
          !option.hasCore ||
          !option.hasPreview ||
          !option.hasSelect ||
          !option.text.includes('评分') ||
          !option.text.includes('净') ||
          !option.text.includes('2件套') ||
          !option.text.includes('3件精通') ||
          victoryState.ownedEquipment.includes(option.equipmentId)
      )
    ) {
      throw new Error(`Boss victory should expose bonus loot, an opened seal, and complete swap previews: ${JSON.stringify(victoryState)}`);
    }

    await clickButtonByPointer(cdp, '角色', '.topbar');
    await waitForPage(cdp, `document.querySelector('.character-sheet[role="dialog"]')`, 'boss bag inventory sheet opens');
    const baggedInventoryText = await evaluate(
      cdp,
      `document.querySelector('.inventory-chip[data-item-id="demon_bone"]')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`
    );
    if (!baggedInventoryText.includes('妖骨') || !baggedInventoryText.includes('x4') || !baggedInventoryText.includes('其中袋中 x4')) {
      throw new Error(`Run inventory should show current total and its bagged portion, got: ${baggedInventoryText}`);
    }
    await clickDialogButton(cdp, '关闭');
    await waitForPage(cdp, `!document.querySelector('[role="dialog"][aria-modal="true"]')`, 'boss bag inventory sheet closes');

    // Reload before choosing to prove pendingEquipmentOffer survives storage round-trips.
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('.equipment-loot-offer') && document.querySelectorAll('.loot-offer-option').length > 0`,
      'pending boss offer restores after reload'
    );
    await assertRouteLocked(cdp, 'restored boss offer before selection', '先处理当前精英战利品', '选择');

    const mobileOffer = await evaluate(
      cdp,
      `(() => {
        const page = document.documentElement;
        const offer = document.querySelector('.equipment-loot-offer');
        if (!offer) throw new Error('Missing restored elite offer');
        const options = [...offer.querySelectorAll('.loot-offer-option')];
        const buttons = [...offer.querySelectorAll('button')];
        const buttonHits = buttons.map((button) => {
          button.scrollIntoView({ block: 'center', inline: 'nearest' });
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return {
            text: button.textContent.replace(/\\s+/g, ' ').trim(),
            width: rect.width,
            height: rect.height,
            insideViewport: rect.left >= -1 && rect.right <= window.innerWidth + 1 && rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
            pointerTarget: Boolean(hit && button.contains(hit))
          };
        });
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          pageClientWidth: page.clientWidth,
          pageScrollWidth: page.scrollWidth,
          offerClientWidth: offer.clientWidth,
          offerScrollWidth: offer.scrollWidth,
          optionsFit: options.every((option) => option.scrollWidth <= option.clientWidth + 1),
          buttonHits,
          chosenEquipmentId: options[0]?.dataset.lootEquipmentId,
          chosenName: options[0]?.querySelector('h3')?.textContent.trim()
        };
      })()`
    );
    if (
      mobileOffer.viewport.width !== 390 ||
      mobileOffer.viewport.height !== 844 ||
      mobileOffer.pageScrollWidth > mobileOffer.pageClientWidth + 1 ||
      mobileOffer.offerScrollWidth > mobileOffer.offerClientWidth + 1 ||
      !mobileOffer.optionsFit ||
      !mobileOffer.chosenEquipmentId ||
      !mobileOffer.chosenName ||
      mobileOffer.buttonHits.length < 2 ||
      mobileOffer.buttonHits.some((button) => button.height < 43.5 || !button.insideViewport || !button.pointerTarget)
    ) {
      throw new Error(`390x844 boss offer should fit and keep every command pointer-hittable: ${JSON.stringify(mobileOffer)}`);
    }

    await clickCardButtonByPointer(cdp, '.loot-offer-option', mobileOffer.chosenName, '选择');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return !document.querySelector('.equipment-loot-offer') &&
          saved.run?.pendingEquipmentOffer === undefined &&
          saved.run?.lootBag?.equipmentIds?.includes(${JSON.stringify(mobileOffer.chosenEquipmentId)}) &&
          !saved.ownedEquipment.includes(${JSON.stringify(mobileOffer.chosenEquipmentId)});
      })()`,
      'real equipment choice enters bag without ownership'
    );
    await assertRouteUnlocked(cdp, 'boss route after equipment choice');

    await clickGridCell(cdp, '白光裂口');
    await waitForPage(cdp, `document.querySelector('.grid-node.current')?.textContent.includes('白光裂口')`, 'real move to boss-cleared exit');
    const clearedExit = await evaluate(
      cdp,
      `(() => {
        const panel = document.querySelector('.node-action-panel');
        const button = [...panel.querySelectorAll('button')].find((candidate) => candidate.textContent.includes('完成副本'));
        button.scrollIntoView({ block: 'center', inline: 'nearest' });
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          disabled: button.disabled,
          text: button.textContent.replace(/\\s+/g, ' ').trim(),
          hasSealReason: Boolean(panel.querySelector('.exit-seal-reason')),
          sealText: document.querySelector('.boss-seal-progress')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
          pointerTarget: Boolean(hit && button.contains(hit)),
          pageClientWidth: document.documentElement.clientWidth,
          pageScrollWidth: document.documentElement.scrollWidth
        };
      })()`
    );
    if (
      clearedExit.disabled ||
      clearedExit.hasSealReason ||
      !clearedExit.text.includes('返回结算') ||
      !clearedExit.sealText.includes('出口封印 1/1') ||
      !clearedExit.pointerTarget ||
      clearedExit.pageScrollWidth > clearedExit.pageClientWidth + 1
    ) {
      throw new Error(`Boss-cleared exit should be enabled, pointer-hittable, and mobile-safe: ${JSON.stringify(clearedExit)}`);
    }
    await clickButtonByPointer(cdp, '完成副本', '.node-action-panel');
    await waitForPage(
      cdp,
      `document.querySelector('.result-panel') && document.querySelector('.loot-settlement')?.textContent.includes(${JSON.stringify(
        mobileOffer.chosenName
      )})`,
      'real exit settles chosen equipment'
    );

    const settlement = await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const summary = document.querySelector('.loot-settlement');
        return {
          phase: saved.phase,
          owned: saved.ownedEquipment.includes(${JSON.stringify(mobileOffer.chosenEquipmentId)}),
          level: saved.equipmentLevels?.[${JSON.stringify(mobileOffer.chosenEquipmentId)}],
          retained: saved.run?.lastLootSettlement?.retained,
          lost: saved.run?.lastLootSettlement?.lost,
          summaryText: summary?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
          retainedPoints: summary?.querySelector('.settlement-group.retained')?.dataset.settlementRetainedPoints,
          lostPoints: summary?.querySelector('.settlement-group.lost')?.dataset.settlementLostPoints,
          pageClientWidth: document.documentElement.clientWidth,
          pageScrollWidth: document.documentElement.scrollWidth
        };
      })()`
    );
    if (
      settlement.phase !== 'result' ||
      !settlement.owned ||
      settlement.level !== 1 ||
      settlement.retained?.rewardPoints !== 370 ||
      !settlement.retained?.equipmentIds?.includes(mobileOffer.chosenEquipmentId) ||
      settlement.lost?.rewardPoints !== 0 ||
      settlement.lost?.equipmentIds?.length !== 0 ||
      settlement.retainedPoints !== '370' ||
      settlement.lostPoints !== '0' ||
      !settlement.summaryText.includes('已带回') ||
      !settlement.summaryText.includes('已遗失') ||
      !settlement.summaryText.includes('妖骨 x4') ||
      !settlement.summaryText.includes(mobileOffer.chosenName) ||
      settlement.pageScrollWidth > settlement.pageClientWidth + 1
    ) {
      throw new Error(`Exit should bank equipment and render a complete retained/lost summary: ${JSON.stringify(settlement)}`);
    }

    // Reload the result page to verify lastLootSettlement is durable too.
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('.loot-settlement')?.textContent.includes(${JSON.stringify(mobileOffer.chosenName)}) &&
        JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.ownedEquipment.includes(${JSON.stringify(
          mobileOffer.chosenEquipmentId
        )})`,
      'loot settlement restores after reload'
    );
    await clickButtonByPointer(cdp, '返回主神空间', '.result-panel');
    await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'return after boss loot settlement');
    await clickButton(cdp, '重开');
    await waitForPage(
      cdp,
      `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelector('.resource-strip')?.textContent.includes('850')`,
      'restart after boss flow smoke'
    );
    console.log(
      `[smoke] 390x844 real boss entry -> awakening -> kill -> ${mobileOffer.chosenName} choice -> exit settlement is pointer-complete and overflow-free`
    );
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'desktop state after boss flow smoke');
}

async function getEnabledButtonCount(cdp, label) {
  return evaluate(
    cdp,
    `(() => [...document.querySelectorAll('button')].filter((candidate) =>
      !candidate.disabled && candidate.textContent.includes(${JSON.stringify(label)})
    ).length)()`
  );
}

async function getCardButtonState(cdp, selector, cardText, buttonText) {
  return evaluate(
    cdp,
    `(() => {
      const card = [...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(cardText)})
      );
      if (!card) throw new Error('Missing card: ${cardText}');
      const button = [...card.querySelectorAll('button')].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(buttonText)})
      );
      if (!button) throw new Error('Missing ${buttonText} button in ${cardText}');
      return {
        disabled: button.disabled,
        cardText: card.textContent
      };
    })()`
  );
}

async function getCharacterPower(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const text = document.querySelector('.character-trigger')?.textContent.replace(/\\s+/g, ' ').trim() ?? '';
      const match = text.match(/战力\\s*(\\d+)/);
      if (!match) throw new Error('Character trigger is missing a numeric power value: ' + text);
      return Number(match[1]);
    })()`
  );
}

async function getEquipmentDecisionState(cdp, equipmentId) {
  return evaluate(
    cdp,
    `(() => {
      const equipmentId = ${JSON.stringify(equipmentId)};
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const card = document.querySelector('[data-equipment-id="' + equipmentId + '"]');
      if (!card) throw new Error('Missing equipment card: ' + equipmentId);
      const preview = card.querySelector('[data-swap-preview="' + equipmentId + '"]');
      if (!preview) throw new Error('Missing equipment swap preview: ' + equipmentId);
      const weaponSkill = preview.querySelector('.weapon-skill-summary');
      const primaryAction = [...card.querySelectorAll('button')].find((button) =>
        button.dataset.action?.startsWith('buy-equipment-') || button.dataset.action?.startsWith('equip-')
      );
      let savedState;
      const savedValue = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      if (savedValue) savedState = JSON.parse(savedValue).state;
      return {
        cardText: compactText(card),
        routeText: compactText(preview.querySelector('.swap-route')),
        scoreText: compactText(preview.querySelector('.swap-score')),
        metricText: compactText(preview.querySelector('.swap-metrics')),
        statText: compactText(preview.querySelector('.swap-stat-deltas')),
        effectText: compactText(preview.querySelector('.swap-effect-changes')),
        weaponSkillText: compactText(weaponSkill),
        weaponSkillName: weaponSkill?.dataset.weaponSkillName ?? '',
        weaponSkillLevel: weaponSkill?.dataset.weaponSkillLevel ?? '',
        actionNote: compactText(preview.querySelector('.equipment-action-note')),
        scoreDelta: Number(preview.dataset.scoreDelta),
        replacedEquipmentId: preview.dataset.replacedEquipmentId,
        primaryActionText: compactText(primaryAction),
        primaryActionDisabled: Boolean(primaryAction?.disabled),
        savedOwned: Boolean(savedState?.ownedEquipment?.includes(equipmentId)),
        savedEquipped: savedState?.equipped ?? null
      };
    })()`
  );
}

async function assertEquipmentPreviewFitsMobile(cdp, appUrl) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    screenWidth: 390,
    screenHeight: 844,
    deviceScaleFactor: 1,
    mobile: true
  });

  try {
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('[data-swap-preview="armor_piercing_sword"]')`, '390px equipment swap preview');
    const layout = await evaluate(
      cdp,
      `(() => {
        const card = document.querySelector('[data-equipment-id="armor_piercing_sword"]');
        const preview = card?.querySelector('[data-swap-preview="armor_piercing_sword"]');
        const weaponSkill = preview?.querySelector('.weapon-skill-summary');
        if (!card || !preview || !weaponSkill) throw new Error('Missing mobile equipment preview or weapon skill summary');
        card.scrollIntoView({ block: 'center', inline: 'nearest' });
        const page = document.documentElement;
        const cardRect = card.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          pageClientWidth: page.clientWidth,
          pageScrollWidth: page.scrollWidth,
          cardClientWidth: card.clientWidth,
          cardScrollWidth: card.scrollWidth,
          previewClientWidth: preview.clientWidth,
          previewScrollWidth: preview.scrollWidth,
          weaponSkillClientWidth: weaponSkill.clientWidth,
          weaponSkillScrollWidth: weaponSkill.scrollWidth,
          weaponSkillText: weaponSkill.textContent.replace(/\\s+/g, ' ').trim(),
          cardInsideViewport: cardRect.left >= -1 && cardRect.right <= window.innerWidth + 1,
          previewInsideCard: previewRect.left >= cardRect.left - 1 && previewRect.right <= cardRect.right + 1
        };
      })()`
    );
    if (
      layout.viewportWidth !== 390 ||
      layout.pageScrollWidth > layout.pageClientWidth + 1 ||
      layout.cardScrollWidth > layout.cardClientWidth + 1 ||
      layout.previewScrollWidth > layout.previewClientWidth + 1 ||
      layout.weaponSkillScrollWidth > layout.weaponSkillClientWidth + 1 ||
      !layout.weaponSkillText.includes('断岳破甲') ||
      !layout.weaponSkillText.includes('战意驱动') ||
      !layout.weaponSkillText.includes('反复充能') ||
      !layout.cardInsideViewport ||
      !layout.previewInsideCard
    ) {
      throw new Error(`390px equipment preview should wrap without horizontal overflow: ${JSON.stringify(layout)}`);
    }
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-swap-preview="armor_piercing_sword"]')`, 'desktop equipment preview after mobile check');
}

async function runEquipmentDecisionSmoke(cdp, appUrl) {
  await assertEquipmentPreviewFitsMobile(cdp, appUrl);

  const initialPower = await getCharacterPower(cdp);
  const initialSword = await getEquipmentDecisionState(cdp, 'armor_piercing_sword');
  if (
    initialSword.replacedEquipmentId !== 'training_blade' ||
    initialSword.scoreDelta <= 0 ||
    !initialSword.routeText.includes('训练短刃 -> 破甲剑') ||
    !initialSword.scoreText.includes(`/ 净 +${initialSword.scoreDelta}`) ||
    !initialSword.metricText.includes('星炉 0 -> 1') ||
    !initialSword.statText.includes('攻 +7') ||
    !initialSword.statText.includes('速 +1') ||
    !initialSword.effectText.includes('2件套无变化') ||
    !initialSword.effectText.includes('3件精通无变化') ||
    initialSword.weaponSkillName !== '断岳破甲' ||
    initialSword.weaponSkillLevel !== '1' ||
    !initialSword.weaponSkillText.includes('进阶战技 · 战意驱动') ||
    !initialSword.weaponSkillText.includes('反复充能') ||
    !initialSword.weaponSkillText.includes('Lv.1 -> Lv.2') ||
    !initialSword.weaponSkillText.includes('降低防御影响') ||
    !initialSword.actionNote.includes('兑换仅加入装备架，不会自动装备') ||
    !initialSword.primaryActionText.includes('兑换入架')
  ) {
    throw new Error(`Initial armor-piercing sword card should show a complete swap preview: ${JSON.stringify(initialSword)}`);
  }

  await clickCardButtonByPointer(cdp, '.equipment-card', '破甲剑', '兑换入架');
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-id="armor_piercing_sword"] button[data-action="equip-armor_piercing_sword"]')`,
    'armor-piercing sword enters equipment rack'
  );
  const purchasedPower = await getCharacterPower(cdp);
  const purchasedSword = await getEquipmentDecisionState(cdp, 'armor_piercing_sword');
  if (
    purchasedPower !== initialPower ||
    !purchasedSword.savedOwned ||
    purchasedSword.savedEquipped?.weapon !== 'training_blade' ||
    purchasedSword.replacedEquipmentId !== 'training_blade' ||
    purchasedSword.scoreDelta !== initialSword.scoreDelta ||
    !purchasedSword.routeText.includes('训练短刃 -> 破甲剑') ||
    !purchasedSword.primaryActionText.includes('装备') ||
    !purchasedSword.actionNote.includes('点击“装备”后才应用以上变化')
  ) {
    throw new Error(
      `Buying armor-piercing sword should only add it to the rack and preserve power ${initialPower}: ${JSON.stringify(purchasedSword)}, power=${purchasedPower}`
    );
  }

  await clickCardButtonByPointer(cdp, '.equipment-card', '破甲剑', '装备');
  await waitForPage(
    cdp,
    `document.querySelector('[data-swap-preview="armor_piercing_sword"]')?.dataset.replacedEquipmentId === 'armor_piercing_sword' &&
      document.querySelector('[data-swap-preview="armor_piercing_sword"]')?.dataset.scoreDelta === '0'`,
    'armor-piercing sword equip updates preview'
  );
  const equippedPower = await getCharacterPower(cdp);
  const equippedSword = await getEquipmentDecisionState(cdp, 'armor_piercing_sword');
  if (
    equippedPower <= initialPower ||
    equippedSword.savedEquipped?.weapon !== 'armor_piercing_sword' ||
    equippedSword.replacedEquipmentId !== 'armor_piercing_sword' ||
    equippedSword.scoreDelta !== 0 ||
    !equippedSword.routeText.includes('破甲剑 -> 破甲剑') ||
    !equippedSword.scoreText.includes('/ 净 持平') ||
    equippedSword.statText !== '净属性持平' ||
    !equippedSword.primaryActionDisabled
  ) {
    throw new Error(
      `Equipping armor-piercing sword should change power and collapse its preview to a no-op: ${JSON.stringify(equippedSword)}, before=${initialPower}, after=${equippedPower}`
    );
  }

  const gauntletPreview = await getEquipmentDecisionState(cdp, 'guardian_gauntlets');
  if (
    gauntletPreview.replacedEquipmentId !== 'patched_gloves' ||
    !gauntletPreview.routeText.includes('拼缝护手 -> 界卫臂铠') ||
    !gauntletPreview.metricText.includes('星炉 1 -> 2') ||
    !gauntletPreview.effectText.includes('激活2件套 星炉') ||
    !gauntletPreview.effectText.includes('3件精通无变化')
  ) {
    throw new Error(`Guardian gauntlets should preview the forge two-piece activation: ${JSON.stringify(gauntletPreview)}`);
  }

  await clickCardButtonByPointer(cdp, '.equipment-card', '界卫臂铠', '兑换入架');
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-id="guardian_gauntlets"] button[data-action="equip-guardian_gauntlets"]')`,
    'guardian gauntlets enter equipment rack'
  );
  const gauntletPurchasePower = await getCharacterPower(cdp);
  if (gauntletPurchasePower !== equippedPower) {
    throw new Error(`Buying guardian gauntlets should not change power: before=${equippedPower}, after=${gauntletPurchasePower}`);
  }
  await clickCardButtonByPointer(cdp, '.equipment-card', '界卫臂铠', '装备');
  await waitForPage(
    cdp,
    `document.querySelector('[data-swap-preview="guardian_gauntlets"]')?.dataset.scoreDelta === '0'`,
    'guardian gauntlets equip updates preview'
  );
  const setPower = await getCharacterPower(cdp);
  if (setPower <= equippedPower) {
    throw new Error(`Equipping guardian gauntlets and activating forge two-piece should raise power: before=${equippedPower}, after=${setPower}`);
  }

  const setCharacterSheet = await openCharacterSheet(cdp, 'forge two-piece equipment');
  if (!setCharacterSheet.dialogText.includes('星炉2件套') || !setCharacterSheet.dialogText.includes('暂无3件精通')) {
    throw new Error(`Character equipment summary should show active forge two-piece and no mastery: ${JSON.stringify(setCharacterSheet)}`);
  }
  await clickDialogButton(cdp, '重开');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelector('[data-swap-preview="armor_piercing_sword"]')?.dataset.replacedEquipmentId === 'training_blade' &&
      document.querySelector('.character-trigger')?.textContent.includes('战力 ${initialPower}') &&
      document.querySelector('.resource-strip')?.textContent.includes('850')`,
    'restart after equipment decision smoke'
  );
  console.log(
    `[smoke] equipment preview stays read-only on purchase, updates after equip (${initialPower} -> ${equippedPower}), and exposes forge two-piece at power ${setPower}`
  );
}

async function getFirstScreenStateSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const dungeonCards = [...document.querySelectorAll('.dungeon-card')].map((card) => compactText(card));
      return {
        storageValue: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}),
        resourceText: compactText(document.querySelector('.resource-strip')),
        petRosterText: compactText(document.querySelector('.pet-roster')),
        activePetText: compactText(document.querySelector('.active-pet-card')),
        dungeonCards,
        completedDungeonCards: dungeonCards.filter((text) => text.includes('已完成')).length,
        routePanelText: compactText(document.querySelector('.campaign-route-panel'))
      };
    })()`
  );
}

function makeInventory(overrides = {}) {
  const inventory = Object.fromEntries(ITEM_IDS.map((itemId) => [itemId, overrides[itemId] ?? 0]));
  if (Object.prototype.hasOwnProperty.call(overrides, 'cycle_imprint')) {
    inventory.cycle_imprint = overrides.cycle_imprint;
  }
  return inventory;
}

function makeLootBag({ rewardPoints = 0, lingyun = 0, items = {}, equipmentIds = [] } = {}) {
  return {
    rewardPoints,
    lingyun,
    items,
    equipmentIds
  };
}

function makeDungeonLawState(dungeonId, law, overrides = {}) {
  return {
    rulesVersion: 1,
    dungeonId,
    clearedNodeIds: [],
    resolvedEventIds: [],
    combatOpenings: {},
    combatVictoryNodeIds: [],
    law,
    ...overrides
  };
}

function makeCombatSave({
  dungeonId,
  nodeId,
  monsterId = nodeId,
  monsterHp,
  turn = 1,
  effects,
  bossPhase,
  weaponFocus = 0,
  weaponSkillUsed,
  damageTakenAtStart,
  inventory = {},
  rewardPoints = 1800,
  lingyun = 6,
  player = {},
  ownedEquipment = BASIC_OWNED_EQUIPMENT,
  equipmentLevels = BASIC_EQUIPMENT_LEVELS,
  equipmentAttunements,
  equipmentTemperRanks,
  equipped = BASIC_EQUIPPED,
  learnedMethods = [],
  methodRanks,
  activeMethod,
  methodSnapshot,
  methodTechniqueUsed,
  bloodlineRanks,
  activeBloodline,
  bloodlineSnapshot,
  bloodlineSurgeUsed,
  bloodlineBarrier,
  completedDungeonIds = [],
  claimedTaskIds = [],
  ownedPets = [],
  petLevels = {},
  activePet,
  clearedNodeIds = [],
  lootBag = makeLootBag(),
  lootOffersMade = 0,
  lawState,
  combatLog = ['midgame combat smoke save'],
  log = ['midgame combat smoke save']
}) {
  const state = {
    phase: 'combat',
    rewardPoints,
    lingyun,
    player: {
      hp: 102,
      maxHp: 102,
      base: { body: 3, spirit: 2, agility: 2, luck: 1 },
      ...structuredClone(player)
    },
    inventory: makeInventory(inventory),
    ownedEquipment: [...ownedEquipment],
    equipmentLevels: { ...equipmentLevels },
    equipped: { ...equipped },
    learnedMethods: [...learnedMethods],
    methodRanks: { ...(methodRanks ?? Object.fromEntries(learnedMethods.map((methodId) => [methodId, 1]))) },
    completedDungeonIds: [...completedDungeonIds],
    claimedDirectiveIds: [],
    claimedTaskIds: [...claimedTaskIds],
    ownedPets: [...ownedPets],
    petLevels: { ...petLevels },
    run: {
      dungeonId,
      currentNodeId: nodeId,
      clearedNodeIds: [...clearedNodeIds],
      captures: 0,
      capturedPetIds: [],
      usedItems: [],
      damageTaken: 0,
      resolvedEventIds: [],
      eventLog: [],
      lootBag: structuredClone(lootBag),
      lootOffersMade
    },
    combat: {
      nodeId,
      monsterId,
      monsterHp,
      turn,
      guarding: false,
      weaponFocus,
      log: [...combatLog]
    },
    log: [...log]
  };

  if (activePet) state.activePet = activePet;
  if (activeMethod) state.activeMethod = activeMethod;
  if (methodSnapshot) state.run.methodSnapshot = structuredClone(methodSnapshot);
  if (methodTechniqueUsed !== undefined) state.combat.methodTechniqueUsed = methodTechniqueUsed;
  if (bloodlineRanks) state.bloodlineRanks = { ...bloodlineRanks };
  if (activeBloodline) state.activeBloodline = activeBloodline;
  if (bloodlineSnapshot) state.run.bloodlineSnapshot = structuredClone(bloodlineSnapshot);
  if (bloodlineSurgeUsed !== undefined) state.combat.bloodlineSurgeUsed = bloodlineSurgeUsed;
  if (bloodlineBarrier !== undefined) state.combat.bloodlineBarrier = bloodlineBarrier;
  if (equipmentAttunements) state.equipmentAttunements = { ...equipmentAttunements };
  if (equipmentTemperRanks) state.equipmentTemperRanks = { ...equipmentTemperRanks };
  if (lawState !== undefined) state.run.lawState = structuredClone(lawState);
  if (effects) state.combat.effects = structuredClone(effects);
  if (damageTakenAtStart !== undefined) state.combat.damageTakenAtStart = damageTakenAtStart;
  if (bossPhase !== undefined) state.combat.bossPhase = bossPhase;
  if (weaponSkillUsed !== undefined) state.combat.weaponSkillUsed = weaponSkillUsed;

  return state;
}

function makeExploreSave(options) {
  const state = makeCombatSave({ monsterHp: 1, ...options });
  state.phase = 'explore';
  delete state.combat;
  return state;
}

function makeLostShelterExploreSave({ nodeId = 'shelter_gate', clearedNodeIds = [], ...options } = {}) {
  const state = makeExploreSave({
    dungeonId: 'lost_shelter',
    nodeId,
    clearedNodeIds,
    completedDungeonIds: [...VERDICT_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...VERDICT_PRIOR_MAINLINE_TASK_IDS],
    ...options
  });
  const entryGear = { rescueCarbine: false, triageVisor: false, evacuationPlate: false, blackboxBeacon: false };
  state.run.escortEntryGear = { ...entryGear };
  state.run.lawState = makeDungeonLawState('lost_shelter', {
    kind: 'lost_shelter',
    survivorHp: 100,
    pendingCheckpointNodeId: null,
    resolvedCheckpointChoices: {},
    bossSurvivorSnapshot: null,
    entryGear,
    entryCompanion: { id: null, rank: 0 },
    firstHazardGuardUsed: false,
    companionAnalysisUsed: false,
    companionTriageUsed: false
  }, { clearedNodeIds: [...clearedNodeIds] });
  return state;
}

function makeFalseTestimonyExploreSave({ nodeId = 'verdict_gate', clearedNodeIds = [], ...options } = {}) {
  const state = makeExploreSave({
    dungeonId: 'false_testimony_court',
    nodeId,
    clearedNodeIds,
    completedDungeonIds: [...VERDICT_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...VERDICT_PRIOR_MAINLINE_TASK_IDS],
    ...options
  });
  state.run.lawState = makeDungeonLawState('false_testimony_court', {
    kind: 'false_testimony_court',
    revealedEvidenceIds: [],
    contaminatedEvidenceIds: [],
    pendingVerdictNodeId: null,
    accusedSuspect: null,
    accusationCorrect: null,
    accusationTrustedCount: 0,
    appealUsed: false,
    bossVerdictSnapshot: null,
    entryGear: {
      crossExaminerSabre: false,
      forensicVisor: false,
      custodyShell: false,
      appealSeal: false
    },
    custodyProtectionUsed: false
  }, { clearedNodeIds: [...clearedNodeIds] });
  return state;
}

function makeFalseTestimonyReplayPortalSave(options = {}) {
  const state = makeFalseTestimonyExploreSave({
    ...options,
    completedDungeonIds: [...REPLAY_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...REPLAY_PRIOR_MAINLINE_TASK_IDS]
  });
  if (
    !state.completedDungeonIds.includes('false_testimony_court') ||
    !state.claimedTaskIds.includes('mainline_clear_false_testimony_court')
  ) {
    throw new Error('Tier 17 replay portal fixture must complete and claim the false testimony mainline.');
  }
  return state;
}

function makeCombatReplayExploreSave({
  nodeId = 'stage_gate',
  clearedNodeIds = [],
  recordings = {},
  route,
  bossSnapshot = null,
  entryGear = { frameEngraver: false, cueVisor: false, bufferPlate: false, thawMetronome: false },
  ...options
} = {}) {
  const state = makeExploreSave({
    dungeonId: 'combat_replay_stage',
    nodeId,
    clearedNodeIds,
    completedDungeonIds: [...REPLAY_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...REPLAY_PRIOR_MAINLINE_TASK_IDS],
    ...options
  });
  const takeIds = ['take_alpha', 'take_beta', 'take_gamma'];
  const normalizedRecordings = Object.fromEntries(Object.entries(recordings).map(([takeId, recording]) => [
    takeId,
    {
      action: recording.action,
      observedValue: recording.observedValue,
      replayValue: recording.replayValue ?? (entryGear.frameEngraver ? Math.ceil(recording.observedValue * 1.15) : recording.observedValue)
    }
  ]));
  const takes = takeIds.map((takeId) => normalizedRecordings[takeId] ? { ...normalizedRecordings[takeId] } : null);
  const snapshot = bossSnapshot === true
    ? { takes: takes.map((take) => ({ ...take })), route }
    : bossSnapshot;
  state.run.combatReplayState = {
    rulesVersion: 1,
    recordings: structuredClone(normalizedRecordings),
    entryGear: { ...entryGear },
    ...(route ? { route } : {})
  };
  state.run.lawState = makeDungeonLawState('combat_replay_stage', {
    kind: 'combat_replay_stage',
    takes,
    route: route ?? null,
    bossSnapshot: snapshot ? structuredClone(snapshot) : null,
    entryGear: { ...entryGear }
  }, { clearedNodeIds: [...clearedNodeIds] });
  return state;
}

function makeCombatReplayPanopticonPortalSave(options = {}) {
  const state = makeCombatReplayExploreSave({
    recordings: {
      take_alpha: { action: 'attack', observedValue: 312 },
      take_beta: { action: 'art', observedValue: 286 },
      take_gamma: { action: 'guard', observedValue: 144 }
    },
    route: 'sequence',
    ...options,
    completedDungeonIds: [...PANOPTICON_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...PANOPTICON_PRIOR_MAINLINE_TASK_IDS]
  });
  if (
    !state.completedDungeonIds.includes('combat_replay_stage') ||
    !state.claimedTaskIds.includes('mainline_clear_combat_replay_stage')
  ) {
    throw new Error('Tier 18 panopticon portal fixture must complete and claim the combat replay mainline.');
  }
  return state;
}

function makePanopticonExploreSave({
  nodeId = 'panopticon_gate',
  clearedNodeIds = [],
  scanPhase = 0,
  moveCount = 0,
  exposureCount = 0,
  relays = { north_blind_relay: false, central_blind_relay: false, south_blind_relay: false },
  pendingRouteNodeId = null,
  route = null,
  refractionCharges = 0,
  decoyRewardsGranted = 0,
  bossSnapshot = null,
  entryGear = { blindlineCutter: false, predictiveVisor: false, matteShell: false, inversePrism: false },
  predictiveVisorProtectionUsed = [false, false, false],
  ...options
} = {}) {
  const state = makeExploreSave({
    dungeonId: 'panopticon_city',
    nodeId,
    clearedNodeIds,
    completedDungeonIds: [...PANOPTICON_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...PANOPTICON_PRIOR_MAINLINE_TASK_IDS],
    ...options
  });
  state.run.lawState = makeDungeonLawState('panopticon_city', {
    kind: 'panopticon_city',
    scanPhase,
    moveCount,
    exposureCount,
    relays: { ...relays },
    pendingRouteNodeId,
    route,
    refractionCharges,
    decoyRewardsGranted,
    bossSnapshot: bossSnapshot === true && route
      ? { route, exposureCount, refractionCharges }
      : structuredClone(bossSnapshot),
    entryGear: { ...entryGear },
    predictiveVisorProtectionUsed: [...predictiveVisorProtectionUsed]
  }, { clearedNodeIds: [...clearedNodeIds] });
  return state;
}

function makeCompanionHubSave() {
  const state = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    rewardPoints: 5000,
    lingyun: 10,
    inventory: { demon_bone: 10, method_page: 10, medicine_ash: 10 },
    completedDungeonIds: ['demon_tower_1', 'rust_hospital', 'dream_archive'],
    log: ['companion pointer smoke save']
  });
  state.phase = 'hub';
  state.ownedCompanions = [];
  state.companionRanks = {};
  delete state.run;
  return state;
}

function makeMethodHubSave() {
  const state = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    rewardPoints: 10000,
    lingyun: 20,
    inventory: { method_page: 20, healing_pill: 20, dispel_talisman: 10, gate_sigil: 10 },
    learnedMethods: ['iron_body'],
    methodRanks: { iron_body: 1 },
    log: ['method cultivation pointer smoke save']
  });
  state.phase = 'hub';
  delete state.activeMethod;
  delete state.run;
  return state;
}

function makeCausalExploreSave({
  nodeId = 'clearinghouse_gate',
  debt = 0,
  pendingLedgerNodeId = null,
  settledLedgerNodeIds = [],
  bossDebtLocked = false,
  collectionSeals = 0,
  entryPassives = { causalVisor: false, echoBreakerGauntlets: false, returnAnchorBelt: false },
  visorCreditUsed = false,
  clearedNodeIds = [],
  ...options
} = {}) {
  const state = makeExploreSave({
    dungeonId: 'causal_clearinghouse',
    nodeId,
    clearedNodeIds,
    ...options
  });
  state.run.lawState = makeDungeonLawState(
    'causal_clearinghouse',
    {
      kind: 'causal_clearinghouse',
      debt,
      pendingLedgerNodeId,
      settledLedgerNodeIds,
      bossDebtLocked,
      collectionSeals,
      entryPassives,
      visorCreditUsed
    },
    { clearedNodeIds }
  );
  return state;
}

function makeEntropyExploreSave({
  nodeId = 'ark_gate',
  entropy = 2,
  pendingHeadingNodeId = null,
  resolvedHeadingChoices = {},
  bossEntropyLocked = false,
  collapseLayers = 0,
  entryPassives = { entropyCompass: false, dissipationMantle: false, arkKeelBoots: false },
  compassCreditUsed = false,
  clearedNodeIds = [],
  ...options
} = {}) {
  const state = makeExploreSave({
    dungeonId: 'entropy_ark',
    nodeId,
    clearedNodeIds,
    ...options
  });
  state.run.lawState = makeDungeonLawState(
    'entropy_ark',
    {
      kind: 'entropy_ark',
      entropy,
      pendingHeadingNodeId,
      resolvedHeadingChoices,
      bossEntropyLocked,
      collapseLayers,
      entryPassives,
      compassCreditUsed
    },
    { clearedNodeIds }
  );
  return state;
}

async function injectGameState(cdp, state) {
  const serialized = JSON.stringify({ version: 1, state });
  await evaluate(
    cdp,
    `(() => {
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(serialized)});
      return true;
    })()`
  );
}

async function injectCombatSave(cdp, appUrl, options) {
  await injectGameState(cdp, makeCombatSave(options));
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.combat-panel')?.textContent.includes(${JSON.stringify(options.expectedText ?? '')})`,
    `${options.label ?? options.monsterId ?? options.nodeId} combat save renders`
  );
}

async function getButtonState(cdp, label) {
  return evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent.includes(${JSON.stringify(label)})
      );
      if (!button) throw new Error('Missing button: ${label}');
      return {
        disabled: button.disabled,
        text: button.textContent.replace(/\\s+/g, ' ').trim()
      };
    })()`
  );
}

async function assertPageIncludes(cdp, expectedLines, label) {
  const bodyText = await evaluate(cdp, `document.body.textContent.replace(/\\s+/g, ' ').trim()`);
  const missing = expectedLines.filter((line) => !bodyText.includes(line));
  if (missing.length > 0) {
    throw new Error(`${label} page text missing ${JSON.stringify(missing)} in: ${bodyText}`);
  }
}

async function assertCombatLogIncludes(cdp, expectedLines, label) {
  const logText = await evaluate(cdp, `document.querySelector('.combat-log')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`);
  const missing = expectedLines.filter((line) => !logText.includes(line));
  if (missing.length > 0) {
    throw new Error(`${label} combat log missing ${JSON.stringify(missing)} in: ${logText}`);
  }
}

async function assertCombatLogExcludes(cdp, unexpectedLines, label) {
  const logText = await evaluate(cdp, `document.querySelector('.combat-log')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`);
  const present = unexpectedLines.filter((line) => logText.includes(line));
  if (present.length > 0) {
    throw new Error(`${label} combat log unexpectedly included ${JSON.stringify(present)} in: ${logText}`);
  }
}

async function injectBadEquipmentLevelSave(cdp) {
  await injectGameState(cdp, {
    phase: 'hub',
    rewardPoints: 777,
    lingyun: 1,
    player: {
      hp: 92,
      maxHp: 92,
      base: { body: 3, spirit: 2, agility: 2, luck: 1 }
    },
    inventory: makeInventory(),
    ownedEquipment: BASIC_OWNED_EQUIPMENT,
    equipmentLevels: {
      training_blade: 99,
      patched_headwrap: 1,
      patched_coat: 1,
      patched_gloves: 1,
      patched_boots: 1,
      patched_belt: 1,
      plain_charm: 1
    },
    equipped: BASIC_EQUIPPED,
    learnedMethods: [],
    methodRanks: {},
    completedDungeonIds: [],
    claimedDirectiveIds: [],
    claimedTaskIds: [],
    ownedPets: [],
    petLevels: {},
    log: ['bad equipment level smoke save']
  });
}

async function injectUnownedEquipmentLevelSave(cdp) {
  await injectGameState(cdp, {
    phase: 'hub',
    rewardPoints: 777,
    lingyun: 1,
    player: {
      hp: 92,
      maxHp: 92,
      base: { body: 3, spirit: 2, agility: 2, luck: 1 }
    },
    inventory: makeInventory(),
    ownedEquipment: BASIC_OWNED_EQUIPMENT,
    equipmentLevels: {
      ...BASIC_EQUIPMENT_LEVELS,
      starforged_edge: 3
    },
    equipped: BASIC_EQUIPPED,
    learnedMethods: [],
    methodRanks: {},
    completedDungeonIds: [],
    claimedDirectiveIds: [],
    claimedTaskIds: [],
    ownedPets: [],
    petLevels: {},
    log: ['unowned equipment level smoke save']
  });
}

async function injectLegacyTaskSave(cdp) {
  const inventory = makeInventory();
  delete inventory.chronal_glass;
  delete inventory.phase_glass;
  delete inventory.redaction_ink;
  delete inventory.legacy_scrip;
  await injectGameState(cdp, {
    phase: 'hub',
    rewardPoints: 777,
    lingyun: 1,
    player: {
      hp: 92,
      maxHp: 92,
      base: { body: 3, spirit: 2, agility: 2, luck: 1 }
    },
    inventory,
    ownedEquipment: Object.keys(LEGACY_EQUIPMENT_LEVELS),
    equipmentLevels: LEGACY_EQUIPMENT_LEVELS,
    equipped: LEGACY_EQUIPPED,
    learnedMethods: [],
    completedDungeonIds: [],
    claimedDirectiveIds: [],
    ownedPets: [],
    petLevels: {},
    log: ['legacy task save without claimedTaskIds']
  });
}

async function injectLegacyRunSave(cdp) {
  const state = makeCombatSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    monsterHp: 42,
    rewardPoints: 777,
    lingyun: 2,
    combatLog: ['legacy run smoke save'],
    log: ['legacy run smoke save']
  });
  state.phase = 'explore';
  delete state.combat;
  delete state.inventory.cycle_imprint;
  delete state.inventory.redaction_ink;
  delete state.inventory.legacy_scrip;
  delete state.equipmentAttunements;
  delete state.run.lootBag;
  delete state.run.lootOffersMade;
  delete state.run.protocol;

  await injectGameState(cdp, state);
}

async function injectBadRunLootSave(cdp) {
  const state = makeCombatSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    monsterHp: 42,
    rewardPoints: 777,
    lootBag: makeLootBag({ equipmentIds: ['not_real_equipment'] }),
    combatLog: ['bad run loot smoke save'],
    log: ['bad run loot smoke save']
  });
  state.phase = 'explore';
  delete state.combat;

  await injectGameState(cdp, state);
}

async function runLegacyRunMigrationSmoke(cdp, appUrl) {
  await injectLegacyRunSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.readyState === 'complete' && document.querySelector('.shell')`, 'legacy run reload shell renders');
  const migrated = await evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const savedState = raw ? JSON.parse(raw).state : null;
      const lootBag = document.querySelector('.loot-bag');
      return {
        hasSavedKey: Boolean(raw),
        savedState,
        bodyText: document.body.textContent.replace(/\\s+/g, ' ').trim(),
        lootBagExists: Boolean(lootBag),
        lootRewardPoints: lootBag?.dataset.lootRewardPoints,
        lootLingyun: lootBag?.dataset.lootLingyun,
        lawStatusText: document.querySelector('.dungeon-law-status')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        lawLandmarkCount: document.querySelectorAll('[data-law-landmark="true"] .law-landmark-mark').length,
        runTacticalMode: document.querySelector('[data-run-tactical-loadout]')?.dataset.runTacticalLoadout ?? '',
        runTacticalText: document.querySelector('[data-run-tactical-loadout]')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        lootBagText: lootBag?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        resourceText: document.querySelector('.resource-strip')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        dungeonCardCount: document.querySelectorAll('.dungeon-card').length
      };
    })()`
  );
  const savedRun = migrated.savedState?.run;
  if (
    !migrated.hasSavedKey ||
    !migrated.bodyText.includes('legacy run smoke save') ||
    migrated.savedState?.phase !== 'explore' ||
    migrated.savedState?.rewardPoints !== 777 ||
    savedRun?.currentNodeId !== 'fog_lesser_demon' ||
    !migrated.lootBagExists ||
    migrated.lootRewardPoints !== '0' ||
    migrated.lootLingyun !== '0' ||
    !migrated.lootBagText.includes('通关 100%') ||
    !migrated.resourceText.includes('已入账奖励点') ||
    savedRun?.lootOffersMade !== 0 ||
    savedRun?.lootBag?.rewardPoints !== 0 ||
    savedRun?.lootBag?.lingyun !== 0 ||
    Object.keys(savedRun?.lootBag?.items ?? {}).length !== 0 ||
    !Array.isArray(savedRun?.lootBag?.equipmentIds) ||
    savedRun.lootBag.equipmentIds.length !== 0 ||
    savedRun?.protocol?.id !== 'standard' ||
    savedRun?.protocol?.rulesVersion !== 1 ||
    savedRun?.lawState?.rulesVersion !== 1 ||
    savedRun?.lawState?.dungeonId !== 'demon_tower_1' ||
    savedRun?.lawState?.law?.kind !== 'demon_tower' ||
    savedRun?.lawState?.law?.fogPressure !== 0 ||
    JSON.stringify(migrated.savedState?.preparedItemIds) !== JSON.stringify(DEFAULT_PREPARED_TACTICAL_ITEM_IDS) ||
    Object.prototype.hasOwnProperty.call(savedRun ?? {}, 'tacticalLoadout') ||
    migrated.runTacticalMode !== 'legacy-unrestricted' ||
    !migrated.runTacticalText.includes('旧档本轮不限携行') ||
    !Array.isArray(savedRun?.lawState?.clearedNodeIds) ||
    savedRun.lawState.clearedNodeIds.length !== 0 ||
    !migrated.lawStatusText.includes('场域法则') ||
    !migrated.lawStatusText.includes('妖雾压境') ||
    migrated.lawLandmarkCount < 2 ||
    migrated.savedState?.inventory?.cycle_imprint !== 0 ||
    migrated.savedState?.inventory?.redaction_ink !== 0 ||
    migrated.savedState?.inventory?.legacy_scrip !== 0 ||
    Object.keys(migrated.savedState?.equipmentAttunements ?? {}).length !== 0 ||
    Object.keys(migrated.savedState?.equipmentTemperRanks ?? {}).length !== 0
  ) {
    throw new Error(
      `Legacy run should migrate in place instead of resetting; savedState and DOM snapshot: ${JSON.stringify(migrated)}`
    );
  }

  await clickButton(cdp, '重开');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'restart after legacy run migration'
  );
  console.log('[smoke] legacy version-1 run restores default hub preparation while keeping this run explicitly unrestricted');
}

async function runBadRunLootRecoverySmoke(cdp, appUrl) {
  await injectBadRunLootSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'bad run loot save falls back');
  const recovery = await evaluate(
    cdp,
    `(() => ({
      hasSavedKey: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null,
      resourceText: document.querySelector('.resource-strip')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      bodyText: document.body.textContent
    }))()`
  );
  if (
    recovery.hasSavedKey ||
    !recovery.resourceText.includes('850') ||
    recovery.resourceText.includes('777') ||
    recovery.bodyText.includes('bad run loot smoke save')
  ) {
    throw new Error(`Invalid run loot IDs should clear storage and restore the initial state: ${JSON.stringify(recovery)}`);
  }
  console.log('[smoke] invalid run loot equipment ID resets to the initial state and clears storage');
}

function makeProtocolHubSave() {
  const state = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    rewardPoints: 5000,
    lingyun: 10,
    inventory: {
      healing_pill: 30,
      thunder_talisman: 10,
      dispel_talisman: 10,
      gate_sigil: 5,
      cycle_imprint: 0
    },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped: ADVANCED_EQUIPPED,
    completedDungeonIds: ['demon_tower_1'],
    log: ['protocol and attunement pointer smoke save']
  });
  state.phase = 'hub';
  state.equipmentAttunements = {};
  delete state.run;
  return state;
}

function makeDeepProtocolHubSave() {
  const state = makeProtocolHubSave();
  state.inventory.cycle_imprint = 1;
  state.log = ['deep protocol pointer smoke save'];
  return state;
}

function makeTemporalObservatoryHubSave() {
  const state = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    rewardPoints: 9000,
    lingyun: 50,
    inventory: {
      healing_pill: 20,
      thunder_talisman: 20,
      dispel_talisman: 20,
      gate_sigil: 20,
      armor_patch: 20,
      focus_incense: 20,
      chronal_glass: 12,
      cycle_imprint: 0
    },
    player: {
      hp: 2000,
      maxHp: 2000,
      base: { body: 70, spirit: 70, agility: 70, luck: 20 }
    },
    ownedEquipment: [...BASIC_OWNED_EQUIPMENT, ...CHRONAL_EQUIPMENT_IDS],
    equipmentLevels: { ...BASIC_EQUIPMENT_LEVELS, ...CHRONAL_EQUIPMENT_LEVELS },
    equipmentAttunements: CHRONAL_ATTUNEMENTS,
    equipmentTemperRanks: CHRONAL_TEMPER_RANKS,
    equipped: {
      ...BASIC_EQUIPPED,
      weapon: 'chronal_edge',
      armor: 'chronal_aegis',
      charm: 'chronal_lens'
    },
    learnedMethods: ['mist_breathing', 'iron_body', 'cloud_step', 'gate_sense', 'star_core_method', 'beast_taming', 'void_heart'],
    completedDungeonIds: TEMPORAL_PRIOR_DUNGEON_IDS,
    log: ['temporal observatory pointer smoke save']
  });
  state.phase = 'hub';
  state.claimedTaskIds = [...TEMPORAL_PRIOR_MAINLINE_TASK_IDS];
  state.preparedItemIds = ['focus_incense', 'dispel_talisman', 'healing_pill'];
  delete state.run;
  return state;
}

function makeEquipmentCommissionHubSave(baseState, { nearComplete = false } = {}) {
  const state = structuredClone(baseState);
  state.phase = 'hub';
  state.rewardPoints = EQUIPMENT_COMMISSION_START_RESOURCES.rewardPoints;
  state.lingyun = EQUIPMENT_COMMISSION_START_RESOURCES.lingyun;
  state.inventory.healing_pill = 30;
  state.inventory.thunder_talisman = 10;
  state.inventory.dispel_talisman = 10;
  state.inventory.gate_sigil = 5;
  state.inventory[EQUIPMENT_COMMISSION_MATERIAL_ID] = EQUIPMENT_COMMISSION_START_RESOURCES.material;
  state.ownedEquipment = [...new Set([...state.ownedEquipment, ...EQUIPMENT_COMMISSION_EQUIPMENT_IDS])];
  state.equipmentLevels = {
    ...state.equipmentLevels,
    [EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]]: 3,
    [EQUIPMENT_COMMISSION_EQUIPMENT_IDS[1]]: 3
  };
  state.completedDungeonIds = nearComplete ? [...EQUIPMENT_COMMISSION_PRIOR_DUNGEON_IDS] : [];
  state.claimedDirectiveIds = [];
  state.claimedTaskIds = [];
  state.log = [nearComplete ? 'near-complete equipment commission smoke save' : 'equipment commission pointer smoke save'];
  delete state.run;
  delete state.combat;
  delete state.lastOutcome;
  delete state.equipmentCommission;

  if (nearComplete) {
    state.equipmentCommission = {
      rulesVersion: 1,
      equipmentIds: [...EQUIPMENT_COMMISSION_EQUIPMENT_IDS],
      targetMaterialId: EQUIPMENT_COMMISSION_MATERIAL_ID,
      completedDungeonIds: [...EQUIPMENT_COMMISSION_PRIOR_DUNGEON_IDS]
    };
  }

  return state;
}

async function assertInjectedSaveResets(cdp, appUrl, state, marker, label) {
  await injectGameState(cdp, state);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, `${label} fallback renders`);
  const recovery = await evaluate(
    cdp,
    `(() => ({
      hasSavedKey: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null,
      resources: document.querySelector('.resource-strip')?.textContent ?? '',
      body: document.body.textContent
    }))()`
  );
  if (recovery.hasSavedKey || !recovery.resources.includes('850') || recovery.body.includes(marker)) {
    throw new Error(`${label} should clear storage and restore initial state: ${JSON.stringify(recovery)}`);
  }
}

async function runProtocolAndAttunementSaveValidationSmoke(cdp, appUrl) {
  const badProtocol = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    completedDungeonIds: ['demon_tower_1'],
    log: ['bad protocol smoke save']
  });
  badProtocol.run.protocol = { id: 'imprint', rulesVersion: 2 };
  await assertInjectedSaveResets(cdp, appUrl, badProtocol, 'bad protocol smoke save', 'bad protocol');

  const badAttunement = makeProtocolHubSave();
  badAttunement.log = ['bad attunement smoke save'];
  badAttunement.equipmentAttunements = { starforged_edge: 'mist_vanguard' };
  await assertInjectedSaveResets(cdp, appUrl, badAttunement, 'bad attunement smoke save', 'bad attunement');
  console.log('[smoke] wrong protocol rulesVersion and cross-set equipment attunement are rejected');
}

async function runDungeonLawSaveValidationSmoke(cdp, appUrl) {
  const validLawState = makeDungeonLawState(
    'demon_tower_1',
    { kind: 'demon_tower', fogPressure: 2 },
    {
      clearedNodeIds: ['fog_lesser_demon'],
      resolvedEventIds: ['blood_rune_stair'],
      combatOpenings: { fog_lesser_demon: { isBoss: false, style: 'guard' } },
      combatVictoryNodeIds: ['fog_lesser_demon']
    }
  );
  const validLawSave = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'sealed_cache',
    lawState: validLawState,
    clearedNodeIds: ['fog_lesser_demon'],
    log: ['valid dungeon law roundtrip smoke save']
  });
  await injectGameState(cdp, validLawSave);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-law-status')?.textContent.includes('雾压 2/3')`,
    'valid dungeon law renders after load'
  );
  const firstRoundtrip = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState`
  );
  if (JSON.stringify(firstRoundtrip) !== JSON.stringify(validLawState)) {
    throw new Error(`Valid dungeon law should survive its first JSON load: ${JSON.stringify(firstRoundtrip)}`);
  }
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.dungeon-law-status')`, 'valid dungeon law second reload renders');
  const secondRoundtrip = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState`
  );
  if (JSON.stringify(secondRoundtrip) !== JSON.stringify(validLawState)) {
    throw new Error(`Valid dungeon law should survive a second JSON load unchanged: ${JSON.stringify(secondRoundtrip)}`);
  }

  const malformedLawSave = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    lawState: {
      rulesVersion: 99,
      dungeonId: 'void_citadel',
      clearedNodeIds: ['fog_lesser_demon', '', 17, 'fog_lesser_demon'],
      resolvedEventIds: 'not-an-array',
      combatOpenings: {
        fog_lesser_demon: { isBoss: 'yes', style: 'unknown' },
        malformed: null
      },
      combatVictoryNodeIds: [null, 'fog_lesser_demon'],
      law: { kind: 'void_citadel', fogPressure: 99, sealedFeatures: ['attack', 'method'] }
    },
    log: ['malformed dungeon law normalization smoke save']
  });
  await injectGameState(cdp, malformedLawSave);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-law-status')?.textContent.includes('雾压 3/3') &&
      document.querySelector('.dungeon-law-status')?.textContent.includes('敌方全属性 +20%')`,
    'malformed dungeon law normalizes without a blank page'
  );
  const normalizedMalformed = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        phase: saved.phase,
        lawState: saved.run.lawState,
        shell: Boolean(document.querySelector('.shell')),
        marker: document.body.textContent.includes('malformed dungeon law normalization smoke save')
      };
    })()`
  );
  if (
    normalizedMalformed.phase !== 'explore' ||
    !normalizedMalformed.shell ||
    !normalizedMalformed.marker ||
    normalizedMalformed.lawState?.rulesVersion !== 1 ||
    normalizedMalformed.lawState?.dungeonId !== 'demon_tower_1' ||
    normalizedMalformed.lawState?.law?.kind !== 'demon_tower' ||
    normalizedMalformed.lawState?.law?.fogPressure !== 3 ||
    normalizedMalformed.lawState?.resolvedEventIds?.length !== 0 ||
    normalizedMalformed.lawState?.combatOpenings?.fog_lesser_demon?.style !== null
  ) {
    throw new Error(`Malformed dungeon law should be normalized in place: ${JSON.stringify(normalizedMalformed)}`);
  }

  const validEffects = {
    rustPoisonStacks: 3,
    armorCracked: true,
    lastShiftTurn: 4,
    revivedOnce: true,
    echoCopiedStat: 'artPower',
    echoCopiedValue: 24,
    lastPlayerAction: 'guard',
    breathStacks: 3,
    mirrorSlowStacks: 2,
    railHeavyDodgeUsed: true,
    frequencyLockAction: 'art',
    broadcastWardKind: 'talisman',
    deadAirEcho: false
  };
  const validCombat = makeCombatSave({
    dungeonId: 'starfall_mine',
    nodeId: 'spark_imp_roost',
    monsterId: 'spark_imp',
    monsterHp: 38,
    turn: 3,
    effects: validEffects,
    damageTakenAtStart: 17,
    lawState: makeDungeonLawState('starfall_mine', { kind: 'starfall_mine', gravity: 'downward' }),
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    log: ['valid optional combat state smoke save']
  });
  await injectGameState(cdp, validCombat);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-combat-intent="spark-burst"]')`, 'valid optional combat fields render');
  const validCombatRoundtrip = await evaluate(
    cdp,
    `(() => {
      const combat = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat;
      return { damageTakenAtStart: combat.damageTakenAtStart, effects: combat.effects };
    })()`
  );
  if (
    validCombatRoundtrip.damageTakenAtStart !== 17 ||
    JSON.stringify(validCombatRoundtrip.effects) !== JSON.stringify(validEffects)
  ) {
    throw new Error(`Valid optional combat fields should survive JSON load: ${JSON.stringify(validCombatRoundtrip)}`);
  }

  const badEffects = makeCombatSave({
    dungeonId: 'starfall_mine',
    nodeId: 'spark_imp_roost',
    monsterId: 'spark_imp',
    monsterHp: 38,
    effects: { ...validEffects, breathStacks: 4 },
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    log: ['bad optional combat effects smoke save']
  });
  await assertInjectedSaveResets(
    cdp,
    appUrl,
    badEffects,
    'bad optional combat effects smoke save',
    'out-of-range optional combat effects'
  );

  const malformedBroadcastEffects = makeCombatSave({
    dungeonId: 'starfall_mine',
    nodeId: 'spark_imp_roost',
    monsterId: 'spark_imp',
    monsterHp: 38,
    effects: { ...validEffects, frequencyLockAction: ['attack'] },
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    log: ['malformed broadcast combat effects smoke save']
  });
  await assertInjectedSaveResets(
    cdp,
    appUrl,
    malformedBroadcastEffects,
    'malformed broadcast combat effects smoke save',
    'non-string broadcast combat effect enum'
  );

  const badDamageStart = makeCombatSave({
    dungeonId: 'starfall_mine',
    nodeId: 'spark_imp_roost',
    monsterId: 'spark_imp',
    monsterHp: 38,
    damageTakenAtStart: -1,
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    log: ['bad optional combat damage start smoke save']
  });
  await assertInjectedSaveResets(
    cdp,
    appUrl,
    badDamageStart,
    'bad optional combat damage start smoke save',
    'negative optional combat damage baseline'
  );
  console.log('[smoke] law JSON roundtrip, pure malformed-law normalization, and optional combat field validation pass');
}

async function runTacticalLoadoutSaveValidationSmoke(cdp, appUrl) {
  const legacyHub = makeProtocolHubSave();
  legacyHub.log = ['legacy hub without preparedItemIds'];
  delete legacyHub.preparedItemIds;
  await injectGameState(cdp, legacyHub);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const selected = [...document.querySelectorAll('[data-tactical-item][data-selected="true"]')]
        .map((item) => item.dataset.tacticalItem);
      return JSON.stringify(saved.preparedItemIds) === JSON.stringify(${JSON.stringify(DEFAULT_PREPARED_TACTICAL_ITEM_IDS)}) &&
        selected.join(',') === 'healing_pill,dispel_talisman,gate_sigil';
    })()`,
    'legacy hub tactical preparation migration'
  );
  const migratedHub = await evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      return {
        raw,
        preparedItemIds: raw ? JSON.parse(raw).state.preparedItemIds : null,
        marker: document.body.textContent.includes('legacy hub without preparedItemIds')
      };
    })()`
  );
  if (
    !migratedHub.raw ||
    !migratedHub.marker ||
    JSON.stringify(migratedHub.preparedItemIds) !== JSON.stringify(DEFAULT_PREPARED_TACTICAL_ITEM_IDS)
  ) {
    throw new Error(`Legacy hub should re-save the default tactical preparation: ${JSON.stringify(migratedHub)}`);
  }

  const invalidPreparedCases = [
    { label: 'duplicate prepared tactical IDs', itemIds: ['healing_pill', 'healing_pill'] },
    { label: 'material in prepared tactical IDs', itemIds: ['healing_pill', 'demon_bone'] },
    { label: 'unknown prepared tactical ID', itemIds: ['healing_pill', 'unknown_tactical_item'] }
  ];
  for (const testCase of invalidPreparedCases) {
    const invalidHub = makeProtocolHubSave();
    invalidHub.preparedItemIds = testCase.itemIds;
    invalidHub.log = [testCase.label];
    await assertInjectedSaveResets(cdp, appUrl, invalidHub, testCase.label, testCase.label);
  }

  const invalidSnapshotCases = [
    {
      label: 'bad tactical snapshot rulesVersion',
      snapshot: { rulesVersion: 2, itemIds: ['dispel_talisman'] }
    },
    {
      label: 'bad tactical snapshot itemIds',
      snapshot: { rulesVersion: 1, itemIds: ['dispel_talisman', 'dispel_talisman', 'demon_bone', 'unknown_tactical_item'] }
    }
  ];
  for (const testCase of invalidSnapshotCases) {
    const invalidRun = makeExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'blood_rune_trap',
      log: [testCase.label]
    });
    invalidRun.preparedItemIds = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS];
    invalidRun.run.tacticalLoadout = testCase.snapshot;
    await assertInjectedSaveResets(cdp, appUrl, invalidRun, testCase.label, testCase.label);
  }

  console.log('[smoke] tactical save migration preserves legacy unrestricted runs and rejects malformed preparation/snapshots');
}

async function runTacticalLoadoutPointerSmoke(cdp, appUrl) {
  const expectedFive = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS, 'capture_net', 'echo_coin'];
  const expectedFour = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS, 'capture_net'];
  const tacticalStock = Object.fromEntries(TACTICAL_ITEM_IDS.map((itemId, index) => [itemId, index + 2]));
  const hubState = makeProtocolHubSave();
  hubState.completedDungeonIds = [];
  hubState.claimedTaskIds = [];
  hubState.inventory = makeInventory(tacticalStock);
  hubState.preparedItemIds = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS];
  hubState.log = ['tactical loadout pointer smoke save'];

  const readPreparation = () =>
    evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const itemStates = Object.fromEntries(
          [...document.querySelectorAll('[data-tactical-item]')].map((item) => [
            item.dataset.tacticalItem,
            {
              selected: item.dataset.selected === 'true',
              stock: Number(item.dataset.stock),
              disabled: item.disabled,
              text: item.textContent.replace(/\\s+/g, ' ').trim()
            }
          ])
        );
        const slots = Object.fromEntries(
          [...document.querySelectorAll('[data-tactical-slot]')].map((slot) => [
            slot.dataset.tacticalSlot,
            {
              category: slot.dataset.slotCategory ?? '',
              assignedItem: slot.dataset.assignedItem ?? '',
              text: slot.textContent.replace(/\\s+/g, ' ').trim()
            }
          ])
        );
        const panel = document.querySelector('.tactical-loadout-panel');
        return {
          preparedItemIds: saved.preparedItemIds,
          inventory: saved.inventory,
          itemStates,
          slots,
          itemCount: Object.keys(itemStates).length,
          generalUsed: Number(panel?.dataset.generalSlotsUsed),
          generalAvailable: Number(panel?.dataset.generalSlotsAvailable),
          specializedSlots: Number(panel?.dataset.specializedSlots)
        };
      })()`
    );

  await injectGameState(cdp, hubState);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.tactical-loadout-panel[data-specialized-slots="2"]') &&
      document.querySelector('[data-action="toggle-tactical-capture_net"]:not(:disabled)') &&
      document.querySelector('[data-action="toggle-tactical-echo_coin"]:not(:disabled)')`,
    'tactical hub with two field rigs'
  );
  const initialPreparation = await readPreparation();
  const badInitialStock = TACTICAL_ITEM_IDS.filter(
    (itemId, index) => initialPreparation.itemStates[itemId]?.stock !== index + 2
  );
  if (
    initialPreparation.itemCount !== TACTICAL_ITEM_IDS.length ||
    badInitialStock.length > 0 ||
    JSON.stringify(initialPreparation.preparedItemIds) !== JSON.stringify(DEFAULT_PREPARED_TACTICAL_ITEM_IDS) ||
    initialPreparation.specializedSlots !== 2
  ) {
    throw new Error(`Valid tactical hub should expose every stocked item and both field rigs: ${JSON.stringify(initialPreparation)}`);
  }

  await clickElementByPointer(cdp, '[data-action="toggle-tactical-capture_net"]');
  await waitForPage(
    cdp,
    `JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.preparedItemIds) ===
      JSON.stringify(${JSON.stringify(expectedFour)}) &&
      document.querySelector('[data-tactical-item="capture_net"][data-selected="true"]')`,
    'real pointer selects capture net'
  );
  await clickElementByPointer(cdp, '[data-action="toggle-tactical-echo_coin"]');
  await waitForPage(
    cdp,
    `JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.preparedItemIds) ===
      JSON.stringify(${JSON.stringify(expectedFive)}) &&
      document.querySelector('.tactical-loadout-panel[data-general-slots-used="3"][data-general-slots-available="3"]')`,
    'real pointer fills five tactical categories'
  );

  const fullPreparation = await readPreparation();
  const expectedDomSelected = TACTICAL_ITEM_IDS.filter((itemId) => expectedFive.includes(itemId));
  const actualDomSelected = TACTICAL_ITEM_IDS.filter((itemId) => fullPreparation.itemStates[itemId]?.selected);
  const portalSlot = fullPreparation.slots.rift_belt_portal_rig;
  const captureSlot = fullPreparation.slots.cloudstep_charm_capture_rig;
  if (
    JSON.stringify(fullPreparation.preparedItemIds) !== JSON.stringify(expectedFive) ||
    JSON.stringify(actualDomSelected) !== JSON.stringify(expectedDomSelected) ||
    fullPreparation.generalUsed !== 3 ||
    fullPreparation.generalAvailable !== 3 ||
    fullPreparation.specializedSlots !== 2 ||
    fullPreparation.slots['general-1']?.assignedItem !== 'healing_pill' ||
    fullPreparation.slots['general-2']?.assignedItem !== 'dispel_talisman' ||
    fullPreparation.slots['general-3']?.assignedItem !== 'echo_coin' ||
    portalSlot?.category !== 'portal' ||
    portalSlot?.assignedItem !== 'gate_sigil' ||
    !portalSlot.text.includes('来源：裂隙束带') ||
    captureSlot?.category !== 'capture' ||
    captureSlot?.assignedItem !== 'capture_net' ||
    !captureSlot.text.includes('来源：云隙足铃') ||
    !fullPreparation.itemStates.thunder_talisman?.disabled ||
    fullPreparation.itemStates.thunder_talisman?.selected ||
    !fullPreparation.itemStates.thunder_talisman?.text.includes('溢出')
  ) {
    throw new Error(`Five tactical types should fill 3 general + portal/capture rigs and disable a sixth mismatch: ${JSON.stringify(fullPreparation)}`);
  }

  const exactFiveSave = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.preparedItemIds) ===
      JSON.stringify(${JSON.stringify(expectedFive)}) &&
      document.querySelector('[data-tactical-item="echo_coin"][data-selected="true"]')`,
    'five-item tactical preparation survives reload'
  );
  const reloadedFiveSave = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  if (reloadedFiveSave !== exactFiveSave) {
    throw new Error('Reload should preserve the exact tactical hub save value.');
  }

  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return JSON.stringify(saved.run?.tacticalLoadout) === JSON.stringify({ rulesVersion: 1, itemIds: ${JSON.stringify(expectedFive)} }) &&
        document.querySelector('[data-run-tactical-loadout="snapshot"][data-run-tactical-count="5"]');
    })()`,
    'dungeon entry locks tactical snapshot'
  );
  const enteredRun = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        preparedItemIds: saved.preparedItemIds,
        snapshot: saved.run?.tacticalLoadout,
        displayedItemIds: [...document.querySelectorAll('[data-run-tactical-item]')].map((item) => item.dataset.runTacticalItem),
        hasPreparationEditor: Boolean(document.querySelector('.tactical-loadout-panel')),
        hasToggles: Boolean(document.querySelector('[data-tactical-item]'))
      };
    })()`
  );
  if (
    JSON.stringify(enteredRun.preparedItemIds) !== JSON.stringify(expectedFive) ||
    JSON.stringify(enteredRun.snapshot) !== JSON.stringify({ rulesVersion: 1, itemIds: expectedFive }) ||
    JSON.stringify(enteredRun.displayedItemIds) !== JSON.stringify(expectedFive) ||
    enteredRun.hasPreparationEditor ||
    enteredRun.hasToggles
  ) {
    throw new Error(`Exploration should render the locked tactical snapshot read-only: ${JSON.stringify(enteredRun)}`);
  }

  const rebuiltRunState = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
  );
  rebuiltRunState.equipped = {
    ...rebuiltRunState.equipped,
    waist: 'patched_belt',
    charm: 'plain_charm'
  };
  rebuiltRunState.preparedItemIds = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS];
  rebuiltRunState.log = ['rebuilt hub equipment must not rewrite the active snapshot', ...rebuiltRunState.log];
  await injectGameState(cdp, rebuiltRunState);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return JSON.stringify(saved.preparedItemIds) === JSON.stringify(${JSON.stringify(DEFAULT_PREPARED_TACTICAL_ITEM_IDS)}) &&
        JSON.stringify(saved.run?.tacticalLoadout?.itemIds) === JSON.stringify(${JSON.stringify(expectedFive)}) &&
        document.querySelectorAll('[data-run-tactical-item]').length === 5;
    })()`,
    'rebuilt hub equipment leaves active tactical snapshot unchanged'
  );

  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      [...document.querySelectorAll('[data-tactical-item][data-selected="true"]')]
        .map((item) => item.dataset.tacticalItem).join(',') === 'healing_pill,dispel_talisman,gate_sigil'`,
    'restart clears save and restores default tactical preparation'
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('[data-tactical-item][data-selected="true"]').length === 3`,
    'restart tactical defaults survive reload without a save'
  );

  const makeTrapState = () => {
    const trapState = makeExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'blood_rune_trap',
      inventory: { dispel_talisman: 1 },
      lawState: makeDungeonLawState('demon_tower_1', { kind: 'demon_tower', fogPressure: 0 }),
      log: ['tactical blood rune trap pointer save']
    });
    trapState.preparedItemIds = ['dispel_talisman'];
    trapState.run.tacticalLoadout = { rulesVersion: 1, itemIds: ['dispel_talisman'] };
    return trapState;
  };

  await injectGameState(cdp, makeTrapState());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="trap-counter-blood_rune_trap"]:not(:disabled)')`,
    'blood rune counter action renders'
  );
  const counterHp = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player.hp`
  );
  await clickElementByPointer(cdp, '[data-action="trap-counter-blood_rune_trap"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.inventory.dispel_talisman === 0 &&
        saved.player.hp === ${counterHp} &&
        saved.run.damageTaken === 0 &&
        saved.run.clearedNodeIds.includes('blood_rune_trap') &&
        document.querySelector('.grid-node.current.cleared');
    })()`,
    'real pointer trap counter consumes item without damage'
  );

  await injectGameState(cdp, makeTrapState());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-action="trap-risk-blood_rune_trap"]:not(:disabled)')`, 'blood rune risk action renders');
  const riskHp = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player.hp`
  );
  await clickElementByPointer(cdp, '[data-action="trap-risk-blood_rune_trap"]');
  const riskResult = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        inventory: saved.inventory.dispel_talisman,
        hp: saved.player.hp,
        damageTaken: saved.run.damageTaken,
        usedItems: saved.run.usedItems,
        cleared: saved.run.clearedNodeIds.includes('blood_rune_trap'),
        domCleared: Boolean(document.querySelector('.grid-node.current.cleared'))
      };
    })()`
  );
  if (
    riskResult.inventory !== 1 ||
    riskResult.hp >= riskHp ||
    riskResult.damageTaken !== riskHp - riskResult.hp ||
    riskResult.usedItems.includes('dispel_talisman') ||
    !riskResult.cleared ||
    !riskResult.domCleared
  ) {
    throw new Error(`Trap risk should preserve the counter item, deal damage, and clear the node: ${JSON.stringify(riskResult)}`);
  }

  const makePortalState = () => {
    const portalState = makeExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'cracked_portal',
      inventory: { gate_sigil: 1, echo_coin: 1 },
      lawState: makeDungeonLawState('demon_tower_1', { kind: 'demon_tower', fogPressure: 0 }),
      log: ['tactical portal pointer save']
    });
    portalState.claimedTaskIds = ['mainline_clear_demon_tower_1'];
    portalState.preparedItemIds = ['gate_sigil', 'echo_coin'];
    portalState.run.tacticalLoadout = { rulesVersion: 1, itemIds: ['gate_sigil', 'echo_coin'] };
    return portalState;
  };

  await injectGameState(cdp, makePortalState());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="portal-stabilize-cracked_portal"]:not(:disabled)')`,
    'stable portal action renders'
  );
  const stableHp = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player.hp`
  );
  await clickElementByPointer(cdp, '[data-action="portal-stabilize-cracked_portal"]');
  const stablePortal = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        dungeonId: saved.run.dungeonId,
        currentNodeId: saved.run.currentNodeId,
        gate: saved.inventory.gate_sigil,
        coin: saved.inventory.echo_coin,
        hp: saved.player.hp,
        damageTaken: saved.run.damageTaken,
        bagPoints: saved.run.lootBag.rewardPoints,
        usedItems: saved.run.usedItems,
        latestLog: saved.log[0]
      };
    })()`
  );
  if (
    stablePortal.dungeonId !== 'metro_abyss' ||
    stablePortal.currentNodeId !== 'platform_arrival' ||
    stablePortal.gate !== 0 ||
    stablePortal.coin !== 0 ||
    stablePortal.hp !== stableHp ||
    stablePortal.damageTaken !== 0 ||
    stablePortal.bagPoints !== 20 ||
    JSON.stringify(stablePortal.usedItems) !== JSON.stringify(['gate_sigil', 'echo_coin']) ||
    !stablePortal.latestLog.includes('没有受到传送反噬')
  ) {
    throw new Error(`Stable portal should spend gate/coin, avoid backlash, and bank exactly 20: ${JSON.stringify(stablePortal)}`);
  }

  await injectGameState(cdp, makePortalState());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="portal-force-cracked_portal"]:not(:disabled)')`,
    'forced portal action renders'
  );
  const forceHp = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player.hp`
  );
  await clickElementByPointer(cdp, '[data-action="portal-force-cracked_portal"]');
  const forcedPortal = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        dungeonId: saved.run.dungeonId,
        currentNodeId: saved.run.currentNodeId,
        gate: saved.inventory.gate_sigil,
        coin: saved.inventory.echo_coin,
        hp: saved.player.hp,
        damageTaken: saved.run.damageTaken,
        bagPoints: saved.run.lootBag.rewardPoints,
        usedItems: saved.run.usedItems
      };
    })()`
  );
  if (
    forcedPortal.dungeonId !== 'metro_abyss' ||
    forcedPortal.currentNodeId !== 'platform_arrival' ||
    forcedPortal.gate !== 1 ||
    forcedPortal.coin !== 0 ||
    forcedPortal.hp >= forceHp ||
    forcedPortal.damageTaken !== forceHp - forcedPortal.hp ||
    forcedPortal.bagPoints !== 20 ||
    JSON.stringify(forcedPortal.usedItems) !== JSON.stringify(['echo_coin'])
  ) {
    throw new Error(`Forced portal should preserve gate, spend coin, take damage, and still arrive: ${JSON.stringify(forcedPortal)}`);
  }

  const fogState = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'mist_herb_cache',
    clearedNodeIds: ['mist_herb_cache'],
    lawState: makeDungeonLawState(
      'demon_tower_1',
      { kind: 'demon_tower', fogPressure: 2 },
      { clearedNodeIds: ['mist_herb_cache'] }
    ),
    log: ['fog pressure two tactical layout save']
  });
  fogState.preparedItemIds = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS];
  fogState.run.tacticalLoadout = { rulesVersion: 1, itemIds: [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS] };
  await injectGameState(cdp, fogState);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-law-status')?.textContent.includes('雾压 2/3') &&
      document.querySelectorAll('.route-sector[data-route-sector-status="closed"]').length === 3 &&
      document.querySelector('[data-route-gate-id="demon_fog_bone_lane"][data-route-gate-status="closed"]:not(:disabled)')`,
    'fog pressure two route sectors and nearby gate render'
  );
  const routeSummary = await evaluate(
    cdp,
    `(() => Object.fromEntries(
      [...document.querySelectorAll('[data-route-sector]')].map((sector) => [
        sector.dataset.routeSector,
        {
          status: sector.dataset.routeSectorStatus,
          open: Number(sector.dataset.openGates),
          total: Number(sector.dataset.totalGates)
        }
      ])
    ))()`
  );
  const expectedRouteSummary = {
    tower_bone_lane: { status: 'closed', open: 0, total: 1 },
    tower_upper_stairs: { status: 'closed', open: 0, total: 2 },
    tower_lower_stairs: { status: 'closed', open: 0, total: 1 }
  };
  if (JSON.stringify(routeSummary) !== JSON.stringify(expectedRouteSummary)) {
    throw new Error(`Fog pressure 2 should close all three route sectors: ${JSON.stringify(routeSummary)}`);
  }

  await cdp.send('Emulation.setScrollbarsHidden', { hidden: true });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const label = `${width}x${height} tactical law layout`;
      const gateSelector = '.grid-node[data-route-gate-id="demon_fog_bone_lane"][data-route-gate-status="closed"]';
      await assertResponsiveSurface(cdp, {
        width,
        height,
        rootSelector: '.route-sector-summary',
        targetSelectors: ['.dungeon-law-status', '.route-sector-summary', '.nearby-route-gates', '.dungeon-map'],
        buttonSelectors: [gateSelector],
        label
      });
      const exactLayout = await evaluate(
        cdp,
        `(() => {
          const selectors = [${JSON.stringify(gateSelector)}];
          const buttons = selectors.map((selector) => {
            const button = document.querySelector(selector);
            button.scrollIntoView({ block: 'center', inline: 'center' });
            const rect = button.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return { selector, width: rect.width, height: rect.height, hit: Boolean(hit && button.contains(hit)) };
          });
          return {
            viewport: [innerWidth, innerHeight],
            documentWidth: [document.documentElement.clientWidth, document.documentElement.scrollWidth],
            bodyWidth: [document.body.clientWidth, document.body.scrollWidth],
            scrollX,
            exactWidth: document.documentElement.scrollWidth === innerWidth,
            buttons
          };
        })()`
      );
      if (
        exactLayout.viewport[0] !== width ||
        exactLayout.viewport[1] !== height ||
        !exactLayout.exactWidth ||
        exactLayout.buttons.some((button) => button.width < 44 || button.height < 44 || !button.hit)
      ) {
        throw new Error(`${label} should keep exact viewport width and 44px pointer targets: ${JSON.stringify(exactLayout)}`);
      }
    }
  } finally {
    await cdp.send('Emulation.setScrollbarsHidden', { hidden: false });
  }

  const routeGateVariants = [
    { currentNodeId: 'blood_rune_trap', gateId: 'demon_clear_blood_stair' },
    { currentNodeId: 'lower_fog_lesser', gateId: 'demon_clear_portal_stair' }
  ];
  for (const variant of routeGateVariants) {
    const variantState = {
      ...fogState,
      run: {
        ...fogState.run,
        currentNodeId: variant.currentNodeId,
        clearedNodeIds: [variant.currentNodeId],
        lawState: {
          ...fogState.run.lawState,
          clearedNodeIds: [variant.currentNodeId]
        }
      }
    };
    await injectGameState(cdp, variantState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('[data-route-gate-id="${variant.gateId}"][data-route-gate-status="closed"]:not(:disabled)')`,
      `${variant.gateId} closed route data`
    );
  }

  await setViewport(cdp, 1280, 900);
  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('[data-tactical-item][data-selected="true"]').length === 3`,
    'tactical aggregate cleanup'
  );
  console.log('[smoke] real pointer tactical loadout, locked snapshot, explicit trap/portal branches, and fog-2 layouts pass');
}

async function getNextGridStepToward(cdp, targetSelector, avoidSelector = '') {
  return evaluate(
    cdp,
    `(() => {
      const map = document.querySelector('.dungeon-map');
      if (!map) throw new Error('Missing dungeon map');
      const cells = [...map.children];
      const width = Number.parseInt(map.style.getPropertyValue('--dungeon-grid-columns'), 10);
      const currentIndex = cells.findIndex((cell) => cell.matches('.grid-node.current'));
      const targetIndex = cells.findIndex((cell) => cell.matches(${JSON.stringify(targetSelector)}));
      if (currentIndex < 0 || targetIndex < 0 || !width) {
        throw new Error('Missing current/target grid node for ${targetSelector}');
      }
      if (currentIndex === targetIndex) return null;

      const blockedSelector = ${JSON.stringify(avoidSelector)};
      const traversable = new Set(
        cells.flatMap((cell, index) => {
          if (!cell.matches('.grid-node')) return [];
          if (blockedSelector && cell.matches(blockedSelector) && index !== targetIndex && index !== currentIndex) return [];
          return [index];
        })
      );
      const queue = [currentIndex];
      const previous = new Map([[currentIndex, -1]]);
      while (queue.length) {
        const index = queue.shift();
        if (index === targetIndex) break;
        const x = index % width;
        const candidates = [index - width, index + width];
        if (x > 0) candidates.push(index - 1);
        if (x < width - 1) candidates.push(index + 1);
        for (const candidate of candidates) {
          // Gate status is directional from the current node; avoid only that closed first edge.
          if (index === currentIndex && cells[candidate]?.matches('.gate-closed')) continue;
          if (!traversable.has(candidate) || previous.has(candidate)) continue;
          previous.set(candidate, index);
          queue.push(candidate);
        }
      }
      if (!previous.has(targetIndex)) throw new Error('No legal grid path to ${targetSelector}');
      let nextIndex = targetIndex;
      while (previous.get(nextIndex) !== currentIndex) nextIndex = previous.get(nextIndex);
      return cells[nextIndex].querySelector('strong')?.textContent?.trim() ?? '';
    })()`
  );
}

async function finishProtocolCombatByPointer(cdp, label) {
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel')`, `${label} combat starts`);
  const hasWeaponSkill = await evaluate(
    cdp,
    `Boolean(document.querySelector('[data-action="combat-weapon_skill"]:not(:disabled)'))`
  );
  if (hasWeaponSkill) await clickElementByPointer(cdp, '[data-action="combat-weapon_skill"]');

  for (let round = 0; round < 80; round += 1) {
    const combat = await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const panel = document.querySelector('.combat-panel');
        const heal = panel && [...panel.querySelectorAll('button')].find((button) =>
          !button.disabled && button.textContent.includes('止血丹')
        );
        return {
          active: Boolean(panel),
          phase: saved.phase,
          hp: saved.player.hp,
          maxHp: saved.player.maxHp,
          canHeal: Boolean(heal)
        };
      })()`
    );
    if (!combat.active) break;
    if (combat.phase === 'result') throw new Error(`${label} ended in recovery instead of a clear`);
    await clickButtonByPointer(cdp, combat.canHeal && combat.hp <= combat.maxHp * 0.65 ? '止血丹' : '攻击', '.combat-panel');
  }

  const stillInCombat = await evaluate(cdp, `Boolean(document.querySelector('.combat-panel'))`);
  if (stillInCombat) throw new Error(`${label} exceeded 80 real pointer combat rounds`);
  if (await evaluate(cdp, `Boolean(document.querySelector('.equipment-loot-offer'))`)) {
    await clickButtonByPointer(cdp, '放弃', '.node-action-panel');
  }
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.cleared') && !document.querySelector('.equipment-loot-offer')`,
    `${label} clears and resolves loot`
  );
}

async function finishTemporalCombatByPointer(cdp, nodeId, label) {
  await clickElementByPointer(cdp, `[data-action="fight-current-${nodeId}"]`);
  await waitForPage(
    cdp,
    `document.querySelector('.combat-panel') &&
      document.querySelector('.weapon-skill-state[data-weapon-skill-name="时序逆转"]') &&
      document.querySelector('[data-action="combat-weapon_skill"]')?.textContent.includes('时序逆转')`,
    `${label} starts with the chronal weapon skill`
  );

  let usedChronalReversal = false;
  for (let round = 0; round < 80; round += 1) {
    const combat = await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const panel = document.querySelector('.combat-panel');
        if (!panel) return { active: false, phase: saved.phase, actionId: '' };
        const buttons = [...panel.querySelectorAll('.combat-actions button:not(:disabled)')];
        const skill = buttons.find((button) => button.dataset.action === 'combat-weapon_skill');
        const heal = buttons.find((button) => button.dataset.action === 'combat-use_healing_pill');
        const guardBuilder = buttons.find((button) =>
          button.dataset.action === 'combat-guard' && /战意 \\+[1-9]/.test(button.textContent)
        );
        const focusBuilder = buttons.find((button) =>
          !button.dataset.action?.includes('escape') && /战意 \\+[1-9]/.test(button.textContent)
        );
        const fallback = buttons.find((button) => button.dataset.action === 'combat-attack');
        const action = saved.player.hp <= saved.player.maxHp * 0.4 && heal
          ? heal
          : skill ?? guardBuilder ?? focusBuilder ?? fallback;
        return {
          active: true,
          phase: saved.phase,
          actionId: action?.dataset.action ?? '',
          hp: saved.player.hp,
          maxHp: saved.player.maxHp
        };
      })()`
    );
    if (!combat.active) break;
    if (combat.phase === 'result') throw new Error(`${label} ended in recovery instead of a clear`);
    if (!combat.actionId) throw new Error(`${label} has no usable real-pointer combat action`);
    if (combat.actionId === 'combat-weapon_skill') usedChronalReversal = true;
    await clickElementByPointer(cdp, `[data-action="${combat.actionId}"]`);
  }

  if (await evaluate(cdp, `Boolean(document.querySelector('.combat-panel'))`)) {
    throw new Error(`${label} exceeded 80 real-pointer combat rounds`);
  }
  if (await evaluate(cdp, `Boolean(document.querySelector('.equipment-loot-offer'))`)) {
    await clickElementByPointer(cdp, '[data-action="loot-decline-equipment"]');
  }
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.cleared[data-action="grid-${nodeId}"]') &&
      !document.querySelector('.equipment-loot-offer')`,
    `${label} clears and resolves loot`
  );
  return usedChronalReversal;
}

async function resolveCurrentProtocolNodeByPointer(cdp, label) {
  if (await evaluate(cdp, `Boolean(document.querySelector('.equipment-loot-offer'))`)) {
    await clickButtonByPointer(cdp, '放弃', '.node-action-panel');
  }
  const action = await evaluate(
    cdp,
    `(() => {
      if (!document.querySelector('.route-lock-status')) return '';
      const buttons = [...document.querySelectorAll('.node-action-panel button:not(:disabled)')];
      if (buttons.some((button) => button.textContent.includes('进入战斗'))) return 'combat';
      const trapAction = buttons.find((button) => button.dataset.action?.startsWith('trap-counter-')) ??
        buttons.find((button) => button.dataset.action?.startsWith('trap-risk-'));
      if (trapAction) return trapAction.dataset.action;
      return 'blocked';
    })()`
  );
  if (action === 'combat') {
    await finishProtocolCombatByPointer(cdp, label);
  } else if (action.startsWith('trap-')) {
    await clickElementByPointer(cdp, `[data-action="${action}"]`);
    await waitForPage(cdp, `document.querySelector('.grid-node.current.cleared')`, `${label} trap clears`);
  } else if (action === 'blocked') {
    throw new Error(`${label} has an unsupported route lock`);
  }
}

async function walkProtocolRouteByPointer(cdp, targetSelector, label, avoidSelector = '') {
  for (let step = 0; step < 50; step += 1) {
    await resolveCurrentProtocolNodeByPointer(cdp, `${label} step ${step + 1}`);
    const nextTitle = await getNextGridStepToward(cdp, targetSelector, avoidSelector);
    if (nextTitle === null) return;
    if (!nextTitle) throw new Error(`${label} produced an empty next-node title`);
    await clickGridCell(cdp, nextTitle);
    await waitForPage(
      cdp,
      `document.querySelector('.grid-node.current')?.textContent.includes(${JSON.stringify(nextTitle)})`,
      `${label} moves to ${nextTitle}`
    );
  }
  throw new Error(`${label} exceeded 50 real pointer moves`);
}

async function walkToUnresolvedNodeByPointer(cdp, targetSelector, label, avoidSelector = '') {
  for (let step = 0; step < 50; step += 1) {
    const atTarget = await evaluate(
      cdp,
      `Boolean(document.querySelector('.grid-node.current${targetSelector}'))`
    );
    if (atTarget) return;
    await resolveCurrentProtocolNodeByPointer(cdp, `${label} step ${step + 1}`);
    const nextTitle = await getNextGridStepToward(cdp, targetSelector, avoidSelector);
    if (nextTitle === null) return;
    if (!nextTitle) throw new Error(`${label} produced an empty next-node title`);
    await clickGridCell(cdp, nextTitle);
    await waitForPage(
      cdp,
      `document.querySelector('.grid-node.current')?.textContent.includes(${JSON.stringify(nextTitle)})`,
      `${label} moves to ${nextTitle}`
    );
  }
  throw new Error(`${label} exceeded 50 real pointer moves`);
}

async function completeCurrentDeepAnchorByPointer(cdp, label) {
  const anchor = await evaluate(
    cdp,
    `(() => {
      const node = document.querySelector('.grid-node.current[data-deep-protocol-anchor="true"]');
      if (!node) throw new Error('Current node is not a marked deep-protocol anchor');
      const action = document.querySelector('.node-action-panel [data-action^="reward-current-"]:not(:disabled)');
      return {
        cleared: node.classList.contains('cleared'),
        type: [...node.classList].find((name) => name.startsWith('type-')) ?? '',
        rewardAction: action?.dataset.action ?? ''
      };
    })()`
  );

  if (!anchor.cleared) {
    if (anchor.type === 'type-monster') {
      await finishProtocolCombatByPointer(cdp, label);
    } else if (anchor.type === 'type-trap') {
      await resolveCurrentProtocolNodeByPointer(cdp, label);
    } else if (anchor.type === 'type-reward' && anchor.rewardAction) {
      await clickElementByPointer(cdp, `[data-action="${anchor.rewardAction}"]`);
    } else {
      throw new Error(`${label} has an unsupported deep anchor action: ${JSON.stringify(anchor)}`);
    }
  }

  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current[data-deep-protocol-anchor="true"].cleared')`,
    `${label} clears through its real node action`
  );
  if (await evaluate(cdp, `Boolean(document.querySelector('[data-relic-choice]:not(:disabled)'))`)) {
    await clickElementByPointer(cdp, '[data-relic-choice]:not(:disabled)');
    await waitForPage(cdp, `!document.querySelector('[data-relic-choice]')`, `${label} relic draft resolves`);
  }
  if (await evaluate(cdp, `Boolean(document.querySelector('.equipment-loot-offer'))`)) {
    await clickButtonByPointer(cdp, '放弃', '.node-action-panel');
    await waitForPage(cdp, `!document.querySelector('.equipment-loot-offer')`, `${label} equipment offer resolves`);
  }
}

async function runRouteContractPointerSmoke(cdp, appUrl) {
  const contractId = 'tower_mist_watch';
  const contractRewardPoints = 135;

  const assertPreparationLayout = async (width, height) => {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.protocol-sheet',
      targetSelectors: [
        '.protocol-route-contract',
        '.route-contract-options',
        `[data-route-contract-option="${contractId}"]`,
        '.protocol-modal-actions'
      ],
      buttonSelectors: [
        `[data-route-contract-option="${contractId}"]`,
        '[data-action="confirm-protocol-entry"]'
      ],
      minimumButtonHeight: 40,
      checkRootOverflow: true,
      label: `${width}x${height} route contract preparation`
    });

    // Check every compact option, including the text tracks that share a row on mobile.
    const layout = await evaluate(
      cdp,
      `(() => {
        const section = document.querySelector('.protocol-route-contract');
        const options = [...document.querySelectorAll('[data-route-contract-option]')];
        const intersects = (left, right) =>
          Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
          Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
        const textCollisions = options.flatMap((option) => {
          const tracks = [...option.querySelectorAll('strong, small, b')];
          const collisions = [];
          for (let leftIndex = 0; leftIndex < tracks.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < tracks.length; rightIndex += 1) {
              if (intersects(tracks[leftIndex].getBoundingClientRect(), tracks[rightIndex].getBoundingClientRect())) {
                collisions.push([option.dataset.routeContractOption, tracks[leftIndex].tagName, tracks[rightIndex].tagName]);
              }
            }
          }
          return collisions;
        });
        const optionRects = options.map((option) => {
          const rect = option.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return {
            id: option.dataset.routeContractOption,
            insideX: rect.left >= -1 && rect.right <= window.innerWidth + 1,
            overflow: option.scrollWidth > option.clientWidth + 1,
            pointerTarget: Boolean(hit && option.contains(hit))
          };
        });
        const optionCollisions = [];
        for (let leftIndex = 0; leftIndex < options.length; leftIndex += 1) {
          for (let rightIndex = leftIndex + 1; rightIndex < options.length; rightIndex += 1) {
            if (intersects(options[leftIndex].getBoundingClientRect(), options[rightIndex].getBoundingClientRect())) {
              optionCollisions.push([
                options[leftIndex].dataset.routeContractOption,
                options[rightIndex].dataset.routeContractOption
              ]);
            }
          }
        }
        return {
          viewport: [window.innerWidth, window.innerHeight],
          optionCount: options.length,
          sectionOverflow: section.scrollWidth > section.clientWidth + 1,
          pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
          optionRects,
          optionCollisions,
          textCollisions
        };
      })()`
    );
    if (
      JSON.stringify(layout.viewport) !== JSON.stringify([width, height]) ||
      layout.optionCount !== 4 ||
      layout.sectionOverflow ||
      layout.pageOverflow ||
      layout.optionRects.some((option) => !option.insideX || option.overflow || !option.pointerTarget) ||
      layout.optionCollisions.length > 0 ||
      layout.textCollisions.length > 0
    ) {
      throw new Error(`${width}x${height} route contract controls should stay compact and collision-free: ${JSON.stringify(layout)}`);
    }
  };

  const assertRunLayout = async (width, height) => {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.dungeon-map',
      targetSelectors: [
        '.run-route-contract-status',
        '[data-route-contract-order="1"]',
        '[data-route-contract-order="2"]'
      ],
      checkRootOverflow: true,
      label: `${width}x${height} route contract map`
    });

    const layout = await evaluate(
      cdp,
      `(() => {
        const status = document.querySelector('.run-route-contract-status');
        const statusCells = [...status.children];
        const targets = [...document.querySelectorAll('[data-route-contract-order]')];
        const intersects = (left, right) =>
          Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
          Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
        const statusCollisions = [];
        for (let leftIndex = 0; leftIndex < statusCells.length; leftIndex += 1) {
          for (let rightIndex = leftIndex + 1; rightIndex < statusCells.length; rightIndex += 1) {
            if (intersects(statusCells[leftIndex].getBoundingClientRect(), statusCells[rightIndex].getBoundingClientRect())) {
              statusCollisions.push([leftIndex, rightIndex]);
            }
          }
        }
        const targetLayouts = targets.map((target) => {
          const badge = target.querySelector('.route-contract-order-mark');
          const badgeRect = badge.getBoundingClientRect();
          const copy = [...target.querySelectorAll(':scope > .node-type-label, :scope > strong, :scope > small')];
          const targetRect = target.getBoundingClientRect();
          return {
            order: target.dataset.routeContractOrder,
            status: target.dataset.routeContractStatus,
            overflow: target.scrollWidth > target.clientWidth + 1,
            badgeInside: badgeRect.left >= targetRect.left - 1 && badgeRect.right <= targetRect.right + 1 &&
              badgeRect.top >= targetRect.top - 1 && badgeRect.bottom <= targetRect.bottom + 1,
            badgeCopyCollision: copy.some((element) => intersects(badgeRect, element.getBoundingClientRect()))
          };
        });
        return {
          viewport: [window.innerWidth, window.innerHeight],
          pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
          statusOverflow: status.scrollWidth > status.clientWidth + 1,
          statusCellOverflow: statusCells.some((cell) => cell.scrollWidth > cell.clientWidth + 1),
          statusCollisions,
          targetLayouts
        };
      })()`
    );
    if (
      JSON.stringify(layout.viewport) !== JSON.stringify([width, height]) ||
      layout.pageOverflow ||
      layout.statusOverflow ||
      layout.statusCellOverflow ||
      layout.statusCollisions.length > 0 ||
      layout.targetLayouts.length !== 2 ||
      layout.targetLayouts.some((target) => target.overflow || !target.badgeInside || target.badgeCopyCollision)
    ) {
      throw new Error(`${width}x${height} route contract status and badges should not overflow or collide: ${JSON.stringify(layout)}`);
    }
  };

  await setViewport(cdp, 390, 844);
  await injectGameState(cdp, makeProtocolHubSave());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.shell')`, 'replay-ready route-contract hub renders');
  const entryScope = await evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = raw ? JSON.parse(raw).state : undefined;
      return {
        hasSave: Boolean(raw),
        phase: saved?.phase ?? '',
        marker: document.body.textContent.includes('protocol and attunement pointer smoke save'),
        protocolEntries: [...document.querySelectorAll('[data-action^="open-protocol-"]')].map((button) => button.dataset.action),
        routeControlsOnHub: document.querySelectorAll('[data-route-contract-option]').length
      };
    })()`
  );
  if (
    !entryScope.hasSave ||
    entryScope.phase !== 'hub' ||
    !entryScope.marker ||
    JSON.stringify(entryScope.protocolEntries) !== JSON.stringify(['open-protocol-demon_tower_1']) ||
    entryScope.routeControlsOnHub !== 0
  ) {
    throw new Error(`Only the cleared dungeon should expose route contracts through its protocol modal: ${JSON.stringify(entryScope)}`);
  }

  const storageBeforeModal = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  await clickElementByPointer(cdp, '[data-action="open-protocol-demon_tower_1"]');
  await waitForPage(
    cdp,
    `document.querySelectorAll('[data-route-contract-option]').length === 4 &&
      document.querySelector('.protocol-route-contract[data-route-contract-selected="none"]')`,
    'route contract choices render inside the protocol modal'
  );
  await clickElementByPointer(cdp, `[data-route-contract-option="${contractId}"]`);
  await waitForPage(
    cdp,
    `document.querySelector('.protocol-route-contract[data-route-contract-selected="${contractId}"]') &&
      document.querySelector('[data-route-contract-option="${contractId}"][aria-checked="true"]')`,
    'real pointer selects a canonical route contract'
  );
  await assertPreparationLayout(390, 844);
  await assertPreparationLayout(1440, 900);

  await clickElementByPointer(cdp, '[data-protocol-mode="imprint"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-selected-protocol="imprint"]') &&
      document.querySelector('.protocol-route-contract[data-route-contract-selected="${contractId}"]') &&
      document.querySelector('[data-route-contract-option="${contractId}"][aria-checked="true"]')`,
    'route contract selection survives a protocol mode switch'
  );
  await clickElementByPointer(cdp, '[data-protocol-mode="standard"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-selected-protocol="standard"]') &&
      document.querySelector('.protocol-route-contract[data-route-contract-selected="${contractId}"]')`,
    'route contract selection survives switching back to standard exploration'
  );
  const storageAfterPreparation = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  if (storageAfterPreparation !== storageBeforeModal) {
    throw new Error('Route contract and protocol choices should remain non-persistent until entry confirmation.');
  }

  await setViewport(cdp, 390, 844);
  await clickElementByPointer(cdp, '[data-action="confirm-protocol-entry"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run?.protocol?.id === 'standard' &&
        saved.run.routeContractState?.contractId === '${contractId}' &&
        saved.run.routeContractState.status === 'active' &&
        saved.run.routeContractState.completedTargetCount === 0 &&
        document.querySelector('[data-route-contract-status="active"][data-route-contract-selected="${contractId}"][data-route-contract-reward-points="${contractRewardPoints}"]') &&
        document.querySelectorAll('[data-route-contract-order]').length === 2 &&
        document.querySelector('[data-route-contract-order="1"][data-route-contract-status="pending"]') &&
        document.querySelector('[data-route-contract-order="2"][data-route-contract-status="locked"]');
    })()`,
    'confirmed route contract freezes two ordered map targets with target two locked'
  );
  await assertRunLayout(390, 844);
  await assertRunLayout(1440, 900);
  await setViewport(cdp, 390, 844);

  await walkProtocolRouteByPointer(cdp, '[data-route-contract-order="1"]', 'route contract target 1', '.boss-node');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.routeContractState?.status === 'active' &&
        saved.run.routeContractState.completedTargetCount === 1 &&
        document.querySelector('[data-route-contract-order="1"][data-route-contract-status="completed"]') &&
        document.querySelector('[data-route-contract-order="2"][data-route-contract-status="pending"]') &&
        document.querySelector('.run-route-contract-status[data-route-contract-status="active"]')?.textContent.includes('1/2');
    })()`,
    'real pointer combat completes target 1 and unlocks target 2'
  );

  await walkProtocolRouteByPointer(cdp, '[data-action="grid-broken_sigil_reward"]', 'route contract reward detour', '.boss-node');
  await waitForPage(cdp, `document.querySelector('[data-action="reward-current-broken_sigil_reward"]:not(:disabled)')`, 'route contract reward action');
  const rewardPointsBeforeClaim = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lootBag.rewardPoints`
  );
  await clickElementByPointer(cdp, '[data-action="reward-current-broken_sigil_reward"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.clearedNodeIds.includes('broken_sigil_reward') &&
        saved.run.lootBag.rewardPoints > ${rewardPointsBeforeClaim} &&
        document.querySelector('[data-action="grid-broken_sigil_reward"].cleared');
    })()`,
    'real pointer reward collection remains independent from contract progress'
  );

  await walkProtocolRouteByPointer(cdp, '[data-route-contract-order="2"]', 'route contract target 2', '.boss-node');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.routeContractState?.status === 'secured' &&
        saved.run.routeContractState.completedTargetCount === 2 &&
        document.querySelector('.run-route-contract-status[data-route-contract-status="secured"][data-route-contract-reward-points="${contractRewardPoints}"]') &&
        document.querySelectorAll('[data-route-contract-status="completed"][data-route-contract-order]').length === 2;
    })()`,
    'real pointer trap completes target 2 and secures the exact contract bonus'
  );

  await walkProtocolRouteByPointer(cdp, '.boss-node', 'route contract boss route');
  await waitForPage(
    cdp,
    `document.querySelector('.boss-node.cleared') &&
      document.querySelector('.run-route-contract-status[data-route-contract-status="secured"]')`,
    'route contract remains secured after real pointer Boss combat'
  );
  await walkProtocolRouteByPointer(cdp, '.type-exit', 'route contract exit route');
  const beforeExit = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        rewardPoints: saved.rewardPoints,
        lootBagRewardPoints: saved.run.lootBag.rewardPoints,
        contract: saved.run.routeContractState
      };
    })()`
  );
  if (beforeExit.contract?.status !== 'secured' || beforeExit.contract?.completedTargetCount !== 2) {
    throw new Error(`Route contract should be secured before exit settlement: ${JSON.stringify(beforeExit)}`);
  }
  await clickElementByPointer(cdp, '[data-action="exit-current-tower_exit"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' && document.querySelector('.route-contract-settlement');
    })()`,
    'Boss-cleared exit renders route contract settlement'
  );
  const settled = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const evidence = document.querySelector('.route-contract-settlement');
      return {
        phase: saved.phase,
        rewardPoints: saved.rewardPoints,
        minimumExpectedRewardPoints: ${beforeExit.rewardPoints + contractRewardPoints},
        preSettlementLootBagRewardPoints: ${beforeExit.lootBagRewardPoints},
        routeContractState: saved.run?.routeContractState,
        settlement: saved.run?.lastRouteContractSettlement,
        lastOutcome: saved.lastOutcome,
        latestLog: saved.log?.[0],
        evidenceStatus: evidence?.dataset.routeContractStatus,
        evidenceContractId: evidence?.dataset.routeContractSelected,
        evidenceRewardPoints: Number(evidence?.dataset.routeContractRewardPoints ?? -1),
        evidenceText: evidence?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    settled.phase !== 'result' ||
    settled.routeContractState?.status !== 'banked' ||
    settled.routeContractState?.completedTargetCount !== 2 ||
    settled.settlement?.state?.status !== 'banked' ||
    settled.settlement?.state?.completedTargetCount !== 2 ||
    settled.settlement?.rewardPoints !== contractRewardPoints ||
    settled.settlement?.rewarded !== true ||
    settled.rewardPoints < settled.minimumExpectedRewardPoints ||
    !settled.lastOutcome?.includes(`routeContractBonus=${contractRewardPoints}`) ||
    !settled.latestLog?.includes(`独立获得 ${contractRewardPoints} 奖励点`) ||
    settled.evidenceStatus !== 'banked' ||
    settled.evidenceContractId !== contractId ||
    settled.evidenceRewardPoints !== contractRewardPoints ||
    !settled.evidenceText.includes(`+${contractRewardPoints} 奖励点`)
  ) {
    throw new Error(`Boss-cleared exit should bank the exact independent route contract reward: ${JSON.stringify(settled)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.result-panel',
    targetSelectors: ['.route-contract-settlement', '.route-contract-settlement-reward'],
    label: '390x844 route contract settlement'
  });

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const evidence = document.querySelector('.route-contract-settlement[data-route-contract-status="banked"][data-route-contract-reward-points="${contractRewardPoints}"]');
      return saved.phase === 'result' && saved.rewardPoints === ${settled.rewardPoints} &&
        saved.run?.routeContractState?.status === 'banked' &&
        saved.run.lastRouteContractSettlement?.rewardPoints === ${contractRewardPoints} &&
        saved.run.lastRouteContractSettlement?.rewarded === true &&
        evidence?.textContent.includes('契约已入账') &&
        evidence.textContent.includes('+${contractRewardPoints} 奖励点');
    })()`,
    'route contract banked settlement evidence survives reload without a second payout'
  );
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.result-panel',
    targetSelectors: ['.route-contract-settlement', '.route-contract-settlement-reward'],
    label: '1440x900 restored route contract settlement'
  });
  console.log('[smoke] route contract: cleared-only modal -> mode retention -> target 1 combat -> reward -> target 2 trap -> Boss -> exit banks exact +135 and survives reload');
}

async function getAttunementUiSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const card = document.querySelector('[data-equipment-id="starforged_edge"]');
      const powerText = document.querySelector('.character-trigger')?.textContent ?? '';
      const powerNumbers = powerText.match(/[0-9]+/g) ?? [];
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        score: Number(card?.querySelector('[data-equipment-score]')?.dataset.equipmentScore ?? 0),
        power: Number(powerNumbers.at(-1) ?? 0),
        rewardPoints: saved.rewardPoints,
        lingyun: saved.lingyun,
        cycleImprint: saved.inventory.cycle_imprint,
        attunement: saved.equipmentAttunements?.starforged_edge,
        forgeText: document.querySelector('.equipment-forge-section')?.textContent.replace(/\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
}

async function runProtocolAndAttunementPointerSmoke(cdp, appUrl) {
  await injectGameState(cdp, makeProtocolHubSave());
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844
  });
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="open-protocol-demon_tower_1"]') &&
      document.querySelector('[data-cycle-imprint-count="0"]')`,
    'completed dungeon protocol gate and imprint inventory render'
  );
  const storageBeforeModal = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);

  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '选择协议');
  await waitForPage(cdp, `document.querySelector('.protocol-sheet [data-protocol-mode="standard"][aria-pressed="true"]')`, 'protocol modal defaults to standard');
  const mobileModal = await evaluate(
    cdp,
    `(() => {
      const sheet = document.querySelector('.protocol-sheet');
      const rect = sheet.getBoundingClientRect();
      const segments = [...sheet.querySelectorAll('[data-protocol-mode]')];
      const deepMode = sheet.querySelector('[data-protocol-mode="deep"]');
      return {
        viewport: [window.innerWidth, window.innerHeight],
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        insideViewport: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
        appInert: Boolean(document.querySelector('.app-content')?.hasAttribute('inert')),
        standardFocused: document.activeElement === sheet.querySelector('[data-protocol-mode="standard"]'),
        segmentCount: segments.length,
        deepDisabled: deepMode?.disabled ?? false,
        deepAriaDisabled: deepMode?.getAttribute('aria-disabled'),
        segmentOverflow: segments.some((button) => {
          const buttonRect = button.getBoundingClientRect();
          return buttonRect.left < rect.left || buttonRect.right > rect.right || buttonRect.width <= 0;
        }),
        storage: localStorage.getItem(${JSON.stringify(STORAGE_KEY)})
      };
    })()`
  );
  if (
    mobileModal.viewport[0] !== 390 ||
    mobileModal.viewport[1] !== 844 ||
    mobileModal.overflow ||
    !mobileModal.insideViewport ||
    !mobileModal.appInert ||
    !mobileModal.standardFocused ||
    mobileModal.segmentCount !== 3 ||
    !mobileModal.deepDisabled ||
    mobileModal.deepAriaDisabled !== 'true' ||
    mobileModal.segmentOverflow ||
    mobileModal.storage !== storageBeforeModal
  ) {
    throw new Error(`390x844 protocol modal should be inert, focused, non-persistent, and overflow-free: ${JSON.stringify(mobileModal)}`);
  }
  await clickElementByPointer(cdp, '.protocol-backdrop');
  await waitForPage(
    cdp,
    `!document.querySelector('.protocol-modal') && document.activeElement === document.querySelector('[data-action="open-protocol-demon_tower_1"]')`,
    'protocol backdrop closes and restores focus'
  );
  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '选择协议');
  await pressEscape(cdp);
  await waitForPage(
    cdp,
    `!document.querySelector('.protocol-modal') && document.activeElement === document.querySelector('[data-action="open-protocol-demon_tower_1"]')`,
    'protocol Escape closes and restores focus'
  );
  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '选择协议');
  await clickButtonByPointer(cdp, '烙印', '.protocol-sheet');
  await waitForPage(cdp, `document.querySelector('[data-selected-protocol="imprint"]')`, 'imprint protocol segment selects');
  const storageAfterModeSwitch = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  if (storageAfterModeSwitch !== storageBeforeModal) throw new Error('Switching protocol mode should not persist before confirmation.');
  await clickDialogButton(cdp, '取消');
  await waitForPage(cdp, `!document.querySelector('.protocol-modal')`, 'protocol cancel closes');

  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '选择协议');
  await clickButtonByPointer(cdp, '烙印', '.protocol-sheet');
  await clickButtonByPointer(cdp, '确认烙印协议', '.protocol-sheet');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.protocol?.id === 'imprint' && saved.run.protocol.rulesVersion === 1 &&
        document.querySelector('[data-run-protocol="imprint"][data-protocol-anchor-complete="false"]') &&
        document.querySelector('[data-protocol-anchor="true"]');
    })()`,
    'confirmed imprint protocol persists and renders status/anchor'
  );
  const mobileRun = await evaluate(
    cdp,
    `(() => {
      const map = document.querySelector('.dungeon-map').getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        mapInside: map.left >= 0 && map.right <= window.innerWidth,
        protocolText: document.querySelector('.run-protocol-status')?.textContent.replace(/\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (mobileRun.overflow || !mobileRun.mapInside || !mobileRun.protocolText.includes('锚点未完成')) {
    throw new Error(`390x844 imprint exploration should keep map/status stable: ${JSON.stringify(mobileRun)}`);
  }
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.readyState === 'complete' && document.querySelector('.shell')`, 'imprint reload shell renders');
  const restoredProtocolRun = await evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = raw ? JSON.parse(raw).state : null;
      const status = document.querySelector('.run-protocol-status');
      return {
        hasSave: Boolean(raw),
        phase: saved?.phase,
        protocolId: saved?.run?.protocol?.id,
        rulesVersion: saved?.run?.protocol?.rulesVersion,
        statusProtocol: status?.dataset.runProtocol,
        anchorComplete: status?.dataset.protocolAnchorComplete,
        bodyHasMarker: document.body.textContent.includes('protocol and attunement pointer smoke save')
      };
    })()`
  );
  if (
    !restoredProtocolRun.hasSave ||
    restoredProtocolRun.phase !== 'explore' ||
    restoredProtocolRun.protocolId !== 'imprint' ||
    restoredProtocolRun.rulesVersion !== 1 ||
    restoredProtocolRun.statusProtocol !== 'imprint' ||
    restoredProtocolRun.anchorComplete !== 'false'
  ) {
    throw new Error(`Imprint run should restore after reload: ${JSON.stringify(restoredProtocolRun)}`);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 900
  });

  await walkProtocolRouteByPointer(cdp, '.protocol-anchor-node', 'imprint anchor route', '.boss-node');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.clearedNodeIds.includes('risky_font_trap') &&
      document.querySelector('[data-run-protocol="imprint"][data-protocol-anchor-complete="true"]') &&
      document.querySelector('.protocol-anchor-node.cleared')`,
    'real pointer anchor completion updates protocol status'
  );
  await walkProtocolRouteByPointer(cdp, '.boss-node', 'imprint boss route', '[data-action="grid-mist_herb_cache"]');
  await walkProtocolRouteByPointer(cdp, '.type-exit', 'imprint exit route');
  await clickButtonByPointer(cdp, '完成副本', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const settlement = saved.run?.lastProtocolSettlement;
      return saved.phase === 'result' && saved.inventory.cycle_imprint === 1 &&
        settlement?.status === 'succeeded' && settlement.anchorCompletedBeforeBoss === true &&
        settlement.cycleImprintGranted === true && settlement.rewardPointBonus > 0 &&
        document.querySelector('[data-protocol-settlement="succeeded"][data-cycle-imprint-granted="true"]');
    })()`,
    'anchor-before-boss protocol exit grants one imprint and bonus'
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-protocol-settlement="succeeded"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.inventory.cycle_imprint === 1`,
    'protocol settlement restores after reload'
  );
  await clickButtonByPointer(cdp, '返回主神空间', '.result-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-attunements="starforged_edge"]') &&
      document.querySelector('[data-cycle-imprint-count="1"]')`,
    'full-level attunement branches and imprint inventory render'
  );

  const beforeAttunement = await getAttunementUiSnapshot(cdp);
  await clickCardButtonByPointer(
    cdp,
    '[data-equipment-id="starforged_edge"] .attunement-branch',
    '星炉重铸',
    '铭刻'
  );
  const attunementClick = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const branch = document.querySelector('[data-equipment-id="starforged_edge"] [data-attunement-id="forge_overdrive"]');
      return {
        attunement: saved.equipmentAttunements?.starforged_edge,
        cycleImprint: saved.inventory.cycle_imprint,
        rewardPoints: saved.rewardPoints,
        lingyun: saved.lingyun,
        latestLog: saved.log?.[0],
        branchSelected: branch?.classList.contains('selected') ?? false,
        branchText: branch?.textContent.replace(/\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    attunementClick.attunement !== 'forge_overdrive' ||
    attunementClick.cycleImprint !== 0 ||
    !attunementClick.branchSelected
  ) {
    throw new Error(`Real pointer equipment attunement did not persist: ${JSON.stringify(attunementClick)}`);
  }
  const afterAttunement = await getAttunementUiSnapshot(cdp);
  if (
    afterAttunement.attunement !== 'forge_overdrive' ||
    afterAttunement.cycleImprint !== 0 ||
    afterAttunement.rewardPoints !== beforeAttunement.rewardPoints - 480 ||
    afterAttunement.lingyun !== beforeAttunement.lingyun - 1 ||
    afterAttunement.score <= beforeAttunement.score ||
    afterAttunement.power <= beforeAttunement.power ||
    !afterAttunement.forgeText.includes('当前铭刻')
  ) {
    throw new Error(`Attunement should consume its cost and increase score/power: before=${JSON.stringify(beforeAttunement)} after=${JSON.stringify(afterAttunement)}`);
  }
  await clickButtonByPointer(cdp, '角色', '.topbar');
  await waitForPage(
    cdp,
    `document.querySelector('.character-sheet')?.textContent.includes('铭刻 星炉重铸') &&
      document.querySelector('.character-sheet')?.textContent.includes('淬星剑胚铭刻：星炉重铸')`,
    'character sheet shows active attunement and equipment-system description'
  );
  await clickDialogButton(cdp, '关闭');
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.readyState === 'complete' && document.querySelector('.shell')`, 'attunement reload shell renders');
  const restoredAttunement = await evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = raw ? JSON.parse(raw).state : null;
      return {
        hasSave: Boolean(raw),
        attunement: saved?.equipmentAttunements?.starforged_edge,
        selected: Boolean(document.querySelector('[data-equipment-id="starforged_edge"] [data-attunement-id="forge_overdrive"].selected'))
      };
    })()`
  );
  if (!restoredAttunement.hasSave || restoredAttunement.attunement !== 'forge_overdrive' || !restoredAttunement.selected) {
    throw new Error(`Equipment attunement should restore after reload: ${JSON.stringify(restoredAttunement)}`);
  }

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844
  });
  const mobileAttunement = await evaluate(
    cdp,
    `(() => {
      const branch = document.querySelector('[data-equipment-id="starforged_edge"] [data-attunement-id="forge_channeling"]');
      const button = branch?.querySelector('button');
      branch?.scrollIntoView({ block: 'center', inline: 'center' });
      const branchRect = branch?.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      const hit = buttonRect && document.elementFromPoint(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2);
      return {
        viewport: [window.innerWidth, window.innerHeight],
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        branchInside: Boolean(branchRect && branchRect.left >= 0 && branchRect.right <= window.innerWidth),
        buttonInside: Boolean(buttonRect && buttonRect.left >= 0 && buttonRect.right <= window.innerWidth),
        pointerTarget: Boolean(button && hit && button.contains(hit)),
        buttonText: button?.textContent.replace(/\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    mobileAttunement.viewport[0] !== 390 ||
    mobileAttunement.viewport[1] !== 844 ||
    mobileAttunement.overflow ||
    !mobileAttunement.branchInside ||
    !mobileAttunement.buttonInside ||
    !mobileAttunement.pointerTarget ||
    !mobileAttunement.buttonText.includes('资源不足')
  ) {
    throw new Error(`390x844 attunement controls should wrap, explain disabled cost, and remain pointer-safe: ${JSON.stringify(mobileAttunement)}`);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 900
  });
  console.log('[smoke] real pointer protocol modal -> anchor -> Boss -> exit grants 1 imprint; attunement raises score/power and survives reload at 390x844');
}

async function getDeepProtocolSettlementSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const settlementElement = document.querySelector('[data-run-protocol="deep"][data-protocol-settlement]');
      return {
        phase: saved.phase,
        cycleImprint: saved.inventory.cycle_imprint,
        demonBone: saved.inventory.demon_bone,
        rewardPoints: saved.rewardPoints,
        settlement: saved.run?.lastProtocolSettlement,
        lastOutcome: saved.lastOutcome,
        settlementStatus: settlementElement?.dataset.protocolSettlement ?? '',
        settlementProtocol: settlementElement?.dataset.runProtocol ?? '',
        protocolBonus: Number(settlementElement?.dataset.protocolBonus ?? -1),
        imprintConsumed: settlementElement?.dataset.cycleImprintConsumed ?? '',
        materialReward: Number(settlementElement?.dataset.deepMaterialReward ?? -1),
        settlementText: settlementElement?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
}

async function runDeepProtocolPointerSmoke(cdp, appUrl) {
  await setViewport(cdp, 390, 844);
  await injectGameState(cdp, makeProtocolHubSave());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="open-protocol-demon_tower_1"]') &&
      document.querySelector('[data-cycle-imprint-count="0"]')`,
    'zero-token completed dungeon renders protocol entry'
  );
  const zeroTokenStorage = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  await clickElementByPointer(cdp, '[data-action="open-protocol-demon_tower_1"]');
  await waitForPage(cdp, `document.querySelector('[data-protocol-mode="deep"]:disabled')`, 'zero-token deep mode is disabled');
  await clickElementByPointer(cdp, '[data-protocol-mode="deep"]');
  await delay(100);
  const zeroTokenDeepAttempt = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        selectedProtocol: document.querySelector('[data-selected-protocol]')?.dataset.selectedProtocol,
        modalOpen: Boolean(document.querySelector('.protocol-modal')),
        phase: saved.phase,
        hasRun: Boolean(saved.run),
        cycleImprint: saved.inventory.cycle_imprint,
        storage: localStorage.getItem(${JSON.stringify(STORAGE_KEY)})
      };
    })()`
  );
  if (
    zeroTokenDeepAttempt.selectedProtocol !== 'standard' ||
    !zeroTokenDeepAttempt.modalOpen ||
    zeroTokenDeepAttempt.phase !== 'hub' ||
    zeroTokenDeepAttempt.hasRun ||
    zeroTokenDeepAttempt.cycleImprint !== 0 ||
    zeroTokenDeepAttempt.storage !== zeroTokenStorage
  ) {
    throw new Error(`Zero-token deep mode should stay disabled without entering or persisting: ${JSON.stringify(zeroTokenDeepAttempt)}`);
  }

  await injectGameState(cdp, makeDeepProtocolHubSave());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="open-protocol-demon_tower_1"]') &&
      document.querySelector('[data-cycle-imprint-count="1"]')`,
    'one-token completed dungeon renders deep protocol entry'
  );
  const storageBeforeModal = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);

  await clickElementByPointer(cdp, '[data-action="open-protocol-demon_tower_1"]');
  await waitForPage(cdp, `document.querySelector('[data-protocol-mode="deep"]:not(:disabled)')`, 'deep protocol mode is enabled');
  await clickElementByPointer(cdp, '[data-protocol-mode="deep"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-selected-protocol="deep"]') &&
      document.querySelector('[data-deep-material-reward="2"]')`,
    'deep protocol selection renders its briefing'
  );
  const deepModal = await evaluate(
    cdp,
    `(() => {
      const sheet = document.querySelector('.protocol-sheet');
      const deepMode = sheet?.querySelector('[data-protocol-mode="deep"]');
      const confirm = sheet?.querySelector('[data-action="confirm-protocol-entry"]');
      const anchors = [...(sheet?.querySelectorAll('[data-deep-anchor-id]') ?? [])];
      const costText = sheet?.querySelector('.protocol-deep-entry-cost')?.textContent.replace(/\\s+/g, ' ').trim() ?? '';
      const reward = sheet?.querySelector('[data-deep-material-reward]');
      return {
        selected: sheet?.querySelector('[data-selected-protocol]')?.dataset.selectedProtocol,
        deepPressed: deepMode?.getAttribute('aria-pressed'),
        deepDisabled: deepMode?.disabled ?? true,
        anchorIds: anchors.map((anchor) => anchor.dataset.deepAnchorId),
        anchorTexts: anchors.map((anchor) => anchor.textContent.replace(/\\s+/g, ' ').trim()),
        costText,
        materialReward: reward?.dataset.deepMaterialReward,
        rewardText: reward?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        confirmEnabled: Boolean(confirm && !confirm.disabled),
        storage: localStorage.getItem(${JSON.stringify(STORAGE_KEY)})
      };
    })()`
  );
  if (
    deepModal.selected !== 'deep' ||
    deepModal.deepPressed !== 'true' ||
    deepModal.deepDisabled ||
    JSON.stringify(deepModal.anchorIds) !== JSON.stringify(['risky_font_trap', 'hidden_stone_cache']) ||
    deepModal.anchorTexts.length !== 2 ||
    !deepModal.anchorTexts[0].includes('咒水井') ||
    !deepModal.anchorTexts[1].includes('阵石暗袋') ||
    !deepModal.costText.includes('1 轮回刻印') ||
    !deepModal.costText.includes('当前 1') ||
    deepModal.materialReward !== '2' ||
    !deepModal.rewardText.includes('妖骨 x2') ||
    !deepModal.confirmEnabled ||
    deepModal.storage !== storageBeforeModal
  ) {
    throw new Error(`Deep protocol modal should preview two anchors, one-token cost, and demon-bone x2 without persisting: ${JSON.stringify(deepModal)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.protocol-sheet',
    targetSelectors: [
      '[data-selected-protocol="deep"]',
      '.protocol-deep-entry-cost',
      '.protocol-deep-anchors',
      '[data-deep-material-reward="2"]',
      '.protocol-modal-actions'
    ],
    buttonSelectors: ['[data-action="confirm-protocol-entry"]'],
    minimumButtonHeight: 40,
    checkRootOverflow: true,
    label: 'mobile deep protocol modal'
  });
  const storageAfterDeepPreview = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  if (storageAfterDeepPreview !== storageBeforeModal) {
    throw new Error('Selecting and inspecting deep protocol should not persist before confirmation.');
  }

  await clickElementByPointer(cdp, '[data-action="confirm-protocol-entry"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.inventory.cycle_imprint === 0 &&
        saved.run?.protocol?.id === 'deep' && saved.run.protocol.rulesVersion === 1 &&
        document.querySelector('[data-run-protocol="deep"][data-protocol-anchor-count="0"][data-protocol-anchor-progress="0/2"]') &&
        document.querySelectorAll('[data-deep-protocol-anchor="true"]').length === 2;
    })()`,
    'deep confirmation consumes one token and freezes a 0/2 run'
  );
  const enteredDeepRun = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const status = document.querySelector('[data-run-protocol="deep"]');
      const anchors = [...document.querySelectorAll('[data-deep-protocol-anchor="true"]')];
      const map = document.querySelector('.dungeon-map')?.getBoundingClientRect();
      return {
        protocol: saved.run?.protocol,
        cycleImprint: saved.inventory.cycle_imprint,
        progress: status?.dataset.protocolAnchorProgress,
        statusText: status?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        anchorIds: anchors.map((anchor) => anchor.dataset.action?.replace('grid-', '')),
        anchorIndexes: anchors.map((anchor) => anchor.dataset.protocolAnchorIndex),
        anchorMarks: anchors.map((anchor) => anchor.querySelector('.protocol-anchor-mark')?.textContent.trim()),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        mapInside: Boolean(map && map.left >= 0 && map.right <= window.innerWidth)
      };
    })()`
  );
  if (
    JSON.stringify(enteredDeepRun.protocol) !== JSON.stringify({ id: 'deep', rulesVersion: 1 }) ||
    enteredDeepRun.cycleImprint !== 0 ||
    enteredDeepRun.progress !== '0/2' ||
    !enteredDeepRun.statusText.includes('双锚进度') ||
    JSON.stringify(enteredDeepRun.anchorIds) !== JSON.stringify(['risky_font_trap', 'hidden_stone_cache']) ||
    JSON.stringify(enteredDeepRun.anchorIndexes) !== JSON.stringify(['1', '2']) ||
    JSON.stringify(enteredDeepRun.anchorMarks) !== JSON.stringify(['深1', '深2']) ||
    enteredDeepRun.overflow ||
    !enteredDeepRun.mapInside
  ) {
    throw new Error(`Confirmed deep run should show an exact snapshot, 0/2 status, and two marked mobile anchors: ${JSON.stringify(enteredDeepRun)}`);
  }

  await setViewport(cdp, 1280, 900);
  for (const [index, expectedCount] of [[1, 1], [2, 2]]) {
    const label = `deep anchor ${index}`;
    const target = `[data-deep-protocol-anchor="true"][data-protocol-anchor-index="${index}"]`;
    await walkToUnresolvedNodeByPointer(cdp, target, `${label} route`, '.boss-node');
    await completeCurrentDeepAnchorByPointer(cdp, label);
    await waitForPage(
      cdp,
      `document.querySelector('[data-run-protocol="deep"][data-protocol-anchor-count="${expectedCount}"][data-protocol-anchor-progress="${expectedCount}/2"]') &&
        document.querySelectorAll('[data-deep-protocol-anchor="true"].cleared').length === ${expectedCount}`,
      `${label} advances deep progress to ${expectedCount}/2`
    );
  }

  await walkToUnresolvedNodeByPointer(cdp, '.boss-node', 'deep boss route');
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.boss-node:not(.cleared)') &&
      document.querySelector('[data-run-protocol="deep"][data-protocol-anchor-progress="2/2"]')`,
    'deep route reaches the boss only after both anchors'
  );
  await finishProtocolCombatByPointer(cdp, 'deep protocol boss');
  await waitForPage(cdp, `document.querySelector('.grid-node.current.boss-node.cleared')`, 'deep protocol boss clears');
  const beforeDeepExit = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        cycleImprint: saved.inventory.cycle_imprint,
        demonBone: saved.inventory.demon_bone,
        settlement: saved.run?.lastProtocolSettlement
      };
    })()`
  );
  if (beforeDeepExit.cycleImprint !== 0 || beforeDeepExit.settlement !== undefined) {
    throw new Error(`Deep entry token should remain spent and settlement should wait for the exit: ${JSON.stringify(beforeDeepExit)}`);
  }

  await walkToUnresolvedNodeByPointer(cdp, '.type-exit', 'deep exit route');
  await clickElementByPointer(cdp, '[data-action^="exit-current-"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const settlement = saved.run?.lastProtocolSettlement;
      return saved.phase === 'result' && saved.inventory.cycle_imprint === 0 &&
        settlement?.protocol?.id === 'deep' && settlement.status === 'succeeded' &&
        settlement.materialReward?.itemId === 'demon_bone' && settlement.materialReward.amount === 2 &&
        settlement.rewardPointBonus > 0 &&
        document.querySelector('[data-run-protocol="deep"][data-protocol-settlement="succeeded"][data-deep-material-reward="2"]');
    })()`,
    'deep exit grants material x2 and a positive protocol bonus without re-granting the token'
  );
  const settledDeepRun = await getDeepProtocolSettlementSnapshot(cdp);
  if (
    settledDeepRun.phase !== 'result' ||
    settledDeepRun.cycleImprint !== 0 ||
    settledDeepRun.demonBone !== beforeDeepExit.demonBone + 2 ||
    JSON.stringify(settledDeepRun.settlement?.protocol) !== JSON.stringify({ id: 'deep', rulesVersion: 1 }) ||
    settledDeepRun.settlement?.status !== 'succeeded' ||
    settledDeepRun.settlement?.bossDefeated !== true ||
    settledDeepRun.settlement?.anchorCompletedBeforeBoss !== true ||
    settledDeepRun.settlement?.cycleImprintGranted !== false ||
    settledDeepRun.settlement?.materialReward?.itemId !== 'demon_bone' ||
    settledDeepRun.settlement?.materialReward?.amount !== 2 ||
    !(settledDeepRun.settlement?.rewardPointBonus > 0) ||
    settledDeepRun.settlementStatus !== 'succeeded' ||
    settledDeepRun.settlementProtocol !== 'deep' ||
    settledDeepRun.protocolBonus !== settledDeepRun.settlement.rewardPointBonus ||
    settledDeepRun.imprintConsumed !== 'true' ||
    settledDeepRun.materialReward !== 2 ||
    !settledDeepRun.settlementText.includes('妖骨 +2') ||
    !settledDeepRun.lastOutcome?.includes('protocol=deep:succeeded') ||
    !settledDeepRun.lastOutcome.includes('anchors=2/2') ||
    !settledDeepRun.lastOutcome.includes('material=demon_bone:2')
  ) {
    throw new Error(`Deep settlement should preserve the spent token and grant exactly demon bone x2 plus bonus: ${JSON.stringify(settledDeepRun)}`);
  }

  for (let reload = 1; reload <= 2; reload += 1) {
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitForPage(
      cdp,
      `document.querySelector('[data-run-protocol="deep"][data-protocol-settlement="succeeded"][data-deep-material-reward="2"]')`,
      `deep settlement reload ${reload}`
    );
    const restored = await getDeepProtocolSettlementSnapshot(cdp);
    if (JSON.stringify(restored) !== JSON.stringify(settledDeepRun)) {
      throw new Error(`Deep settlement reload ${reload} should be persistent and idempotent: before=${JSON.stringify(settledDeepRun)} after=${JSON.stringify(restored)}`);
    }
  }

  if (await evaluate(cdp, `Boolean(document.querySelector('[data-relic-archive="skip"]:not(:disabled)'))`)) {
    await clickElementByPointer(cdp, '[data-relic-archive="skip"]');
    await waitForPage(cdp, `!document.querySelector('[data-relic-archive="skip"]')`, 'deep run relic archive skip resolves');
  }
  await clickButtonByPointer(cdp, '返回主神空间', '.result-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="open-protocol-demon_tower_1"]') &&
      document.querySelector('[data-cycle-imprint-count="0"]')`,
    'deep settlement returns to hub without restoring its entry token'
  );
  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'deep protocol smoke cleanup'
  );
  console.log('[smoke] deep protocol: zero-token guard, mobile modal, two real pointer anchors, Boss/exit settlement, x2 material, spent token, and idempotent reloads pass');
}

async function getTemperUiSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const card = document.querySelector('[data-equipment-id="starforged_edge"]');
      const temper = card?.querySelector('[data-equipment-temper="starforged_edge"]');
      const button = temper?.querySelector('button');
      const powerText = document.querySelector('.character-trigger')?.textContent ?? '';
      const powerNumbers = powerText.match(/[0-9]+/g) ?? [];
      return {
        rank: Number(temper?.dataset.temperRank ?? -1),
        nextRank: temper?.dataset.temperNextRank ?? '',
        eligible: temper?.dataset.temperEligible,
        text: temper?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        buttonDisabled: button?.disabled ?? true,
        buttonText: button?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        score: Number(card?.querySelector('[data-equipment-score]')?.dataset.equipmentScore ?? 0),
        power: Number(powerNumbers.at(-1) ?? 0),
        rewardPoints: saved.rewardPoints,
        lingyun: saved.lingyun,
        starIron: saved.inventory.star_iron,
        cycleImprint: saved.inventory.cycle_imprint,
        savedRank: saved.equipmentTemperRanks?.starforged_edge,
        attunement: saved.equipmentAttunements?.starforged_edge,
        hasLegacyFlag: Object.prototype.hasOwnProperty.call(saved.combat ?? {}, 'weaponSkillUsed')
      };
    })()`
  );
}

async function runEquipmentTemperPointerSmoke(cdp, appUrl) {
  const temperHub = makeProtocolHubSave();
  temperHub.rewardPoints = 5000;
  temperHub.lingyun = 10;
  temperHub.inventory.star_iron = 5;
  temperHub.inventory.cycle_imprint = 1;
  temperHub.equipmentAttunements = {};
  temperHub.log = ['equipment temper pointer smoke save'];
  await injectGameState(cdp, temperHub);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-equipment-temper="starforged_edge"][data-temper-rank="0"][data-temper-next-rank="1"]')`, 'rank-zero temper UI renders');

  const beforeRankOne = await getTemperUiSnapshot(cdp);
  if (
    beforeRankOne.rank !== 0 ||
    beforeRankOne.nextRank !== '1' ||
    beforeRankOne.eligible !== 'true' ||
    beforeRankOne.buttonDisabled ||
    !beforeRankOne.text.includes('0/2 · 未淬炼') ||
    !beforeRankOne.text.includes('星铁 · 持有 x5') ||
    !beforeRankOne.text.includes('精确消耗：300 奖励点 / 星铁 x1')
  ) {
    throw new Error(`Rank I temper should expose exact material, bonus, cost, and eligibility: ${JSON.stringify(beforeRankOne)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '[data-equipment-id="starforged_edge"]',
    targetSelectors: ['[data-equipment-id="starforged_edge"]', '[data-equipment-temper="starforged_edge"]'],
    buttonSelectors: ['[data-action="temper-starforged_edge"]'],
    label: 'desktop rank-one temper card'
  });
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '[data-equipment-id="starforged_edge"]',
    targetSelectors: ['[data-equipment-id="starforged_edge"]', '[data-equipment-temper="starforged_edge"]'],
    buttonSelectors: ['[data-action="temper-starforged_edge"]'],
    label: 'mobile rank-one temper card'
  });

  await clickElementByPointer(cdp, '[data-action="temper-starforged_edge"]');
  await waitForPage(cdp, `document.querySelector('[data-equipment-temper="starforged_edge"][data-temper-rank="1"][data-temper-next-rank="2"]')`, 'real pointer rank-one temper');
  const afterRankOne = await getTemperUiSnapshot(cdp);
  if (
    afterRankOne.savedRank !== 1 ||
    afterRankOne.rewardPoints !== beforeRankOne.rewardPoints - 300 ||
    afterRankOne.lingyun !== beforeRankOne.lingyun ||
    afterRankOne.starIron !== beforeRankOne.starIron - 1 ||
    afterRankOne.score <= beforeRankOne.score ||
    afterRankOne.power <= beforeRankOne.power ||
    !afterRankOne.buttonDisabled ||
    !afterRankOne.buttonText.includes('II 阶需先为本装备生效铭刻')
  ) {
    throw new Error(`Rank I temper should spend exact resources, raise score/power, and gate rank II on attunement: ${JSON.stringify({ beforeRankOne, afterRankOne })}`);
  }

  await clickCardButtonByPointer(
    cdp,
    '[data-equipment-id="starforged_edge"] .attunement-branch',
    '星炉重铸',
    '铭刻'
  );
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentAttunements?.starforged_edge === 'forge_overdrive' &&
      !document.querySelector('[data-action="temper-starforged_edge"]')?.disabled`,
    'valid attunement unlocks rank two temper'
  );
  const beforeRankTwo = await getTemperUiSnapshot(cdp);
  if (
    beforeRankTwo.attunement !== 'forge_overdrive' ||
    beforeRankTwo.buttonDisabled ||
    !beforeRankTwo.text.includes('精确消耗：500 奖励点 / 1 灵蕴 / 星铁 x2') ||
    !beforeRankTwo.text.includes('星铁 · 持有 x4')
  ) {
    throw new Error(`Attuned rank II temper should expose exact cost and owned material count: ${JSON.stringify(beforeRankTwo)}`);
  }

  await clickElementByPointer(cdp, '[data-action="temper-starforged_edge"]');
  await waitForPage(cdp, `document.querySelector('[data-equipment-temper="starforged_edge"][data-temper-rank="2"][data-temper-next-rank=""]')`, 'real pointer rank-two temper');
  const afterRankTwo = await getTemperUiSnapshot(cdp);
  if (
    afterRankTwo.savedRank !== 2 ||
    afterRankTwo.rewardPoints !== beforeRankTwo.rewardPoints - 500 ||
    afterRankTwo.lingyun !== beforeRankTwo.lingyun - 1 ||
    afterRankTwo.starIron !== beforeRankTwo.starIron - 2 ||
    afterRankTwo.score <= beforeRankTwo.score ||
    afterRankTwo.power <= beforeRankTwo.power ||
    !afterRankTwo.buttonDisabled ||
    !afterRankTwo.buttonText.includes('已达 II 阶上限') ||
    !afterRankTwo.text.includes('2/2 · II')
  ) {
    throw new Error(`Rank II temper should spend exact resources, increase stats, and disable at cap: ${JSON.stringify({ beforeRankTwo, afterRankTwo })}`);
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentTemperRanks?.starforged_edge === 2 &&
      document.querySelector('[data-equipment-temper="starforged_edge"][data-temper-rank="2"]')`,
    'rank two temper survives reload'
  );
  await clickButtonByPointer(cdp, '角色', '.topbar');
  await waitForPage(cdp, `document.querySelector('[data-loadout-equipment="starforged_edge"][data-temper-rank="2"]')?.textContent.includes('淬炼 2/2 · II')`, 'character loadout shows rank two temper');
  await clickDialogButton(cdp, '关闭');
  await setViewport(cdp, 1280, 900);
  console.log('[smoke] real pointer temper I -> valid attunement -> temper II spends exact resources, raises score/power, persists, and disables at cap on desktop/mobile');
}

async function getEquipmentCommissionSaveSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      if (!raw) {
        return {
          missingStorage: true,
          resourceText: document.querySelector('.resource-strip')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
          bodyMarker: document.body.textContent.includes('equipment commission pointer smoke save')
        };
      }
      const saved = JSON.parse(raw).state;
      return {
        phase: saved.phase,
        rewardPoints: saved.rewardPoints,
        lingyun: saved.lingyun,
        material: saved.inventory[${JSON.stringify(EQUIPMENT_COMMISSION_MATERIAL_ID)}],
        commission: saved.equipmentCommission ?? null,
        settlement: saved.run?.lastEquipmentCommissionSettlement ?? null,
        completedDungeonIds: saved.completedDungeonIds,
        equipmentLevels: ${JSON.stringify(EQUIPMENT_COMMISSION_EQUIPMENT_IDS)}.map(
          (equipmentId) => saved.equipmentLevels[equipmentId]
        )
      };
    })()`
  );
}

async function assertEquipmentCommissionGearUi(cdp, expectedSealed, label) {
  const cards = await evaluate(
    cdp,
    `(() => ${JSON.stringify(EQUIPMENT_COMMISSION_EQUIPMENT_IDS)}.map((equipmentId) => {
      const card = document.querySelector('[data-equipment-id="' + equipmentId + '"]');
      const equipAction = card?.querySelector('[data-action="equip-' + equipmentId + '"]');
      return {
        equipmentId,
        exists: Boolean(card),
        visible: Boolean(card?.getClientRects().length),
        sealed: card?.dataset.equipmentSealed,
        sealedClass: card?.classList.contains('is-equipment-sealed') ?? false,
        text: card?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        equipExists: Boolean(equipAction),
        equipDisabled: equipAction?.disabled ?? false,
        equipText: equipAction?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    }))()`
  );

  const invalid = cards.filter((card) =>
    !card.exists ||
    !card.visible ||
    !card.equipExists ||
    card.sealed !== String(expectedSealed) ||
    card.sealedClass !== expectedSealed ||
    card.equipDisabled !== expectedSealed ||
    (expectedSealed
      ? !card.text.includes('封存中') || !card.equipText.includes('封存中')
      : card.equipText.includes('封存中') || !card.equipText.includes('装备'))
  );
  if (invalid.length) {
    throw new Error(`${label} should render both equipment actions as ${expectedSealed ? 'visibly sealed and disabled' : 'unsealed and enabled'}: ${JSON.stringify(cards)}`);
  }
  return cards;
}

async function runEquipmentCommissionSmoke(cdp, appUrl) {
  let navigationSequence = 0;
  const navigateAndWaitForFreshDocument = async (expression, label) => {
    const marker = `equipment-commission-${++navigationSequence}`;
    await evaluate(
      cdp,
      `window.__equipmentCommissionSmokeNavigationMarker = ${JSON.stringify(marker)}`
    );
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `window.__equipmentCommissionSmokeNavigationMarker !== ${JSON.stringify(marker)} && (${expression})`,
      label
    );
  };

  await clickCardButtonByPointer(cdp, '.shop-card', '止血丹', '兑换');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null`, 'app-produced hub save fixture');
  await navigateAndWaitForFreshDocument(
    `document.querySelector('.resource-strip')`,
    'hub renders after app-produced save normalization reload'
  );
  const normalizedHubRaw = await evaluate(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
  if (!normalizedHubRaw) {
    throw new Error('A real pointer purchase produced a save that the app cleared on its first reload.');
  }
  const normalizedHubBase = JSON.parse(normalizedHubRaw).state;
  const startHub = makeEquipmentCommissionHubSave(normalizedHubBase);
  await injectGameState(cdp, startHub);
  await setViewport(cdp, 1440, 900);
  await navigateAndWaitForFreshDocument(
    `document.querySelector('[data-action="open-equipment-commission"]') &&
      document.querySelector('[data-equipment-id="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]}"]') &&
      document.querySelector('[data-equipment-id="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[1]}"]')`,
    'equipment commission start fixture renders'
  );

  const beforeStart = await getEquipmentCommissionSaveSnapshot(cdp);
  if (
    beforeStart.phase !== 'hub' ||
    beforeStart.rewardPoints !== EQUIPMENT_COMMISSION_START_RESOURCES.rewardPoints ||
    beforeStart.lingyun !== EQUIPMENT_COMMISSION_START_RESOURCES.lingyun ||
    beforeStart.material !== EQUIPMENT_COMMISSION_START_RESOURCES.material ||
    beforeStart.commission !== null
  ) {
    throw new Error(`Equipment commission start fixture should load unchanged: ${JSON.stringify(beforeStart)}`);
  }

  await clickElementByPointer(cdp, '[data-action="open-equipment-commission"]');
  await waitForPage(
    cdp,
    `document.querySelector('.equipment-commission-sheet[role="dialog"][aria-modal="true"] [data-equipment-commission-status="idle"]') &&
      document.querySelector('[data-commission-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]}"]') &&
      document.querySelector('[data-commission-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[1]}"]')`,
    'equipment commission idle modal opens through its pointer trigger'
  );
  for (const equipmentId of EQUIPMENT_COMMISSION_EQUIPMENT_IDS) {
    await clickElementByPointer(cdp, `[data-commission-equipment="${equipmentId}"]`);
    await waitForPage(
      cdp,
      `document.querySelector('[data-commission-equipment="${equipmentId}"]')?.getAttribute('aria-pressed') === 'true'`,
      `${equipmentId} commission row selects through a real pointer`
    );
  }
  await waitForPage(
    cdp,
    `document.querySelector('[data-commission-material="${EQUIPMENT_COMMISSION_MATERIAL_ID}"]')`,
    'commission material appears from the selected equipment'
  );
  await clickElementByPointer(cdp, `[data-commission-material="${EQUIPMENT_COMMISSION_MATERIAL_ID}"]`);
  await waitForPage(
    cdp,
    `document.querySelector('[data-commission-material="${EQUIPMENT_COMMISSION_MATERIAL_ID}"]')?.getAttribute('aria-pressed') === 'true' &&
      !document.querySelector('[data-action="start-equipment-commission"]')?.disabled`,
    'commission material selects and enables start'
  );
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.equipment-commission-sheet',
    targetSelectors: [
      '.equipment-commission-sheet',
      `[data-commission-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]}"]`,
      `[data-commission-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[1]}"]`,
      `[data-commission-material="${EQUIPMENT_COMMISSION_MATERIAL_ID}"]`,
      '.equipment-commission-footer'
    ],
    buttonSelectors: [
      `[data-commission-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]}"]`,
      `[data-commission-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[1]}"]`,
      `[data-commission-material="${EQUIPMENT_COMMISSION_MATERIAL_ID}"]`,
      '[data-action="start-equipment-commission"]'
    ],
    minimumButtonHeight: 40,
    checkRootOverflow: true,
    label: 'desktop equipment commission selection modal'
  });

  await clickElementByPointer(cdp, '[data-action="start-equipment-commission"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return document.querySelector('[data-equipment-commission-status="active"]') &&
        saved.equipmentCommission?.equipmentIds?.join(',') === ${JSON.stringify(EQUIPMENT_COMMISSION_EQUIPMENT_IDS.join(','))};
    })()`,
    'equipment commission starts through the real modal action'
  );
  const started = await getEquipmentCommissionSaveSnapshot(cdp);
  if (
    started.rewardPoints !== beforeStart.rewardPoints - 300 ||
    started.lingyun !== beforeStart.lingyun - 1 ||
    started.material !== beforeStart.material ||
    started.commission?.rulesVersion !== 1 ||
    JSON.stringify(started.commission?.equipmentIds) !== JSON.stringify(EQUIPMENT_COMMISSION_EQUIPMENT_IDS) ||
    started.commission?.targetMaterialId !== EQUIPMENT_COMMISSION_MATERIAL_ID ||
    started.commission?.completedDungeonIds?.length !== 0
  ) {
    throw new Error(`Starting a commission should deduct exactly 300 points and 1 lingyun while sealing the selected IDs: ${JSON.stringify({ beforeStart, started })}`);
  }

  await navigateAndWaitForFreshDocument(
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.equipmentCommission?.equipmentIds?.join(',') === ${JSON.stringify(EQUIPMENT_COMMISSION_EQUIPMENT_IDS.join(','))} &&
        saved.rewardPoints === ${started.rewardPoints} && saved.lingyun === ${started.lingyun} &&
        document.querySelector('[data-action="open-equipment-commission"]');
    })()`,
    'active equipment commission survives reload'
  );
  await clickElementByPointer(cdp, '[data-action="open-equipment-commission"]');
  await waitForPage(cdp, `document.querySelector('[data-equipment-commission-status="active"]')`, 'reloaded active commission modal');
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.equipment-commission-sheet',
    targetSelectors: [
      '.equipment-commission-sheet',
      `[data-commission-sealed-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]}"]`,
      `[data-commission-sealed-equipment="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[1]}"]`,
      '.equipment-commission-progress',
      '.equipment-commission-footer'
    ],
    buttonSelectors: ['[data-action="recall-equipment-commission"]'],
    minimumButtonHeight: 40,
    checkRootOverflow: true,
    label: 'mobile active equipment commission modal'
  });
  await clickElementByPointer(cdp, '[data-action="close-equipment-commission"]');
  await waitForPage(cdp, `!document.querySelector('.equipment-commission-sheet')`, 'close active commission modal before gear check');
  await assertEquipmentCommissionGearUi(cdp, true, 'Reloaded active commission');

  await clickElementByPointer(cdp, '[data-action="open-equipment-commission"]');
  await waitForPage(cdp, `document.querySelector('[data-action="recall-equipment-commission"]:not(:disabled)')`, 'hub recall action');
  await clickElementByPointer(cdp, '[data-action="recall-equipment-commission"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-commission-status="idle"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentCommission === undefined`,
    'pointer recall clears the active commission'
  );
  const recalled = await getEquipmentCommissionSaveSnapshot(cdp);
  if (
    recalled.commission !== null ||
    recalled.rewardPoints !== started.rewardPoints ||
    recalled.lingyun !== started.lingyun ||
    recalled.material !== started.material
  ) {
    throw new Error(`Recall should clear the commission without refunding or changing inventory: ${JSON.stringify({ started, recalled })}`);
  }
  await clickElementByPointer(cdp, '[data-action="close-equipment-commission"]');
  await waitForPage(cdp, `!document.querySelector('.equipment-commission-sheet')`, 'close recalled commission modal');
  await assertEquipmentCommissionGearUi(cdp, false, 'Recalled commission');

  await navigateAndWaitForFreshDocument(
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.equipmentCommission === undefined && saved.rewardPoints === ${started.rewardPoints} &&
        saved.lingyun === ${started.lingyun} && saved.inventory.${EQUIPMENT_COMMISSION_MATERIAL_ID} === ${started.material} &&
        document.querySelector('[data-equipment-id="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]}"]');
    })()`,
    'recall without refund survives reload'
  );
  await assertEquipmentCommissionGearUi(cdp, false, 'Reloaded recalled commission');

  const nearCompleteHub = makeEquipmentCommissionHubSave(normalizedHubBase, { nearComplete: true });
  await injectGameState(cdp, nearCompleteHub);
  await setViewport(cdp, 1440, 900);
  await navigateAndWaitForFreshDocument(
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'hub' &&
        saved.equipmentCommission?.completedDungeonIds?.join(',') === ${JSON.stringify(EQUIPMENT_COMMISSION_PRIOR_DUNGEON_IDS.join(','))} &&
        document.querySelector('[data-action="open-equipment-commission"]');
    })()`,
    'valid near-complete equipment commission fixture loads'
  );
  await clickElementByPointer(cdp, '[data-action="open-equipment-commission"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-commission-status="active"]')?.textContent.includes('2/3') &&
      document.querySelector('[data-equipment-commission-status="active"]')?.textContent.includes('镜潮地铁') &&
      document.querySelector('[data-equipment-commission-status="active"]')?.textContent.includes('星坠矿井')`,
    'near-complete commission renders two distinct exits'
  );
  await clickElementByPointer(cdp, '[data-action="close-equipment-commission"]');
  await waitForPage(cdp, `!document.querySelector('.equipment-commission-sheet')`, 'close near-complete commission modal');

  // Only the valid 2/3 hub fixture is injected; the third clear below uses real pointer route, combat, and exit actions.
  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '准备进入');
  await waitForPage(cdp, `document.querySelector('.protocol-sheet[role="dialog"]')`, 'simplified dungeon preparation opens');
  await clickDialogButton(cdp, '进入普通');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.dungeonId === 'demon_tower_1' &&
      document.querySelector('.dungeon-map')`,
    'equipment commission third distinct dungeon starts through its real card'
  );
  await walkProtocolRouteByPointer(
    cdp,
    '[data-boss-node="true"]',
    'equipment commission third distinct dungeon boss route'
  );
  await waitForPage(
    cdp,
    `document.querySelector('[data-boss-seal="cleared"]') && document.querySelector('.grid-node.current.boss-node.cleared')`,
    'equipment commission third distinct dungeon boss clears'
  );
  await walkProtocolRouteByPointer(
    cdp,
    '[data-action="grid-tower_exit"]',
    'equipment commission third distinct dungeon exit route'
  );
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="exit-current-tower_exit"]:not(:disabled)')`,
    'equipment commission third distinct exit is available'
  );
  await clickElementByPointer(cdp, '[data-action="exit-current-tower_exit"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-commission-settlement="completed"][data-equipment-commission-progress="3/3"]')`,
    'equipment commission completion settlement renders'
  );

  const completed = await getEquipmentCommissionSaveSnapshot(cdp);
  const expectedCompletedDungeonIds = [...EQUIPMENT_COMMISSION_PRIOR_DUNGEON_IDS, 'demon_tower_1'];
  if (
    completed.phase !== 'result' ||
    completed.commission !== null ||
    completed.material !== EQUIPMENT_COMMISSION_START_RESOURCES.material + 2 ||
    completed.settlement?.status !== 'completed' ||
    completed.settlement?.dungeonId !== 'demon_tower_1' ||
    completed.settlement?.targetMaterialId !== EQUIPMENT_COMMISSION_MATERIAL_ID ||
    completed.settlement?.rewardAmount !== 2 ||
    JSON.stringify(completed.settlement?.equipmentIds) !== JSON.stringify(EQUIPMENT_COMMISSION_EQUIPMENT_IDS) ||
    JSON.stringify(completed.settlement?.completedDungeonIds) !== JSON.stringify(expectedCompletedDungeonIds) ||
    completed.equipmentLevels.some((level) => level !== 3)
  ) {
    throw new Error(`Third distinct real exit should complete, grant material x2, remove the commission, and preserve gear: ${JSON.stringify(completed)}`);
  }

  await navigateAndWaitForFreshDocument(
    `document.querySelector('[data-equipment-commission-settlement="completed"][data-equipment-commission-progress="3/3"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.inventory.${EQUIPMENT_COMMISSION_MATERIAL_ID} === ${EQUIPMENT_COMMISSION_START_RESOURCES.material + 2}`,
    'completed equipment commission settlement and reward survive result reload'
  );
  await clickElementByPointer(cdp, '[data-action="return-hub"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'hub' && saved.equipmentCommission === undefined &&
        saved.inventory.${EQUIPMENT_COMMISSION_MATERIAL_ID} === ${EQUIPMENT_COMMISSION_START_RESOURCES.material + 2};
    })()`,
    'completed equipment commission returns to hub unsealed'
  );
  await assertEquipmentCommissionGearUi(cdp, false, 'Completed commission');
  await navigateAndWaitForFreshDocument(
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'hub' && saved.equipmentCommission === undefined &&
        saved.inventory.${EQUIPMENT_COMMISSION_MATERIAL_ID} === ${EQUIPMENT_COMMISSION_START_RESOURCES.material + 2} &&
        document.querySelector('[data-equipment-id="${EQUIPMENT_COMMISSION_EQUIPMENT_IDS[0]}"]');
    })()`,
    'completed commission hub state survives reload'
  );
  await assertEquipmentCommissionGearUi(cdp, false, 'Reloaded completed commission');

  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'equipment commission smoke cleanup'
  );
  await setViewport(cdp, 1440, 900);
  console.log('[smoke] equipment commission: desktop pointer start, exact cost/sealing/reload, mobile no-refund recall, and real third distinct exit completion pass');
}

async function runDungeonLawPointerSmoke(cdp, appUrl) {
  const hubState = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    log: ['dungeon law pointer smoke save']
  });
  hubState.phase = 'hub';
  delete hubState.run;
  await injectGameState(cdp, hubState);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.dungeon-card')`, 'dungeon law pointer hub renders');
  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '进入副本');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run?.lawState?.law?.fogPressure === 0 &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('妖雾压境') &&
        document.querySelectorAll('.grid-node.fog-frontier').length >= 1 &&
        document.querySelectorAll('.grid-node.fog-hidden').length >= 1 &&
        document.querySelector('.exploration-guide[data-guide-kind="node"]')?.dataset.guideActionTarget?.startsWith('fight-current-');
    })()`,
    'real dungeon entry renders initial law with hidden landmarks and current guidance'
  );
  const initialLaw = await evaluate(
    cdp,
    `(() => ({
      status: document.querySelector('.dungeon-law-status')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      landmarks: [...document.querySelectorAll('[data-law-landmark="true"]')].map((node) =>
        node.textContent.replace(/\\s+/g, ' ').trim()
      ),
      fogFrontier: document.querySelectorAll('.grid-node.fog-frontier').length,
      fogHidden: document.querySelectorAll('.grid-node.fog-hidden').length,
      fogSpoilers: document.querySelectorAll('.grid-node.fog-node[data-law-landmark="true"], .grid-node.fog-node .law-landmark-mark').length,
      guideTarget: document.querySelector('.exploration-guide')?.dataset.guideActionTarget ?? '',
      savedLaw: JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState
    }))()`
  );
  if (
    !initialLaw.status.includes('雾压 0/3') ||
    !initialLaw.status.includes('当前无数值修正') ||
    !initialLaw.status.includes('恢复地标可降压') ||
    initialLaw.landmarks.length !== 0 ||
    initialLaw.fogFrontier < 1 ||
    initialLaw.fogHidden < 1 ||
    initialLaw.fogSpoilers !== 0 ||
    !initialLaw.guideTarget.startsWith('fight-current-')
  ) {
    throw new Error(`Dungeon law entry UI should expose law state and guidance without leaking fogged landmarks: ${JSON.stringify(initialLaw)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.dungeon-law-status',
    targetSelectors: ['.dungeon-law-status', '.dungeon-map', '.node-action-panel'],
    buttonSelectors: ['[data-action="fight-current-fog_lesser_demon"]'],
    label: 'desktop dungeon law exploration'
  });
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.dungeon-law-status',
    targetSelectors: ['.dungeon-law-status', '.dungeon-map', '.node-action-panel'],
    buttonSelectors: ['[data-action="fight-current-fog_lesser_demon"]'],
    label: 'mobile dungeon law exploration'
  });

  await setViewport(cdp, 1440, 900);
  await clearCurrentMonsterByAttack(cdp, 'dungeon law first monster');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.lawState?.law?.fogPressure === 1 &&
        saved.run.lawState.clearedNodeIds.includes('fog_lesser_demon') &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('雾压 1/3');
    })()`,
    'real combat clear changes dungeon law'
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.lawState?.law?.fogPressure === 1 &&
      document.querySelector('.dungeon-law-status')?.textContent.includes('雾压 1/3')`,
    'changed dungeon law survives reload'
  );
  await setViewport(cdp, 1280, 900);
  console.log('[smoke] real pointer dungeon entry hides unexplored law landmarks, guides the current action, and persists fog pressure after combat');
}

async function runDirectionalRouteGatePointerSmoke(cdp, appUrl) {
  const makeGateState = (fogPressure) => {
    const lawState = makeDungeonLawState(
      'demon_tower_1',
      { kind: 'demon_tower', fogPressure },
      { clearedNodeIds: ['bone_lane_monster'] }
    );
    return makeExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'mist_herb_cache',
      clearedNodeIds: ['bone_lane_monster'],
      lawState,
      log: [`directional route gate fog ${fogPressure} smoke save`]
    });
  };

  await injectGameState(cdp, makeGateState(3));
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node[data-route-gate-id="demon_fog_bone_lane"][data-route-gate-status="closed"]:not(:disabled)') &&
      document.querySelector('.nearby-route-gate[data-route-gate-id="demon_fog_bone_lane"][data-route-gate-status="closed"]')`,
    'closed directional gate renders pointer-enabled'
  );
  const closedGate = await evaluate(
    cdp,
    `(() => {
      const node = document.querySelector('.grid-node[data-route-gate-id="demon_fog_bone_lane"]');
      const status = document.querySelector('.nearby-route-gate[data-route-gate-id="demon_fog_bone_lane"]');
      return {
        disabled: node?.disabled ?? true,
        nodeText: node?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        statusText: status?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        reason: status?.querySelector('span')?.textContent.trim() ?? ''
      };
    })()`
  );
  if (closedGate.disabled || !closedGate.nodeText.includes('门') || !closedGate.nodeText.includes('门禁关闭') || !closedGate.reason) {
    throw new Error(`Closed law gate should remain clickable and expose its reopening reason: ${JSON.stringify(closedGate)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.dungeon-map',
    targetSelectors: ['.dungeon-law-status', '.nearby-route-gates', '.dungeon-map'],
    buttonSelectors: ['.grid-node[data-route-gate-id="demon_fog_bone_lane"]'],
    label: 'desktop closed route gate'
  });
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.dungeon-map',
    targetSelectors: ['.dungeon-law-status', '.nearby-route-gates', '.dungeon-map'],
    buttonSelectors: ['.grid-node[data-route-gate-id="demon_fog_bone_lane"]'],
    label: 'mobile closed route gate'
  });

  await clickElementByPointer(cdp, '.grid-node[data-route-gate-id="demon_fog_bone_lane"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.currentNodeId === 'mist_herb_cache' &&
        document.querySelector('.nearby-route-gate')?.textContent.includes(${JSON.stringify(closedGate.reason)}) &&
        saved.log?.some((line) => line.includes(${JSON.stringify(closedGate.reason)}));
    })()`,
    'closed gate click keeps position and logs reason'
  );

  await injectGameState(cdp, makeGateState(1));
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node[data-route-gate-id="demon_fog_bone_lane"][data-route-gate-status="open"]:not(:disabled)')`,
    'same directional gate opens under valid law state'
  );
  await clickElementByPointer(cdp, '.grid-node[data-route-gate-id="demon_fog_bone_lane"]');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.currentNodeId === 'bone_lane_monster' &&
      document.querySelector('.grid-node.current')?.textContent.includes('骨巷塔卒')`,
    'open directional gate permits movement'
  );
  const reverse = await evaluate(
    cdp,
    `(() => {
      const node = document.querySelector('[data-action="grid-mist_herb_cache"]');
      return { disabled: node?.disabled ?? true, gateId: node?.dataset.routeGateId ?? '', text: node?.textContent ?? '' };
    })()`
  );
  if (reverse.disabled || reverse.gateId) {
    throw new Error(`Reverse retreat should remain clickable and ungated: ${JSON.stringify(reverse)}`);
  }
  await clickElementByPointer(cdp, '[data-action="grid-mist_herb_cache"]');
  await waitForPage(cdp, `document.querySelector('.grid-node.current')?.textContent.includes('雾草木匣')`, 'reverse retreat through directional gate');
  await setViewport(cdp, 1280, 900);
  console.log('[smoke] closed directional gate click preserves position and shows reason; the same open-law run crosses it and reverse retreat remains pointer-clickable');
}

async function runTemporalObservatoryPointerSmoke(cdp, appUrl) {
  const moveTo = async (nodeId, label) => {
    await clickElementByPointer(cdp, `[data-action="grid-${nodeId}"]`);
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.run?.currentNodeId === '${nodeId}' &&
          document.querySelector('.grid-node.current[data-action="grid-${nodeId}"]');
      })()`,
      label
    );
  };
  const claimReward = async (nodeId, label) => {
    await clickElementByPointer(cdp, `[data-action="reward-current-${nodeId}"]`);
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.run?.currentNodeId === '${nodeId}' && saved.run.clearedNodeIds.includes('${nodeId}') &&
          document.querySelector('.grid-node.current.cleared[data-action="grid-${nodeId}"]');
      })()`,
      label
    );
  };
  const clearTrap = async (nodeId, label) => {
    const actionId = await evaluate(
      cdp,
      `(() => {
        const counter = document.querySelector('[data-action="trap-counter-${nodeId}"]:not(:disabled)');
        const risk = document.querySelector('[data-action="trap-risk-${nodeId}"]:not(:disabled)');
        return (counter ?? risk)?.dataset.action ?? '';
      })()`
    );
    if (!actionId) throw new Error(`${label} has no enabled trap action`);
    await clickElementByPointer(cdp, `[data-action="${actionId}"]`);
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.run?.currentNodeId === '${nodeId}' && saved.run.clearedNodeIds.includes('${nodeId}') &&
          document.querySelector('.grid-node.current.cleared[data-action="grid-${nodeId}"]');
      })()`,
      label
    );
  };

  await injectGameState(cdp, makeTemporalObservatoryHubSave());
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      document.querySelector('.equipment-card[data-equipment-id="chronal_edge"]') &&
      [...document.querySelectorAll('.dungeon-card')].some((card) =>
        card.textContent.includes('时序观测庭') && card.textContent.includes('Tier 8') && card.textContent.includes('435')
      )`,
    'prepared temporal observatory hub renders'
  );
  const chronalCatalog = await evaluate(
    cdp,
    `(() => {
      const ids = ${JSON.stringify(CHRONAL_EQUIPMENT_IDS)};
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const cards = ids.map((equipmentId) => document.querySelector('[data-equipment-id="' + equipmentId + '"]'));
      const entrance = [...document.querySelectorAll('.dungeon-card')].find((card) => card.textContent.includes('时序观测庭'));
      return {
        cardCount: cards.filter(Boolean).length,
        cardTexts: cards.map(compactText),
        allSetTagged: cards.every((card) => compactText(card).includes('时序')),
        allBranchesVisible: cards.every((card) =>
          card?.querySelector('[data-attunement-id="chronal_acceleration"]') &&
          card?.querySelector('[data-attunement-id="chronal_stasis"]')
        ),
        hasWeaponSkill: Boolean(document.querySelector(
          '[data-equipment-id="chronal_edge"] [data-weapon-skill-id="chronal_reversal"][data-weapon-skill-name="时序逆转"]'
        )),
        hasActiveResonance: Boolean(document.querySelector(
          '[data-equipment-id="chronal_edge"] [data-weapon-resonance="equipment"][data-resonance-progress="3/3"][data-resonance-active="true"]'
        )),
        entranceText: compactText(entrance),
        entranceEnabled: !entrance?.querySelector('button')?.disabled,
        entranceHeading: compactText([...document.querySelectorAll('.panel-title h2')].find((heading) => heading.textContent.includes('轮回入口')))
      };
    })()`
  );
  if (
    chronalCatalog.cardCount !== CHRONAL_EQUIPMENT_IDS.length ||
    !chronalCatalog.allSetTagged ||
    !chronalCatalog.allBranchesVisible ||
    !chronalCatalog.hasWeaponSkill ||
    !chronalCatalog.hasActiveResonance ||
    !chronalCatalog.cardTexts.some((text) => text.includes('时序玻璃')) ||
    !chronalCatalog.entranceText.includes('Tier 8') ||
    !chronalCatalog.entranceText.includes('435 推荐战力') ||
    !chronalCatalog.entranceEnabled ||
    chronalCatalog.entranceHeading !== `${DUNGEON_COUNT}章轮回入口`
  ) {
    throw new Error(`Chronal catalog and Tier-8 entrance should render from the prepared save: ${JSON.stringify(chronalCatalog)}`);
  }

  await clickButtonByPointer(cdp, '角色', '.topbar');
  await waitForPage(
    cdp,
    `document.querySelector('.character-sheet')?.textContent.includes('时序玻璃') &&
      document.querySelector('.character-sheet')?.textContent.includes('时序')`,
    'chronal material and set render in the character sheet'
  );
  await clickElementByPointer(cdp, '.character-close');
  await waitForPage(cdp, `!document.querySelector('.character-sheet')`, 'chronal character sheet closes');

  await clickCardButtonByPointer(cdp, '.dungeon-card', '时序观测庭', '进入副本');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run?.dungeonId === 'temporal_observatory' &&
        saved.run.currentNodeId === 'temporal_gate' &&
        saved.run.lawState?.law?.kind === 'temporal_observatory' &&
        saved.run.lawState.law.pastCalibrated === false &&
        saved.run.lawState.law.futureCalibrated === false &&
        document.querySelectorAll('.dungeon-map > .grid-node').length === 30 &&
        document.querySelector('.dungeon-law-status[data-dungeon-law="temporal_observatory"]')?.textContent.includes('0/2 时序漂移');
    })()`,
    'temporal observatory entry initializes the dual-anchor law'
  );
  const temporalStory = await evaluate(
    cdp,
    `(() => ({
      story: document.querySelector('.lead-copy')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      law: document.querySelector('.dungeon-law-status')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      sectors: [...document.querySelectorAll('[data-route-sector]')].map((sector) =>
        sector.textContent.replace(/\\s+/g, ' ').trim()
      )
    }))()`
  );
  if (
    !temporalStory.story.includes('过去与未来在零点子午线上互相校准') ||
    !temporalStory.law.includes('时间校准') ||
    !temporalStory.law.includes('校准过去与未来两枚时序锚点') ||
    temporalStory.sectors.length < 3
  ) {
    throw new Error(`Temporal law, route sectors, and story should render together: ${JSON.stringify(temporalStory)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.dungeon-map',
    targetSelectors: ['.dungeon-law-status', '.route-sector-summary', '.lead-copy', '.dungeon-map', '.node-action-panel'],
    buttonSelectors: ['[data-action="reward-current-temporal_gate"]'],
    checkRootOverflow: true,
    label: 'desktop temporal law, story, and map'
  });
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.dungeon-map',
    targetSelectors: ['.dungeon-law-status', '.route-sector-summary', '.lead-copy', '.dungeon-map', '.node-action-panel'],
    buttonSelectors: ['[data-action="reward-current-temporal_gate"]'],
    checkRootOverflow: true,
    label: 'mobile temporal law, story, and map'
  });
  await setViewport(cdp, 1440, 900);

  await claimReward('temporal_gate', 'temporal gate reward claim');
  await moveTo('clockwork_scout', 'move to the clockwork scout');
  await finishTemporalCombatByPointer(cdp, 'clockwork_scout', 'clockwork scout');
  await moveTo('zero_meridian', 'move to the zero meridian');
  await clearTrap('zero_meridian', 'clear the zero meridian');
  await moveTo('calibration_bridge', 'move to the calibration bridge');
  await claimReward('calibration_bridge', 'claim the calibration bridge');

  await waitForPage(
    cdp,
    `document.querySelector('[data-action="grid-zero_hour_regent"][data-route-gate-id="temporal_calibration_bridge"][data-route-gate-status="closed"]:not(:disabled)') &&
      document.querySelector('.nearby-route-gate[data-route-gate-id="temporal_calibration_bridge"][data-route-gate-status="closed"]')`,
    'dual calibration gate is visibly closed before anchors'
  );
  await clickElementByPointer(cdp, '[data-action="grid-zero_hour_regent"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.currentNodeId === 'calibration_bridge' &&
        saved.log.some((line) => line.includes('过去与未来锚点均校准后开放'));
    })()`,
    'closed calibration gate rejects a real pointer move'
  );

  await moveTo('field_observation_deck', 'move to the field observation deck');
  await claimReward('field_observation_deck', 'claim the field observation deck');
  await moveTo('erased_patrol', 'move to the erased patrol');
  await finishTemporalCombatByPointer(cdp, 'erased_patrol', 'erased patrol');
  await moveTo('past_calibration_anchor', 'move to the past calibration anchor');
  await claimReward('past_calibration_anchor', 'claim the past calibration anchor');
  await waitForPage(
    cdp,
    `(() => {
      const law = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.lawState?.law;
      return law?.pastCalibrated === true && law?.futureCalibrated === false &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('1/2 单锚锁定');
    })()`,
    'past calibration anchor updates the law'
  );
  await moveTo('erased_patrol', 'return through the erased patrol');
  await moveTo('field_observation_deck', 'return through the field observation deck');
  await moveTo('calibration_bridge', 'return to the bridge after the past anchor');
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="grid-zero_hour_regent"][data-route-gate-status="closed"]')`,
    'one anchor keeps the dual gate closed'
  );

  await moveTo('zero_meridian', 'leave the bridge toward the future route');
  await moveTo('clockwork_scout', 'cross the cleared clockwork scout');
  await moveTo('temporal_gate', 'cross the cleared temporal gate');
  await moveTo('future_supply', 'move to the future supply');
  await claimReward('future_supply', 'claim the future supply');
  await moveTo('future_clue_cache', 'move to the future clue cache');
  await claimReward('future_clue_cache', 'claim the future clue cache');
  await moveTo('epoch_sentinel_omega', 'move to the terminal epoch sentinel');
  await finishTemporalCombatByPointer(cdp, 'epoch_sentinel_omega', 'terminal epoch sentinel');
  await moveTo('future_calibration_anchor', 'move to the future calibration anchor');
  await claimReward('future_calibration_anchor', 'claim the future calibration anchor');
  await waitForPage(
    cdp,
    `(() => {
      const law = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.lawState?.law;
      return law?.pastCalibrated === true && law?.futureCalibrated === true &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('2/2 双锚同步');
    })()`,
    'future calibration anchor completes the dual law'
  );
  await moveTo('epoch_sentinel_omega', 'return through the terminal epoch sentinel');
  await moveTo('future_clue_cache', 'return through the future clue cache');
  await moveTo('future_supply', 'return through the future supply');
  await moveTo('temporal_gate', 'return through the temporal gate');
  await moveTo('clockwork_scout', 'return to the zero line');
  await moveTo('zero_meridian', 'return through the zero meridian');
  await moveTo('calibration_bridge', 'return to the dual calibration bridge');
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="grid-zero_hour_regent"][data-route-gate-id="temporal_calibration_bridge"][data-route-gate-status="open"]:not(:disabled)') &&
      document.querySelector('.nearby-route-gate[data-route-gate-id="temporal_calibration_bridge"][data-route-gate-status="open"]')`,
    'dual calibration gate opens after both anchors'
  );

  await moveTo('zero_hour_regent', 'enter the zero-hour regent arena');
  const bossUsedChronalReversal = await finishTemporalCombatByPointer(cdp, 'zero_hour_regent', 'zero-hour regent');
  if (!bossUsedChronalReversal) {
    throw new Error('Zero-hour regent combat should charge and dispatch 时序逆转 through a real pointer action.');
  }
  await moveTo('boss_south_lock', 'move to the south time lock');
  await clearTrap('boss_south_lock', 'clear the south time lock');
  await moveTo('unborn_gear_trap', 'move to the unborn gear trap');
  await clearTrap('unborn_gear_trap', 'clear the unborn gear trap');
  await moveTo('observatory_exit', 'move to the observatory exit');
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="exit-current-observatory_exit"]:not(:disabled)') &&
      document.querySelector('.boss-seal-progress[data-boss-seal="cleared"]')`,
    'observatory exit is unsealed after the regent fight'
  );
  await clickElementByPointer(cdp, '[data-action="exit-current-observatory_exit"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' && saved.run?.dungeonId === 'temporal_observatory' &&
        saved.run.currentNodeId === 'observatory_exit' &&
        saved.completedDungeonIds.includes('temporal_observatory') &&
        (saved.run.lastLootSettlement?.retained?.items?.chronal_glass ?? 0) > 0 &&
        document.querySelector('.result-panel')?.textContent.includes('时序玻璃');
    })()`,
    'observatory exit settles chronal loot and Tier-8 completion'
  );

  await clickButtonByPointer(cdp, '返回主神空间', '.result-panel');
  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'temporal observatory smoke cleanup'
  );
  console.log('[smoke] temporal observatory: chronal catalog/save, blocked gate, both pointer-claimed anchors, dual gate, chronal skill boss fight, and exit settlement pass');
}

async function runCombatIntentPointerSmoke(cdp, appUrl) {
  const intentSave = makeCombatSave({
    dungeonId: 'starfall_mine',
    nodeId: 'spark_imp_roost',
    monsterId: 'spark_imp',
    monsterHp: 38,
    turn: 3,
    damageTakenAtStart: 0,
    inventory: { healing_pill: 4, thunder_talisman: 3 },
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    lawState: makeDungeonLawState('starfall_mine', { kind: 'starfall_mine', gravity: 'upward' }),
    combatLog: ['spark imp intent pointer smoke save'],
    log: ['spark imp intent pointer smoke save']
  });
  await injectGameState(cdp, intentSave);
  await setViewport(cdp, 390, 844);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-combat-intent="spark-burst"]')`, 'spark burst intent renders before action');
  const beforeGuard = await evaluate(
    cdp,
    `(() => {
      const intent = document.querySelector('.combat-intent');
      const guard = document.querySelector('[data-action="combat-guard"]');
      const attack = document.querySelector('[data-action="combat-attack"]');
      const law = document.querySelector('.dungeon-law-status');
      return {
        intentId: intent?.dataset.combatIntent,
        severity: intent?.dataset.intentSeverity,
        intentText: intent?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        guardCounter: guard?.classList.contains('intent-counter') ?? false,
        guardDisabled: guard?.disabled ?? true,
        attackRisk: attack?.classList.contains('intent-risk') ?? false,
        lawText: law?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    beforeGuard.intentId !== 'spark-burst' ||
    beforeGuard.severity !== 'danger' ||
    !beforeGuard.intentText.includes('敌方意图 · 危急') ||
    !beforeGuard.intentText.includes('追加 8 点爆发伤害') ||
    !beforeGuard.intentText.includes('推荐防御') ||
    !beforeGuard.guardCounter ||
    beforeGuard.guardDisabled ||
    !beforeGuard.attackRisk ||
    !beforeGuard.lawText.includes('重力极向') ||
    !beforeGuard.lawText.includes('敌方防御 +20%')
  ) {
    throw new Error(`Spark imp turn-three intent should advertise guard before the click: ${JSON.stringify(beforeGuard)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.combat-panel',
    targetSelectors: ['.dungeon-law-status', '.combat-intent', '.battlefield', '.combat-command-area', '.combat-log'],
    buttonSelectors: ['[data-action="combat-guard"]'],
    label: 'mobile combat law and intent'
  });
  await clickButtonByPointer(cdp, '防御', '.combat-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.combat?.turn === 4 && document.querySelector('[data-combat-intent="regular-pursuit"]');
    })()`,
    'real guard refreshes enemy intent'
  );
  const afterGuard = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const attack = document.querySelector('[data-action="combat-attack"]');
      return {
        turn: saved.combat?.turn,
        intentId: document.querySelector('.combat-intent')?.dataset.combatIntent,
        intentText: document.querySelector('.combat-intent')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        attackCounter: attack?.classList.contains('intent-counter') ?? false,
        attackRisk: attack?.classList.contains('intent-risk') ?? false,
        log: saved.combat?.log?.join(' ') ?? ''
      };
    })()`
  );
  if (
    afterGuard.turn !== 4 ||
    afterGuard.intentId !== 'regular-pursuit' ||
    !afterGuard.intentText.includes('常规追击') ||
    !afterGuard.attackCounter ||
    afterGuard.attackRisk ||
    !afterGuard.log.includes('跳火小鬼在第三回合爆出火星')
  ) {
    throw new Error(`Enemy intent should update immediately after the real guard: ${JSON.stringify(afterGuard)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.combat-panel',
    targetSelectors: ['.dungeon-law-status', '.combat-intent', '.battlefield', '.combat-command-area', '.combat-log'],
    buttonSelectors: ['[data-action="combat-attack"]'],
    label: 'desktop refreshed combat law and intent'
  });
  await setViewport(cdp, 1280, 900);
  console.log('[smoke] spark imp turn-three intent exposes guard counter before the pointer click and refreshes after defense');
}

async function runDreamArchiveLawPointerSmoke(cdp, appUrl) {
  const sealedLawState = makeDungeonLawState('dream_archive', {
    kind: 'dream_archive',
    sealedFeatures: ['consumable', 'method', 'pet']
  });
  const sealedCombat = makeCombatSave({
    dungeonId: 'dream_archive',
    nodeId: 'hallucination_patrol',
    monsterId: 'paper_librarian',
    monsterHp: 1,
    inventory: { healing_pill: 8, thunder_talisman: 6, focus_incense: 4 },
    player: {
      hp: 360,
      maxHp: 360,
      base: { body: 20, spirit: 20, agility: 20, luck: 10 }
    },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped: ADVANCED_EQUIPPED,
    learnedMethods: ['beast_taming', 'cloud_step', 'iron_body'],
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital', 'ash_arena'],
    ownedPets: ['ash_hound'],
    petLevels: { ash_hound: 3 },
    activePet: 'ash_hound',
    lawState: sealedLawState,
    combatLog: ['dream archive seal pointer smoke save'],
    log: ['dream archive seal pointer smoke save']
  });
  await injectGameState(cdp, sealedCombat);
  await setViewport(cdp, 390, 844);
  await cdp.send('Page.navigate', { url: appUrl });
  // This full-state mobile navigation can exceed the shared 6s render budget late in the smoke run.
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-law-status')?.textContent.includes('已封存 3/3') &&
      document.querySelector('[data-pet-availability="sealed"]')`,
    'dream archive sealed combat renders',
    12000
  );
  const sealedUi = await evaluate(
    cdp,
    `(() => {
      const button = (action) => document.querySelector('[data-action="combat-' + action + '"]');
      const text = (element) => element?.textContent.replace(/\\s+/g, ' ').trim() ?? '';
      return {
        attackDisabled: button('attack')?.disabled ?? true,
        guardDisabled: button('guard')?.disabled ?? true,
        artDisabled: button('art')?.disabled ?? false,
        artText: text(button('art')),
        pillDisabled: button('use_healing_pill')?.disabled ?? false,
        pillText: text(button('use_healing_pill')),
        talismanDisabled: button('use_thunder_talisman')?.disabled ?? false,
        talismanText: text(button('use_thunder_talisman')),
        petText: text(document.querySelector('[data-pet-availability="sealed"]')),
        lawText: text(document.querySelector('.dungeon-law-status'))
      };
    })()`
  );
  if (
    sealedUi.attackDisabled ||
    sealedUi.guardDisabled ||
    !sealedUi.artDisabled ||
    !sealedUi.artText.includes('梦档案馆已封存功法') ||
    !sealedUi.pillDisabled ||
    !sealedUi.pillText.includes('梦档案馆已封存消耗品') ||
    !sealedUi.talismanDisabled ||
    !sealedUi.talismanText.includes('梦档案馆已封存消耗品') ||
    !sealedUi.petText.includes('被封存') ||
    !sealedUi.lawText.includes('通过索引恢复全部封存')
  ) {
    throw new Error(`Dream archive seal UI should match real feature availability: ${JSON.stringify(sealedUi)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.combat-panel',
    targetSelectors: ['.dungeon-law-status', '.combat-intent', '.battlefield', '.combat-command-area', '.combat-log'],
    buttonSelectors: ['[data-action="combat-attack"]', '[data-action="combat-guard"]'],
    label: 'mobile dream archive sealed combat'
  });

  await clickButtonByPointer(cdp, '攻击', '.combat-panel');
  await waitForPage(
    cdp,
    `!document.querySelector('.combat-panel') && document.querySelector('.grid-node.current.cleared')`,
    'sealed archive combat clears with basic attack'
  );
  if (await evaluate(cdp, `Boolean(document.querySelector('.equipment-loot-offer'))`)) {
    await clickButtonByPointer(cdp, '放弃', '.node-action-panel');
    await waitForPage(cdp, `!document.querySelector('.equipment-loot-offer')`, 'archive combat loot offer resolves');
  }
  await walkProtocolRouteByPointer(cdp, '[data-action="grid-index_reward"]', 'dream archive index route');
  await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.lawState?.law?.sealedFeatures?.length === 0 &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('已封存 0/3');
    })()`,
    'index reward restores dream archive features'
  );
  await walkToUnresolvedNodeByPointer(cdp, '[data-action="grid-paper_librarian"]', 'dream archive restored combat route');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel')`, 'restored archive combat starts');
  const restoredUi = await evaluate(
    cdp,
    `(() => {
      const button = (action) => document.querySelector('[data-action="combat-' + action + '"]');
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        sealedFeatures: saved.run?.lawState?.law?.sealedFeatures,
        artEnabled: Boolean(button('art') && !button('art').disabled),
        pillEnabled: Boolean(button('use_healing_pill') && !button('use_healing_pill').disabled),
        talismanEnabled: Boolean(button('use_thunder_talisman') && !button('use_thunder_talisman').disabled),
        petAvailability: document.querySelector('.pet-token')?.dataset.petAvailability,
        petText: document.querySelector('.pet-token')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        lawText: document.querySelector('.dungeon-law-status')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    restoredUi.sealedFeatures?.length !== 0 ||
    !restoredUi.artEnabled ||
    !restoredUi.pillEnabled ||
    !restoredUi.talismanEnabled ||
    restoredUi.petAvailability !== 'available' ||
    restoredUi.petText.includes('被封存') ||
    !restoredUi.lawText.includes('已封存 0/3')
  ) {
    throw new Error(`Index reward should restore methods, consumables, and pet: ${JSON.stringify(restoredUi)}`);
  }
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.lawState?.law?.sealedFeatures?.length === 0 &&
      !document.querySelector('[data-action="combat-art"]')?.disabled &&
      document.querySelector('[data-pet-availability="available"]')`,
    'restored archive law survives reload'
  );
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.combat-panel',
    targetSelectors: ['.dungeon-law-status', '.combat-intent', '.battlefield', '.combat-command-area', '.combat-log'],
    buttonSelectors: ['[data-action="combat-art"]', '[data-action="combat-use_healing_pill"]'],
    label: 'desktop restored dream archive combat'
  });
  await setViewport(cdp, 1280, 900);
  console.log('[smoke] dream archive seals method/consumables/pet, while attack/guard work and the real index reward restores all three');
}

async function runWeaponResonancePointerSmoke(cdp, appUrl) {
  const resonanceHub = makeProtocolHubSave();
  resonanceHub.log = ['weapon resonance pointer smoke save'];
  resonanceHub.equipmentAttunements = { ...FORGE_RESONANCE_ATTUNEMENTS };
  await injectGameState(cdp, resonanceHub);
  await setViewport(cdp, 390, 844);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-id="starforged_edge"] [data-weapon-resonance="equipment"][data-resonance-progress="3/3"][data-resonance-active="true"]')`,
    'equipment resonance renders at full progress'
  );
  const equipmentResonance = await evaluate(
    cdp,
    `(() => {
      const card = document.querySelector('[data-equipment-id="starforged_edge"]');
      const resonance = card?.querySelector('[data-weapon-resonance="equipment"]');
      const score = card?.querySelector('[data-equipment-score]');
      return {
        progress: resonance?.dataset.resonanceProgress,
        active: resonance?.dataset.resonanceActive,
        text: resonance?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        scoreValue: score?.dataset.equipmentScore,
        scoreText: score?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    equipmentResonance.progress !== '3/3' ||
    equipmentResonance.active !== 'true' ||
    !equipmentResonance.text.includes('星炉重铸·同源共鸣') ||
    !equipmentResonance.text.includes('强化武器主动技的破甲或攻术合炼特色伤害') ||
    !equipmentResonance.scoreValue ||
    !equipmentResonance.scoreText.includes('评分')
  ) {
    throw new Error(`Equipped weapon card should keep rating and show active resonance: ${JSON.stringify(equipmentResonance)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '[data-equipment-id="starforged_edge"]',
    targetSelectors: ['[data-equipment-id="starforged_edge"]', '[data-weapon-resonance="equipment"]'],
    label: 'mobile equipment resonance'
  });
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '[data-equipment-id="starforged_edge"]',
    targetSelectors: ['[data-equipment-id="starforged_edge"]', '[data-weapon-resonance="equipment"]'],
    label: 'desktop equipment resonance'
  });

  await setViewport(cdp, 390, 844);
  await clickButtonByPointer(cdp, '角色', '.topbar');
  await waitForPage(
    cdp,
    `document.querySelector('.character-sheet [data-weapon-resonance="character"][data-resonance-progress="3/3"][data-resonance-active="true"]')`,
    'character sheet resonance renders'
  );
  const characterResonanceText = await evaluate(
    cdp,
    `document.querySelector('[data-weapon-resonance="character"]')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`
  );
  if (!characterResonanceText.includes('星炉重铸·同源共鸣') || !characterResonanceText.includes('3/3')) {
    throw new Error(`Character sheet should show current weapon resonance: ${characterResonanceText}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.character-sheet',
    targetSelectors: ['.character-sheet [data-weapon-resonance="character"]'],
    buttonSelectors: ['.character-sheet .character-close'],
    label: 'mobile character resonance'
  });
  await clickDialogButton(cdp, '关闭');

  const resonanceCombat = makeCombatSave({
    dungeonId: 'void_citadel',
    nodeId: 'main_god_echo',
    monsterId: 'main_god_echo',
    monsterHp: 1000,
    bossPhase: 'sealed',
    weaponFocus: 0,
    damageTakenAtStart: 0,
    inventory: { healing_pill: 10, thunder_talisman: 8 },
    player: {
      hp: 400,
      maxHp: 400,
      base: { body: 12, spirit: 12, agility: 12, luck: 8 }
    },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipmentAttunements: FORGE_RESONANCE_ATTUNEMENTS,
    equipped: ADVANCED_EQUIPPED,
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital', 'ash_arena', 'dream_archive'],
    lawState: makeDungeonLawState('void_citadel', {
      kind: 'void_citadel',
      bossAssessmentLocked: false,
      bossCounter: null
    }),
    combatLog: ['weapon focus pointer smoke save'],
    log: ['weapon focus pointer smoke save']
  });
  await injectGameState(cdp, resonanceCombat);
  await setViewport(cdp, 390, 844);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-weapon-focus-state="charging"][data-focus-current="0"][data-focus-max="3"]') &&
      document.querySelector('[data-action="combat-weapon_skill"]')?.disabled`,
    'combat empty focus renders'
  );
  const emptyFocus = await getWeaponSkillControlState(cdp);
  if (
    !emptyFocus.disabled ||
    emptyFocus.statusState !== 'charging' ||
    emptyFocus.weaponFocus !== 0 ||
    !emptyFocus.text.includes('战意未满（0/3）') ||
    emptyFocus.hasLegacyWeaponSkillUsed
  ) {
    throw new Error(`Injected advanced combat should start at explicit 0/3 focus: ${JSON.stringify(emptyFocus)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.combat-panel',
    targetSelectors: ['.dungeon-law-status', '.combat-intent', '.battlefield', '.weapon-skill-state', '.weapon-focus-meter', '.combat-actions'],
    buttonSelectors: ['[data-action="combat-guard"]'],
    label: 'mobile empty-focus resonant combat'
  });

  await clickButtonByPointer(cdp, '防御', '.combat-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat?.weaponFocus === 2 &&
      document.querySelector('[data-focus-current="2"]')`,
    'recommended guard charges focus by two'
  );
  const chargingHints = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const text = (selector) => document.querySelector(selector)?.textContent.replace(/\\s+/g, ' ').trim() ?? '';
      return {
        focus: saved.combat?.weaponFocus,
        guard: text('[data-action="combat-guard"]'),
        attack: text('[data-action="combat-attack"]'),
        skill: text('[data-action="combat-weapon_skill"]')
      };
    })()`
  );
  if (
    chargingHints.focus !== 2 ||
    !chargingHints.guard.includes('战意 +1') ||
    !chargingHints.attack.includes('战意 -1') ||
    !chargingHints.skill.includes('战意未满（2/3）')
  ) {
    throw new Error(`Focus projections should refresh from the pre-action intent at 2/3: ${JSON.stringify(chargingHints)}`);
  }

  await clickButtonByPointer(cdp, '防御', '.combat-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-weapon-focus-state="ready"][data-focus-current="3"]') &&
      !document.querySelector('[data-action="combat-weapon_skill"]')?.disabled`,
    'second recommended guard reaches ready focus'
  );
  const readyFocus = await getWeaponSkillControlState(cdp);
  if (
    readyFocus.weaponFocus !== 3 ||
    readyFocus.statusState !== 'ready' ||
    readyFocus.disabled ||
    !readyFocus.text.includes('消耗 3') ||
    !readyFocus.pointerTarget
  ) {
    throw new Error(`Focus should reach a pointer-ready 3/3 state: ${JSON.stringify(readyFocus)}`);
  }

  await clickElementByPointer(cdp, '[data-action="combat-weapon_skill"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.combat?.weaponFocus === 0 &&
        !Object.prototype.hasOwnProperty.call(saved.combat, 'weaponSkillUsed') &&
        document.querySelector('[data-weapon-focus-state="charging"][data-focus-current="0"]') &&
        document.querySelector('[data-action="combat-weapon_skill"]')?.disabled;
    })()`,
    'real pointer weapon skill consumes three focus'
  );
  const spentFocus = await getWeaponSkillControlState(cdp);
  if (
    spentFocus.weaponFocus !== 0 ||
    spentFocus.statusState !== 'charging' ||
    !spentFocus.disabled ||
    spentFocus.hasLegacyWeaponSkillUsed ||
    !(spentFocus.monsterHp < readyFocus.monsterHp) ||
    !spentFocus.combatLog.includes('星炉重铸将攻术合炼推至过载') ||
    Math.abs(spentFocus.buttonWidth - readyFocus.buttonWidth) > 1 ||
    Math.abs(spentFocus.buttonHeight - readyFocus.buttonHeight) > 1
  ) {
    throw new Error(`Pointer skill should consume focus without command layout shift: ${JSON.stringify({ readyFocus, spentFocus })}`);
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat?.weaponFocus === 0 &&
      document.querySelector('[data-action="combat-weapon_skill"]')?.disabled &&
      document.querySelector('[data-weapon-resonance="combat"][data-resonance-active="true"]')`,
    'consumed focus survives reload'
  );
  await clickButtonByPointer(cdp, '防御', '.combat-panel');
  await clickButtonByPointer(cdp, '防御', '.combat-panel');
  await waitForPage(cdp, `document.querySelector('[data-weapon-focus-state="ready"][data-focus-current="3"]')`, 'focus recharges after skill use');
  await assertResponsiveSurface(cdp, {
    width: 1440,
    height: 900,
    rootSelector: '.combat-panel',
    targetSelectors: ['.dungeon-law-status', '.combat-intent', '.battlefield', '.weapon-skill-state', '.weapon-focus-meter', '.combat-actions'],
    buttonSelectors: ['[data-action="combat-weapon_skill"]'],
    label: 'desktop recharged resonant weapon combat'
  });
  await setViewport(cdp, 1280, 900);
  console.log('[smoke] real pointer focus flows 0/3 -> 2/3 -> 3/3 -> skill -> 0/3 -> recharge, persists without the legacy flag, and keeps resonance/layout stable');
}

async function injectCloudStepCombatSave(cdp) {
  await injectGameState(
    cdp,
    makeCombatSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'fog_lesser_demon',
      monsterHp: 42,
      rewardPoints: 850,
      lingyun: 1,
      player: { hp: 92, maxHp: 92 },
      learnedMethods: ['cloud_step'],
      completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital', 'ash_arena'],
      combatLog: ['cloud step hint smoke save'],
      log: ['cloud step hint smoke save']
    })
  );
}

async function injectBadCombatNodeSave(cdp) {
  await injectGameState(
    cdp,
    makeCombatSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'sealed_cache',
      monsterId: 'fog_lesser_demon',
      monsterHp: 42,
      rewardPoints: 777,
      log: ['bad combat node smoke save'],
      combatLog: ['bad combat node smoke save']
    })
  );
}

async function injectBadBossPhaseSave(cdp) {
  await injectGameState(
    cdp,
    makeCombatSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'bone_lane_monster',
      monsterId: 'tower_butcher',
      monsterHp: 40,
      bossPhase: 'enraged',
      rewardPoints: 777,
      log: ['bad boss phase smoke save'],
      combatLog: ['bad boss phase smoke save']
    })
  );
}

async function injectBadWeaponSkillUsedSave(cdp) {
  await injectGameState(
    cdp,
    makeCombatSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'fog_lesser_demon',
      monsterHp: 40,
      weaponSkillUsed: 'yes',
      rewardPoints: 777,
      log: ['bad weapon skill used smoke save'],
      combatLog: ['bad weapon skill used smoke save']
    })
  );
}

async function runFocusAndTemperSaveValidationSmoke(cdp, appUrl) {
  for (const legacyValue of [true, false, undefined]) {
    const legacy = makeCombatSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'fog_lesser_demon',
      monsterHp: 1000,
      ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
      equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
      equipped: { ...ADVANCED_EQUIPPED, weapon: 'armor_piercing_sword' },
      log: [`legacy focus ${String(legacyValue)} smoke save`]
    });
    delete legacy.combat.weaponFocus;
    if (legacyValue !== undefined) legacy.combat.weaponSkillUsed = legacyValue;
    await injectGameState(cdp, legacy);
    await cdp.send('Page.navigate', { url: appUrl });
    const expectedFocus = legacyValue === true ? 0 : 3;
    await waitForPage(
      cdp,
      `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat?.weaponFocus === ${expectedFocus}`,
      `legacy focus ${String(legacyValue)} migrates`
    );
    const migrated = await evaluate(
      cdp,
      `(() => {
        const combat = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat;
        return {
          focus: combat.weaponFocus,
          hasLegacyFlag: Object.prototype.hasOwnProperty.call(combat, 'weaponSkillUsed'),
          uiState: document.querySelector('.weapon-skill-state')?.dataset.weaponSkillState
        };
      })()`
    );
    if (
      migrated.focus !== expectedFocus ||
      migrated.hasLegacyFlag ||
      migrated.uiState !== (expectedFocus === 3 ? 'ready' : 'charging')
    ) {
      throw new Error(`Legacy focus should migrate and drop weaponSkillUsed: ${JSON.stringify({ legacyValue, migrated })}`);
    }
  }

  const badFocus = makeCombatSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    monsterHp: 40,
    weaponFocus: 4,
    log: ['bad weapon focus smoke save']
  });
  await assertInjectedSaveResets(cdp, appUrl, badFocus, 'bad weapon focus smoke save', 'out-of-range weapon focus');

  const badRank = makeProtocolHubSave();
  badRank.log = ['bad temper rank smoke save'];
  badRank.equipmentTemperRanks = { starforged_edge: 0 };
  await assertInjectedSaveResets(cdp, appUrl, badRank, 'bad temper rank smoke save', 'zero equipment temper rank');

  const unattunedRankTwo = makeProtocolHubSave();
  unattunedRankTwo.log = ['bad unattuned rank two smoke save'];
  unattunedRankTwo.equipmentTemperRanks = { starforged_edge: 2 };
  await assertInjectedSaveResets(cdp, appUrl, unattunedRankTwo, 'bad unattuned rank two smoke save', 'unattuned rank two');
  console.log('[smoke] legacy focus migrates true->0 and false/missing->3, re-save drops the legacy flag, and malformed focus/temper ranks reset cleanly');
}

async function runMidgameCombatSmoke(cdp, appUrl) {
  await injectCombatSave(cdp, appUrl, {
    label: 'furnace judge repeated greedy attack',
    expectedText: '炉心裁判',
    dungeonId: 'ash_arena',
    nodeId: 'furnace_judge',
    monsterHp: 112,
    turn: 2,
    effects: { lastPlayerAction: 'attack' },
    player: {
      hp: 190,
      maxHp: 190,
      base: { body: 6, spirit: 5, agility: 4, luck: 2 }
    },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped: {
      ...ADVANCED_EQUIPPED,
      weapon: 'starforged_edge',
      armor: 'guardian_plate',
      charm: 'cloudstep_charm'
    },
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital'],
    ownedPets: ['ash_hound'],
    petLevels: { ash_hound: 3 },
    activePet: 'ash_hound',
    combatLog: ['furnace judge smoke save'],
    log: ['furnace judge smoke save']
  });
  await clickButton(cdp, '攻击');
  await assertCombatLogIncludes(
    cdp,
    ['助战灵宠牵制敌人', '炉庭判官记下重复动作', '炉庭判官惩戒贪攻'],
    'furnace judge repeated greedy attack'
  );
  await assertPageIncludes(cdp, ['烬火犬'], 'furnace judge active pet side panel');
  console.log('[smoke] furnace judge repeated greedy attack logs pet assist, repeat verdict, and greedy backlash');

  await injectCombatSave(cdp, appUrl, {
    label: 'pulse doctor void counters',
    expectedText: '脉冲医师',
    dungeonId: 'rust_hospital',
    nodeId: 'pulse_doctor',
    monsterHp: 100,
    turn: 3,
    player: {
      hp: 170,
      maxHp: 170,
      base: { body: 5, spirit: 5, agility: 3, luck: 2 }
    },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped: {
      ...ADVANCED_EQUIPPED,
      weapon: 'ember_staff',
      armor: 'spirit_robe',
      charm: 'void_lantern'
    },
    learnedMethods: ['void_heart'],
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine'],
    combatLog: ['pulse doctor smoke save'],
    log: ['pulse doctor smoke save']
  });
  await clickButton(cdp, '防御');
  await assertCombatLogIncludes(
    cdp,
    ['脉冲医师第三回合放出心律脉冲', '术法根基稳住心律', '虚界灯与虚心诀削弱了脉冲余波'],
    'pulse doctor third-turn pulse counters'
  );
  console.log('[smoke] pulse doctor third-turn pulse logs art-root and void counter mitigation');

  await injectCombatSave(cdp, appUrl, {
    label: 'main god echo copies artPower',
    expectedText: '主神残响',
    dungeonId: 'void_citadel',
    nodeId: 'main_god_echo',
    monsterHp: 260,
    turn: 1,
    player: {
      hp: 220,
      maxHp: 220,
      base: { body: 3, spirit: 12, agility: 2, luck: 2 }
    },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped: {
      ...ADVANCED_EQUIPPED,
      weapon: 'ember_staff',
      armor: 'spirit_robe',
      charm: 'void_lantern'
    },
    learnedMethods: ['gate_sense', 'star_core_method', 'void_heart'],
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital', 'ash_arena', 'dream_archive'],
    combatLog: ['main god echo smoke save'],
    log: ['main god echo smoke save']
  });
  await clickButtonByPointer(cdp, '功法', '.combat-actions');
  await assertCombatLogIncludes(cdp, ['主神残响复制了你的 artPower', '你运转灵力'], 'main god echo artPower copy');
  const echoCopiedStat = await evaluate(
    cdp,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.effects.echoCopiedStat)()`
  );
  if (echoCopiedStat !== 'artPower') {
    throw new Error(`main god echo should persist echoCopiedStat=artPower, got ${echoCopiedStat}`);
  }
  console.log('[smoke] main god echo copies artPower through the real art button and persists echoCopiedStat');

  await injectCombatSave(cdp, appUrl, {
    label: 'dream jailer talisman lock',
    expectedText: '梦牢看守',
    dungeonId: 'dream_archive',
    nodeId: 'dream_jailer',
    monsterHp: 126,
    turn: 1,
    inventory: { thunder_talisman: 1 },
    player: {
      hp: 150,
      maxHp: 150,
      base: { body: 4, spirit: 4, agility: 3, luck: 2 }
    },
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital', 'ash_arena'],
    combatLog: ['dream jailer talisman smoke save'],
    log: ['dream jailer talisman smoke save']
  });
  await clickButton(cdp, '雷火符');
  await assertCombatLogIncludes(cdp, ['梦狱看守封住符箓回路'], 'dream jailer talisman lock');
  const thunderButton = await getButtonState(cdp, '雷火符');
  if (!thunderButton.disabled || !thunderButton.text.includes('x0')) {
    throw new Error(`dream jailer talisman should leave 雷火符 disabled at x0, got ${JSON.stringify(thunderButton)}`);
  }
  console.log('[smoke] dream jailer locks talisman use and leaves 雷火符 at x0');

  await injectCombatSave(cdp, appUrl, {
    label: 'dream jailer pill backlash',
    expectedText: '梦牢看守',
    dungeonId: 'dream_archive',
    nodeId: 'dream_jailer',
    monsterHp: 126,
    turn: 1,
    inventory: { healing_pill: 1 },
    player: {
      hp: 90,
      maxHp: 168,
      base: { body: 5, spirit: 3, agility: 3, luck: 2 }
    },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped: {
      ...ADVANCED_EQUIPPED,
      weapon: 'training_blade',
      armor: 'guardian_plate',
      charm: 'plain_charm'
    },
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital', 'ash_arena'],
    combatLog: ['dream jailer pill smoke save'],
    log: ['dream jailer pill smoke save']
  });
  await clickButton(cdp, '止血丹');
  await assertCombatLogIncludes(cdp, ['你吞下止血丹', '消耗品被梦锁反噬'], 'dream jailer pill backlash combat log');
  await assertPageIncludes(cdp, ['止血丹争取到一回合喘息'], 'dream jailer pill backlash global log');
  console.log('[smoke] dream jailer pill path logs real heal, backlash, and global recovery note');

  await injectCombatSave(cdp, appUrl, {
    label: 'portal molt beast gate-sense pet lock',
    expectedText: '裂门蜕兽',
    dungeonId: 'starfall_mine',
    nodeId: 'rift_beast',
    monsterId: 'portal_molt_beast',
    monsterHp: 86,
    turn: 2,
    learnedMethods: ['gate_sense'],
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    ownedPets: ['ash_hound'],
    petLevels: { ash_hound: 1 },
    activePet: 'ash_hound',
    combatLog: ['portal molt beast smoke save'],
    log: ['portal molt beast smoke save']
  });
  await clickButton(cdp, '攻击');
  await assertCombatLogIncludes(
    cdp,
    ['助战灵宠牵制敌人', '裂隙被锁定，偏移没有生效'],
    'portal molt beast gate-sense lock'
  );
  await assertCombatLogExcludes(cdp, ['非符咒伤害被削弱'], 'portal molt beast gate-sense lock');
  console.log('[smoke] portal molt beast gate-sense pet assist locks the rift without non-talisman weakening');
}

const RUN_RELIC_EFFECT_TEXT = {
  mist_edge: '攻 +6',
  focus_prism: '开战战意 +1',
  hunter_clock: '战斗奖励 +20%',
  bone_shell: '防 +4',
  mending_thread: '奖励节点治疗 12',
  iron_echo: '陷阱减伤 25%',
  rift_step: '速 +4',
  gate_anchor: '传送反噬减伤 35%',
  lucky_map: '奖励节点点数 +20%'
};

function makeRelicHubSave(marker = 'run relic pointer smoke save') {
  const state = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    rewardPoints: 5000,
    lingyun: 10,
    inventory: {
      healing_pill: 6,
      dispel_talisman: 6,
      gate_sigil: 3
    },
    log: [marker]
  });
  state.phase = 'hub';
  state.preparedRelicFrame = 'assault';
  state.archivedRelicIds = [];
  delete state.preparedRelicSeedId;
  delete state.run;
  return state;
}

function attachRunRelicState(
  state,
  {
    frame = 'assault',
    seed,
    seedRelicId,
    acquiredIds = [],
    processedDraftIds = [],
    conduitEquipmentIds = []
  } = {}
) {
  if (!state.run) throw new Error('Run relic smoke fixture requires an active run.');
  state.preparedRelicFrame = frame;
  state.archivedRelicIds ??= [];
  state.run.relicState = {
    rulesVersion: 1,
    frame,
    ...(seed === undefined ? {} : { seed }),
    ...(seedRelicId === undefined ? {} : { seedRelicId }),
    acquiredIds: [...acquiredIds],
    processedDraftIds: [...processedDraftIds]
  };
  state.run.relicConduitSourceEquipmentIds = [...conduitEquipmentIds];
  delete state.run.lastRelicSettlement;
  return state;
}

async function getRelicHubSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = raw ? JSON.parse(raw).state : null;
      const root = document.querySelector('[data-relic-preparation="true"]');
      return {
        saved,
        selectedFrame: root?.dataset.selectedRelicFrame ?? '',
        candidateCount: Number(root?.dataset.relicCandidateCount ?? -1),
        selectedFrameButtons: [...(root?.querySelectorAll('[data-relic-frame].selected[aria-checked="true"]') ?? [])]
          .map((button) => button.dataset.relicFrame),
        seedIds: [...(root?.querySelectorAll('button[data-relic-seed]') ?? [])]
          .map((button) => button.dataset.relicSeed),
        selectedSeedIds: [...(root?.querySelectorAll('button[data-relic-seed][aria-pressed="true"]') ?? [])]
          .map((button) => button.dataset.relicSeed),
        conduitMatches: [...(root?.querySelectorAll('[data-relic-conduit-match]') ?? [])].map((row) => ({
          equipmentId: row.dataset.relicConduit,
          frame: row.dataset.relicConduitFrame,
          matched: row.dataset.relicConduitMatch
        }))
      };
    })()`
  );
}

async function assertRelicHubFrame(cdp, frame, candidateCount, matchingSeedId, label) {
  const snapshot = await getRelicHubSnapshot(cdp);
  const expectedSeedIds = ['none', ...(matchingSeedId ? [matchingSeedId] : [])].sort();
  const actualSeedIds = [...snapshot.seedIds].sort();
  if (
    snapshot.selectedFrame !== frame ||
    snapshot.saved?.preparedRelicFrame !== frame ||
    snapshot.candidateCount !== candidateCount ||
    snapshot.selectedFrameButtons.length !== 1 ||
    snapshot.selectedFrameButtons[0] !== frame ||
    JSON.stringify(actualSeedIds) !== JSON.stringify(expectedSeedIds)
  ) {
    throw new Error(`${label} should persist one selected frame, its candidate count, and only matching archive seeds: ${JSON.stringify(snapshot)}`);
  }
  return snapshot;
}

async function clickRelicFrameByPointer(cdp, frame, candidateCount, matchingSeedId, label) {
  await clickElementByPointer(cdp, `[data-relic-preparation="true"] [data-relic-frame="${frame}"]`);
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-preparation="true"]')?.dataset.selectedRelicFrame === ${JSON.stringify(frame)} &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.preparedRelicFrame === ${JSON.stringify(frame)}`,
    `${label} frame persists`
  );
  return assertRelicHubFrame(cdp, frame, candidateCount, matchingSeedId, label);
}

async function assertRelicPreparationLayouts(cdp, seedRelicId, label) {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '[data-relic-preparation="true"]',
      targetSelectors: [
        '[data-relic-preparation="true"]',
        '.relic-frame-segments',
        '.relic-preparation-layout',
        '.relic-seed-actions'
      ],
      buttonSelectors: [
        '[data-relic-frame="assault"]',
        '[data-relic-frame="bulwark"]',
        '[data-relic-frame="wayfinder"]',
        `[data-relic-seed="${seedRelicId}"]`
      ],
        minimumButtonHeight: 40,
      checkRootOverflow: true,
      label: `${label} ${width}x${height}`
    });
  }
}

async function getRunRelicSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = raw ? JSON.parse(raw).state : null;
      const root = document.querySelector('[data-run-relic-state]');
      const rewardAction = document.querySelector('[data-action="reward-current-watch_post_cache"]');
      return {
        saved,
        stateMode: root?.dataset.runRelicState ?? '',
        frame: root?.dataset.relicFrame ?? '',
        acquiredCount: Number(root?.dataset.runRelicAcquiredCount ?? -1),
        candidateCount: Number(root?.dataset.runRelicCandidateCount ?? -1),
        choiceIds: [...document.querySelectorAll('[data-relic-choice]')].map((button) => button.dataset.relicChoice),
        acquiredIds: [...document.querySelectorAll('[data-run-relic-acquired]')].map((item) => item.dataset.runRelicAcquired),
        frozenConduitIds: [...document.querySelectorAll('.run-relic-conduits [data-relic-conduit]')]
          .map((item) => item.dataset.relicConduit),
        effectText: document.querySelector('.run-relic-effects')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        routeLockText: document.querySelector('.route-lock-status')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        currentNodeText: document.querySelector('.grid-node.current')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        rewardActionExists: Boolean(rewardAction),
        rewardActionDisabled: rewardAction?.disabled ?? false,
        bodyText: document.body.textContent.replace(/\\s+/g, ' ').trim()
      };
    })()`
  );
}

async function assertRelicPendingRouteLocked(cdp, expectedCandidateCount, label) {
  const routeLock = await evaluate(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const status = document.querySelector('.route-lock-status');
      const blocked = [...document.querySelectorAll('.grid-node.route-blocked')];
      return {
        statusText: compactText(status),
        statusClientWidth: status?.clientWidth ?? 0,
        statusScrollWidth: status?.scrollWidth ?? 0,
        blockedCount: blocked.length,
        blockedAllDisabled: blocked.every((cell) => cell.disabled),
        blockedAllDescribed: blocked.every((cell) => cell.getAttribute('aria-describedby') === 'route-lock-reason'),
        enabledMovableCount: document.querySelectorAll('.grid-node.movable:not(:disabled)').length,
        candidateCount: document.querySelectorAll('[data-relic-choice]:not(:disabled)').length
      };
    })()`
  );
  if (
    !routeLock.statusText.includes('路线封锁') ||
    !routeLock.statusText.includes('先选择当前回响遗物') ||
    routeLock.blockedCount === 0 ||
    !routeLock.blockedAllDisabled ||
    !routeLock.blockedAllDescribed ||
    routeLock.enabledMovableCount !== 0 ||
    routeLock.candidateCount !== expectedCandidateCount ||
    routeLock.statusScrollWidth > routeLock.statusClientWidth + 1
  ) {
    throw new Error(`${label} should freeze every route move while keeping ${expectedCandidateCount} relic choices clickable: ${JSON.stringify(routeLock)}`);
  }
}

async function assertRewardActionConsumed(cdp, nodeId, label) {
  const actionState = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const action = document.querySelector(${JSON.stringify(`[data-action="reward-current-${nodeId}"]`)});
      return {
        exists: Boolean(action),
        disabled: action?.disabled ?? false,
        currentNodeId: saved.run?.currentNodeId,
        cleared: saved.run?.clearedNodeIds?.includes(${JSON.stringify(nodeId)}) ?? false
      };
    })()`
  );
  if (actionState.currentNodeId !== nodeId || !actionState.cleared || (actionState.exists && !actionState.disabled)) {
    throw new Error(`${label} should remove or disable the consumed reward action: ${JSON.stringify(actionState)}`);
  }
}

async function enterAndCollectFirstDemonTowerRelicDraft(cdp, expectedCandidateCount, label) {
  const entryMode = await evaluate(
    cdp,
    `(() => {
      const card = [...document.querySelectorAll('.dungeon-card')].find((candidate) =>
        candidate.textContent.includes('妖塔一层')
      );
      const button = [...(card?.querySelectorAll('button') ?? [])].find((candidate) => !candidate.disabled);
      return button?.textContent.includes('选择协议') ? 'protocol' : 'direct';
    })()`
  );
  if (entryMode === 'protocol') {
    await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '选择协议');
    await waitForPage(cdp, `document.querySelector('.protocol-sheet[role="dialog"]')`, `${label} protocol dialog opens`);
    await clickDialogButton(cdp, '确认标准探索');
  } else {
    await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '进入副本');
  }
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-state="active"]') &&
      document.querySelector('.grid-node.current')?.textContent.includes('雾中妖鬼')`,
    `${label} enters with a frozen relic run`
  );
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel')`, `${label} starting combat opens`);
  await finishActiveCombatByAttack(cdp, `${label} starting combat`);
  await assertRouteUnlocked(cdp, `${label} starting monster cleared`);

  await clickGridCell(cdp, '断符石盘');
  await waitForPage(cdp, `document.querySelector('.grid-node.current')?.textContent.includes('断符石盘')`, `${label} reaches route bridge`);
  await clickGridCell(cdp, '巡哨布袋');
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current')?.textContent.includes('巡哨布袋') &&
      document.querySelector('[data-action="reward-current-watch_post_cache"]:not(:disabled)')`,
    `${label} reaches the real relicDraftId reward node`
  );
  await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-candidate-count="${expectedCandidateCount}"]') &&
      document.querySelectorAll('[data-relic-choice]').length === ${expectedCandidateCount} &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.relicState.pendingDraft?.draftId === 'demon_tower_1:echo:1'`,
    `${label} opens ${expectedCandidateCount} real relic candidates`
  );

  const snapshot = await getRunRelicSnapshot(cdp);
  const pendingDraft = snapshot.saved?.run?.relicState?.pendingDraft;
  if (
    snapshot.stateMode !== 'active' ||
    snapshot.candidateCount !== expectedCandidateCount ||
    snapshot.choiceIds.length !== expectedCandidateCount ||
    pendingDraft?.draftId !== 'demon_tower_1:echo:1' ||
    pendingDraft?.nodeId !== 'watch_post_cache' ||
    JSON.stringify(snapshot.choiceIds) !== JSON.stringify(pendingDraft?.candidateIds) ||
    !snapshot.currentNodeText.includes('巡哨布袋')
  ) {
    throw new Error(`${label} should expose the saved draft through clickable UI choices: ${JSON.stringify(snapshot)}`);
  }
  return snapshot;
}

async function reloadPendingRelicDraft(cdp, appUrl, expectedCandidateIds, frame, conduitEquipmentIds, label) {
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelectorAll('[data-relic-choice]').length === ${expectedCandidateIds.length} &&
      document.querySelector('[data-run-relic-state="active"][data-relic-frame="${frame}"]')`,
    `${label} pending draft survives reload`
  );
  const reloaded = await getRunRelicSnapshot(cdp);
  if (
    JSON.stringify(reloaded.choiceIds) !== JSON.stringify(expectedCandidateIds) ||
    JSON.stringify(reloaded.saved?.run?.relicState?.pendingDraft?.candidateIds) !== JSON.stringify(expectedCandidateIds) ||
    JSON.stringify(reloaded.saved?.run?.relicConduitSourceEquipmentIds ?? []) !== JSON.stringify(conduitEquipmentIds) ||
    reloaded.frame !== frame
  ) {
    throw new Error(`${label} should preserve frame, conduit snapshot, and exact pending candidates across reload: ${JSON.stringify(reloaded)}`);
  }
  return reloaded;
}

async function chooseRunRelicByPointer(cdp, relicId, label) {
  await clickElementByPointer(cdp, `[data-relic-choice="${relicId}"]`);
  await waitForPage(
    cdp,
    `!document.querySelector('[data-relic-choice]') &&
      document.querySelector('[data-run-relic-acquired="${relicId}"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.relicState.acquiredIds.includes(${JSON.stringify(relicId)}) &&
      !JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.relicState.pendingDraft`,
    `${label} choice applies immediately`
  );
  const selected = await getRunRelicSnapshot(cdp);
  if (
    selected.acquiredCount !== 1 ||
    selected.acquiredIds.length !== 1 ||
    selected.acquiredIds[0] !== relicId ||
    selected.candidateCount !== 0 ||
    !selected.effectText.includes(RUN_RELIC_EFFECT_TEXT[relicId])
  ) {
    throw new Error(`${label} should immediately show the acquired relic and aggregate effect: ${JSON.stringify(selected)}`);
  }
  await assertRouteUnlocked(cdp, `${label} choice unlocks movement`);
  await assertRewardActionConsumed(cdp, 'watch_post_cache', `${label} first reward collection`);
  return selected;
}

async function assertPendingRelicLayouts(cdp, candidateIds, label) {
  const buttonSelectors = candidateIds.map((relicId) => `[data-relic-choice="${relicId}"]`);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '[data-run-relic-state="active"]',
      targetSelectors: [
        '[data-run-relic-state="active"]',
        '.relic-pending-draft',
        '.relic-draft-choices'
      ],
      buttonSelectors,
      minimumButtonHeight: 43.5,
      checkRootOverflow: true,
      label: `${label} ${width}x${height}`
    });
  }
}

async function assertPendingArchiveLayouts(cdp, relicId, label) {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '[data-relic-settlement="pending"]',
      targetSelectors: [
        '[data-relic-settlement="pending"]',
        '.relic-settlement-heading',
        '.relic-archive-actions'
      ],
      buttonSelectors: [
        `[data-relic-archive="${relicId}"]`,
        '[data-relic-archive="skip"]'
      ],
      minimumButtonHeight: 43.5,
      checkRootOverflow: true,
      label: `${label} ${width}x${height}`
    });
  }
}

async function assertLostRelicSettlement(cdp, label) {
  const settlement = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const root = document.querySelector('[data-relic-settlement="lost"]');
      const returnButton = [...document.querySelectorAll('.result-panel button')].find((button) =>
        button.textContent.includes('返回主神空间')
      );
      return {
        savedStatus: saved.run?.lastRelicSettlement?.status,
        rootText: root?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
        archiveButtonCount: document.querySelectorAll('[data-relic-archive]').length,
        returnEnabled: Boolean(returnButton && !returnButton.disabled)
      };
    })()`
  );
  if (
    settlement.savedStatus !== 'lost' ||
    !settlement.rootText.includes('本局遗物已遗失') ||
    settlement.archiveButtonCount !== 0 ||
    !settlement.returnEnabled
  ) {
    throw new Error(`${label} should show a non-archivable lost settlement: ${JSON.stringify(settlement)}`);
  }
}

function collectBrowserErrorEvents(cdp) {
  return cdp.events.flatMap((event) => {
    if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params?.exceptionDetails;
      return [`exception: ${details?.exception?.description ?? details?.text ?? 'unknown page exception'}`];
    }
    if (event.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(event.params?.type)) {
      const args = (event.params?.args ?? []).map((arg) => arg.value ?? arg.unserializableValue ?? arg.description ?? arg.type);
      return [`console.${event.params.type}: ${args.join(' ')}`];
    }
    if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') {
      return [`log.error: ${event.params.entry.text}`];
    }
    return [];
  });
}

async function resetRelicSmokeState(cdp, appUrl) {
  await evaluate(
    cdp,
    `(() => {
      localStorage.removeItem(${JSON.stringify(STORAGE_KEY)});
      return true;
    })()`
  );
  await setViewport(cdp, 1280, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelector('[data-relic-preparation="true"][data-selected-relic-frame="assault"][data-relic-candidate-count="2"]') &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'run relic smoke restores a clean new game'
  );
}

async function runRelicPreparationAndOrdinarySmoke(cdp, appUrl) {
  const hub = makeRelicHubSave('relic preparation and ordinary draft pointer smoke save');
  hub.preparedRelicFrame = 'wayfinder';
  hub.archivedRelicIds = ['mist_edge', 'bone_shell', 'rift_step'];
  await injectGameState(cdp, hub);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-preparation="true"][data-selected-relic-frame="wayfinder"]')`,
    'relic preparation hub renders'
  );
  await assertRelicHubFrame(cdp, 'wayfinder', 2, 'rift_step', 'initial wayfinder preparation');
  await assertRelicPreparationLayouts(cdp, 'rift_step', 'relic preparation');
  await setViewport(cdp, 1440, 900);

  const matchingSeeds = {
    assault: 'mist_edge',
    bulwark: 'bone_shell',
    wayfinder: 'rift_step'
  };
  for (const frame of ['assault', 'bulwark', 'wayfinder']) {
    await clickRelicFrameByPointer(cdp, frame, 2, matchingSeeds[frame], `real pointer ${frame} preparation`);
  }
  await clickRelicFrameByPointer(cdp, 'assault', 2, 'mist_edge', 'ordinary assault preparation');

  await clickElementByPointer(cdp, '[data-relic-preparation="true"] [data-relic-seed="mist_edge"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-seed="mist_edge"][aria-pressed="true"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.preparedRelicSeedId === 'mist_edge'`,
    'archive seed selection persists'
  );
  let seedSnapshot = await assertRelicHubFrame(cdp, 'assault', 2, 'mist_edge', 'selected archive seed');
  if (JSON.stringify(seedSnapshot.selectedSeedIds) !== JSON.stringify(['mist_edge'])) {
    throw new Error(`Archive seed selection should be unique: ${JSON.stringify(seedSnapshot)}`);
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-seed="mist_edge"][aria-pressed="true"]')`,
    'archive seed survives reload'
  );
  seedSnapshot = await assertRelicHubFrame(cdp, 'assault', 2, 'mist_edge', 'reloaded archive seed');
  if (seedSnapshot.saved?.preparedRelicSeedId !== 'mist_edge') {
    throw new Error(`Reloaded archive seed should remain persisted: ${JSON.stringify(seedSnapshot)}`);
  }

  await clickElementByPointer(cdp, '[data-relic-preparation="true"] [data-relic-seed="none"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-seed="none"][aria-pressed="true"]') &&
      !JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.preparedRelicSeedId`,
    'archive seed clears through pointer'
  );
  const clearedSeed = await assertRelicHubFrame(cdp, 'assault', 2, 'mist_edge', 'cleared archive seed');
  if (JSON.stringify(clearedSeed.selectedSeedIds) !== JSON.stringify(['none'])) {
    throw new Error(`Cleared archive seed should select only the no-seed control: ${JSON.stringify(clearedSeed)}`);
  }

  const ordinary = await enterAndCollectFirstDemonTowerRelicDraft(cdp, 2, 'ordinary relic draft');
  if ((ordinary.saved?.run?.relicConduitSourceEquipmentIds ?? []).length !== 0) {
    throw new Error(`Ordinary relic draft should not freeze an equipment conduit: ${JSON.stringify(ordinary)}`);
  }
  await assertRelicPendingRouteLocked(cdp, 2, 'ordinary relic draft');
  const ordinaryCandidateIds = [...ordinary.choiceIds];
  await reloadPendingRelicDraft(cdp, appUrl, ordinaryCandidateIds, 'assault', [], 'ordinary relic draft');
  await assertRelicPendingRouteLocked(cdp, 2, 'reloaded ordinary relic draft');

  const selectedRelicId = ordinaryCandidateIds[0];
  await chooseRunRelicByPointer(cdp, selectedRelicId, 'ordinary relic draft');
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-acquired="${selectedRelicId}"]') &&
      !document.querySelector('[data-relic-choice]')`,
    'ordinary relic choice survives reload'
  );
  const reloadedChoice = await getRunRelicSnapshot(cdp);
  if (
    reloadedChoice.frame !== 'assault' ||
    reloadedChoice.saved?.run?.relicState?.pendingDraft ||
    JSON.stringify(reloadedChoice.saved?.run?.relicState?.acquiredIds) !== JSON.stringify([selectedRelicId]) ||
    !reloadedChoice.saved?.run?.relicState?.processedDraftIds.includes('demon_tower_1:echo:1') ||
    !reloadedChoice.effectText.includes(RUN_RELIC_EFFECT_TEXT[selectedRelicId])
  ) {
    throw new Error(`Ordinary relic choice should preserve its frame, result, and effect across reload: ${JSON.stringify(reloadedChoice)}`);
  }
  await assertRouteUnlocked(cdp, 'reloaded ordinary relic choice');
  await assertRewardActionConsumed(cdp, 'watch_post_cache', 'reloaded ordinary relic choice');
}

async function runRelicConduitSmoke(cdp, appUrl) {
  const hub = makeRelicHubSave('level-two matching relic conduit pointer smoke save');
  hub.preparedRelicFrame = 'bulwark';
  hub.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, 'armor_piercing_sword'];
  hub.equipmentLevels = {
    ...BASIC_EQUIPMENT_LEVELS,
    armor_piercing_sword: 2
  };
  hub.equipped = {
    ...BASIC_EQUIPPED,
    weapon: 'armor_piercing_sword'
  };
  await injectGameState(cdp, hub);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-preparation="true"][data-selected-relic-frame="bulwark"]') &&
      document.querySelector('[data-relic-conduit="armor_piercing_sword"][data-relic-conduit-match="false"]')`,
    'level-two conduit hub renders unmatched'
  );
  let conduitHub = await assertRelicHubFrame(cdp, 'bulwark', 2, undefined, 'unmatched level-two conduit');
  if (
    conduitHub.saved?.equipmentLevels?.armor_piercing_sword !== 2 ||
    conduitHub.saved?.equipped?.weapon !== 'armor_piercing_sword' ||
    !conduitHub.saved?.ownedEquipment?.includes('armor_piercing_sword')
  ) {
    throw new Error(`Matching conduit precondition should remain a real owned, equipped level-two item: ${JSON.stringify(conduitHub)}`);
  }

  conduitHub = await clickRelicFrameByPointer(cdp, 'assault', 3, undefined, 'matching level-two conduit');
  const matchingRow = conduitHub.conduitMatches.find((row) => row.equipmentId === 'armor_piercing_sword');
  if (matchingRow?.frame !== 'assault' || matchingRow?.matched !== 'true') {
    throw new Error(`Assault preparation should visibly match the equipped level-two conduit: ${JSON.stringify(conduitHub)}`);
  }

  const conduitDraft = await enterAndCollectFirstDemonTowerRelicDraft(cdp, 3, 'matching conduit relic draft');
  const expectedAssaultRelics = ['focus_prism', 'hunter_clock', 'mist_edge'];
  if (
    JSON.stringify([...conduitDraft.choiceIds].sort()) !== JSON.stringify(expectedAssaultRelics) ||
    JSON.stringify(conduitDraft.saved?.run?.relicConduitSourceEquipmentIds) !== JSON.stringify(['armor_piercing_sword']) ||
    JSON.stringify(conduitDraft.frozenConduitIds) !== JSON.stringify(['armor_piercing_sword']) ||
    !conduitDraft.bodyText.includes('冻结导管') ||
    !conduitDraft.bodyText.includes('候选 3')
  ) {
    throw new Error(`Matching conduit should freeze visibly and expose all three clickable assault relics: ${JSON.stringify(conduitDraft)}`);
  }
  await assertRelicPendingRouteLocked(cdp, 3, 'matching conduit relic draft');
  await assertPendingRelicLayouts(cdp, conduitDraft.choiceIds, 'matching conduit pending draft');

  const reloaded = await reloadPendingRelicDraft(
    cdp,
    appUrl,
    conduitDraft.choiceIds,
    'assault',
    ['armor_piercing_sword'],
    'matching conduit relic draft'
  );
  if (JSON.stringify(reloaded.frozenConduitIds) !== JSON.stringify(['armor_piercing_sword'])) {
    throw new Error(`Reloaded conduit draft should keep its frozen source visible: ${JSON.stringify(reloaded)}`);
  }
  await assertRelicPendingRouteLocked(cdp, 3, 'reloaded matching conduit relic draft');
  await chooseRunRelicByPointer(cdp, conduitDraft.choiceIds[0], 'matching conduit relic draft');
  await setViewport(cdp, 1440, 900);
}

async function runRelicArchiveSeedSmoke(cdp, appUrl) {
  const nearClear = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'tower_exit',
    rewardPoints: 2400,
    lingyun: 4,
    clearedNodeIds: ['bone_lane_monster'],
    log: ['near-clear relic archive pointer smoke save']
  });
  nearClear.archivedRelicIds = [];
  attachRunRelicState(nearClear, {
    frame: 'assault',
    seed: 173,
    acquiredIds: ['mist_edge'],
    processedDraftIds: ['demon_tower_1:echo:1']
  });
  await injectGameState(cdp, nearClear);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-acquired="mist_edge"]') &&
      document.querySelector('[data-action="exit-current-tower_exit"]:not(:disabled)')`,
    'near-clear relic archive save renders at the unsealed exit'
  );

  await clickButtonByPointer(cdp, '完成副本', '.node-action-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-settlement="pending"]') &&
      document.querySelector('[data-relic-archive="mist_edge"]:not(:disabled)') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lastRelicSettlement.status === 'pending'`,
    'cleared run exposes pending relic archive'
  );
  await assertPendingArchiveLayouts(cdp, 'mist_edge', 'pending relic archive');

  await clickElementByPointer(cdp, '[data-relic-archive="mist_edge"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-settlement="archived"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lastRelicSettlement.archivedRelicId === 'mist_edge'`,
    'real pointer archives the selected relic'
  );
  let archived = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        settlement: saved.run?.lastRelicSettlement,
        frame: saved.preparedRelicFrame,
        archivedRelicIds: saved.archivedRelicIds,
        seedRelicId: saved.preparedRelicSeedId,
        text: document.querySelector('[data-relic-settlement="archived"]')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    archived.settlement?.status !== 'archived' ||
    archived.settlement?.archivedRelicId !== 'mist_edge' ||
    archived.frame !== 'assault' ||
    JSON.stringify(archived.archivedRelicIds) !== JSON.stringify(['mist_edge']) ||
    archived.seedRelicId !== 'mist_edge' ||
    !archived.text.includes('已归档')
  ) {
    throw new Error(`Archive selection should update settlement and hub preparation atomically: ${JSON.stringify(archived)}`);
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-relic-settlement="archived"]')`, 'archived settlement survives reload');
  archived = await evaluate(
    cdp,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state)()`
  );
  if (
    archived.run?.lastRelicSettlement?.archivedRelicId !== 'mist_edge' ||
    archived.preparedRelicSeedId !== 'mist_edge' ||
    !archived.archivedRelicIds?.includes('mist_edge')
  ) {
    throw new Error(`Archived settlement, archive list, and seed should survive result reload: ${JSON.stringify(archived)}`);
  }

  await clickButtonByPointer(cdp, '返回主神空间', '.result-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-preparation="true"][data-selected-relic-frame="assault"]') &&
      document.querySelector('[data-relic-seed="mist_edge"][aria-pressed="true"]')`,
    'archived relic returns to hub as selected seed'
  );
  let seededHub = await assertRelicHubFrame(cdp, 'assault', 2, 'mist_edge', 'archived seed hub');
  if (JSON.stringify(seededHub.selectedSeedIds) !== JSON.stringify(['mist_edge'])) {
    throw new Error(`Returned hub should visibly select the archived seed: ${JSON.stringify(seededHub)}`);
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-relic-seed="mist_edge"][aria-pressed="true"]')`, 'hub archive seed survives reload');
  seededHub = await assertRelicHubFrame(cdp, 'assault', 2, 'mist_edge', 'reloaded archived seed hub');
  if (seededHub.saved?.preparedRelicSeedId !== 'mist_edge') {
    throw new Error(`Reloaded hub should preserve the selected archive seed: ${JSON.stringify(seededHub)}`);
  }

  const seededDraft = await enterAndCollectFirstDemonTowerRelicDraft(cdp, 2, 'seeded next run relic draft');
  if (
    seededDraft.saved?.run?.relicState?.seedRelicId !== 'mist_edge' ||
    seededDraft.choiceIds[0] !== 'mist_edge' ||
    seededDraft.saved?.run?.relicState?.pendingDraft?.candidateIds?.[0] !== 'mist_edge'
  ) {
    throw new Error(`Next same-frame first draft should place the archived seed first: ${JSON.stringify(seededDraft)}`);
  }
  await assertRelicPendingRouteLocked(cdp, 2, 'seeded next run relic draft');
}

async function runRelicLostSettlementSmoke(cdp, appUrl) {
  const retreat = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'sealed_cache',
    rewardPoints: 1600,
    log: ['relic retreat lost pointer smoke save']
  });
  attachRunRelicState(retreat, {
    frame: 'assault',
    seed: 211,
    acquiredIds: ['focus_prism'],
    processedDraftIds: ['demon_tower_1:echo:1']
  });
  await injectGameState(cdp, retreat);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-acquired="focus_prism"]') &&
      [...document.querySelectorAll('button')].some((button) => !button.disabled && button.textContent.includes('撤回主神空间'))`,
    'relic retreat precondition renders'
  );
  await clickButtonByPointer(cdp, '撤回主神空间');
  await waitForPage(cdp, `document.querySelector('[data-relic-settlement="lost"]')`, 'retreat shows lost relic settlement');
  await assertLostRelicSettlement(cdp, 'retreat relic settlement');

  const failure = makeCombatSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'upper_fog_patrol',
    monsterId: 'fog_lesser_demon',
    monsterHp: 999,
    player: { hp: 1, maxHp: 999 },
    combatLog: ['relic combat failure lost pointer smoke save'],
    log: ['relic combat failure lost pointer smoke save']
  });
  attachRunRelicState(failure, {
    frame: 'bulwark',
    seed: 223,
    acquiredIds: ['bone_shell'],
    processedDraftIds: ['demon_tower_1:echo:1']
  });
  await injectGameState(cdp, failure);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.combat-panel')`, 'relic combat failure precondition renders');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await evaluate(cdp, `Boolean(document.querySelector('.combat-panel'))`))) break;
    await clickButtonByPointer(cdp, '攻击', '.combat-panel');
  }
  await waitForPage(cdp, `document.querySelector('[data-relic-settlement="lost"]')`, 'combat failure shows lost relic settlement');
  await assertLostRelicSettlement(cdp, 'combat failure relic settlement');
}

async function runRelicSaveCompatibilitySmoke(cdp, appUrl) {
  const legacyActive = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'watch_post_cache',
    log: ['legacy active run without relic state smoke save']
  });
  delete legacyActive.preparedRelicFrame;
  delete legacyActive.archivedRelicIds;
  delete legacyActive.preparedRelicSeedId;
  delete legacyActive.run.relicState;
  delete legacyActive.run.relicConduitSourceEquipmentIds;
  delete legacyActive.run.lastRelicSettlement;
  await injectGameState(cdp, legacyActive);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-state="legacy-no-relic"]')?.textContent.includes('旧档本局未启用遗物') &&
      document.querySelector('[data-action="reward-current-watch_post_cache"]:not(:disabled)')`,
    'legacy active run remains relic-free at a real draft node'
  );
  let compatibility = await getRunRelicSnapshot(cdp);
  if (
    compatibility.saved?.preparedRelicFrame !== 'assault' ||
    JSON.stringify(compatibility.saved?.archivedRelicIds) !== JSON.stringify([]) ||
    Object.prototype.hasOwnProperty.call(compatibility.saved?.run ?? {}, 'relicState') ||
    compatibility.choiceIds.length !== 0
  ) {
    throw new Error(`Legacy active run should default only hub preparation and never synthesize run relics: ${JSON.stringify(compatibility)}`);
  }

  await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.cleared')?.textContent.includes('巡哨布袋') &&
      document.querySelector('[data-run-relic-state="legacy-no-relic"]') &&
      !document.querySelector('[data-relic-choice]')`,
    'legacy active run collects a relic draft node without backfill'
  );
  compatibility = await getRunRelicSnapshot(cdp);
  if (
    Object.prototype.hasOwnProperty.call(compatibility.saved?.run ?? {}, 'relicState') ||
    Object.prototype.hasOwnProperty.call(compatibility.saved?.run ?? {}, 'relicConduitSourceEquipmentIds') ||
    compatibility.choiceIds.length !== 0 ||
    !compatibility.bodyText.includes('旧档本局未启用遗物')
  ) {
    throw new Error(`Legacy active run should stay relic-free after real reward collection: ${JSON.stringify(compatibility)}`);
  }

  const legacyHub = makeRelicHubSave('legacy hub without relic preparation fields smoke save');
  delete legacyHub.preparedRelicFrame;
  delete legacyHub.archivedRelicIds;
  delete legacyHub.preparedRelicSeedId;
  await injectGameState(cdp, legacyHub);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-relic-preparation="true"][data-selected-relic-frame="assault"]')`,
    'legacy hub defaults relic preparation'
  );
  const defaultedHub = await assertRelicHubFrame(cdp, 'assault', 2, undefined, 'legacy hub defaults');
  if (
    JSON.stringify(defaultedHub.saved?.archivedRelicIds) !== JSON.stringify([]) ||
    Object.prototype.hasOwnProperty.call(defaultedHub.saved ?? {}, 'preparedRelicSeedId')
  ) {
    throw new Error(`Legacy hub should normalize to assault, empty archive, and no seed: ${JSON.stringify(defaultedHub)}`);
  }

  const malformed = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'watch_post_cache',
    log: ['malformed relic fields recovery smoke save']
  });
  malformed.preparedRelicFrame = 'raw_bad_frame';
  malformed.archivedRelicIds = ['mist_edge', 'raw_bad_archived'];
  malformed.preparedRelicSeedId = 'raw_bad_seed';
  malformed.run.relicState = {
    rulesVersion: 99,
    frame: 'raw_bad_run_frame',
    seed: 0,
    acquiredIds: ['raw_bad_relic'],
    processedDraftIds: ['raw_bad_draft'],
    pendingDraft: {
      draftId: 'raw_bad_pending',
      nodeId: 'watch_post_cache',
      candidateIds: ['raw_bad_candidate']
    }
  };
  malformed.run.relicConduitSourceEquipmentIds = ['raw_bad_conduit'];
  malformed.run.lastRelicSettlement = {
    status: 'raw_bad_settlement',
    frame: 'raw_bad_settlement_frame',
    acquiredIds: ['raw_bad_settlement_relic'],
    archivedRelicId: 'raw_bad_settlement_archive'
  };
  await injectGameState(cdp, malformed);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-state="legacy-no-relic"]') && document.querySelector('.shell')`,
    'malformed relic snapshot safely degrades'
  );
  compatibility = await getRunRelicSnapshot(cdp);
  const sanitizedText = JSON.stringify(compatibility.saved);
  if (
    compatibility.saved?.preparedRelicFrame !== 'assault' ||
    JSON.stringify(compatibility.saved?.archivedRelicIds) !== JSON.stringify([]) ||
    Object.prototype.hasOwnProperty.call(compatibility.saved ?? {}, 'preparedRelicSeedId') ||
    Object.prototype.hasOwnProperty.call(compatibility.saved?.run ?? {}, 'relicState') ||
    Object.prototype.hasOwnProperty.call(compatibility.saved?.run ?? {}, 'relicConduitSourceEquipmentIds') ||
    Object.prototype.hasOwnProperty.call(compatibility.saved?.run ?? {}, 'lastRelicSettlement') ||
    sanitizedText.includes('raw_bad_') ||
    compatibility.bodyText.includes('raw_bad_')
  ) {
    throw new Error(`Malformed relic fields should be removed without exposing raw IDs: ${JSON.stringify(compatibility)}`);
  }

  const malformedRunMetadata = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'watch_post_cache',
    log: ['malformed relic conduit and settlement recovery smoke save']
  });
  attachRunRelicState(malformedRunMetadata, { frame: 'assault' });
  malformedRunMetadata.run.relicConduitSourceEquipmentIds = ['spirit_robe', 'raw_bad_conduit'];
  malformedRunMetadata.run.lastRelicSettlement = {
    status: 'archived',
    frame: 'assault',
    acquiredIds: [],
    archivedRelicId: 'raw_bad_settlement_archive'
  };
  await injectGameState(cdp, malformedRunMetadata);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-relic-state="active"]') &&
      document.querySelector('.run-relic-conduits')?.textContent.includes('本局未冻结匹配导管')`,
    'malformed conduit and settlement normalize independently'
  );
  compatibility = await getRunRelicSnapshot(cdp);
  if (
    JSON.stringify(compatibility.saved?.run?.relicConduitSourceEquipmentIds) !== JSON.stringify([]) ||
    Object.prototype.hasOwnProperty.call(compatibility.saved?.run ?? {}, 'lastRelicSettlement') ||
    compatibility.frozenConduitIds.length !== 0 ||
    compatibility.bodyText.includes('raw_bad_') ||
    JSON.stringify(compatibility.saved).includes('raw_bad_')
  ) {
    throw new Error(`Malformed conduit and settlement should normalize without leaking raw IDs: ${JSON.stringify(compatibility)}`);
  }
}

async function runRelicSmoke(cdp, appUrl) {
  await cdp.send('Log.enable');
  await delay(100);

  try {
    await runRelicPreparationAndOrdinarySmoke(cdp, appUrl);
    await runRelicConduitSmoke(cdp, appUrl);
    await runRelicArchiveSeedSmoke(cdp, appUrl);
    await runRelicLostSettlementSmoke(cdp, appUrl);
    await runRelicSaveCompatibilitySmoke(cdp, appUrl);

    await delay(150);
    const browserErrors = collectBrowserErrorEvents(cdp);
    const pageHealth = await evaluate(
      cdp,
      `(() => ({
        hasShell: Boolean(document.querySelector('.shell')),
        errorOverlayCount: document.querySelectorAll('vite-error-overlay, #webpack-dev-server-client-overlay, [data-error-overlay]').length,
        title: document.title
      }))()`
    );
    if (browserErrors.length > 0 || !pageHealth.hasShell || pageHealth.errorOverlayCount > 0) {
      throw new Error(`Run relic browser smoke should have no console errors, page exceptions, or error overlays: ${JSON.stringify({ browserErrors, pageHealth })}`);
    }
  } finally {
    await resetRelicSmokeState(cdp, appUrl);
  }

  console.log(
    '[smoke] real pointer relic preparation, 2/3-choice drafts, reload persistence, archive seeding, lost settlements, compatibility recovery, and desktop/mobile layouts pass'
  );
}

const EQUIPMENT_SOUL_SKILL_IDS = [
  'mist_fixed_point',
  'spirit_grounding',
  'gauntlet_breakbeat',
  'cloudstep_retrace',
  'rift_misalignment',
  'rift_seal'
];
const EQUIPMENT_SOUL_SKILL_SOURCES = [
  'mist_hood',
  'spirit_robe',
  'guardian_gauntlets',
  'cloudstep_boots',
  'rift_belt',
  'rift_charm'
];
const EQUIPMENT_SOUL_LOADOUT = {
  weapon: 'training_blade',
  head: 'mist_hood',
  armor: 'spirit_robe',
  hands: 'guardian_gauntlets',
  feet: 'cloudstep_boots',
  waist: 'rift_belt',
  charm: 'rift_charm'
};

function makeEquipmentSoulSkillRunState({
  readySkillIds = EQUIPMENT_SOUL_SKILL_IDS,
  chargesRemaining = 2,
  usedRechargeIds = [],
  pendingRecharge
} = {}) {
  return {
    rulesVersion: 1,
    frozenSkillIds: [...EQUIPMENT_SOUL_SKILL_IDS],
    readySkillIds: [...readySkillIds],
    chargesRemaining,
    usedRechargeIds: [...usedRechargeIds],
    ...(pendingRecharge ? { pendingRecharge: { ...pendingRecharge } } : {})
  };
}

function equipEquipmentSoulSkillSources(state) {
  state.ownedEquipment = [...new Set([...state.ownedEquipment, ...EQUIPMENT_SOUL_SKILL_SOURCES])];
  state.equipmentLevels = {
    ...state.equipmentLevels,
    ...Object.fromEntries(EQUIPMENT_SOUL_SKILL_SOURCES.map((equipmentId) => [equipmentId, 3]))
  };
  state.equipmentTemperRanks = Object.fromEntries(
    EQUIPMENT_SOUL_SKILL_SOURCES.map((equipmentId) => [equipmentId, 1])
  );
  state.equipmentAttunements = {};
  state.equipped = { ...EQUIPMENT_SOUL_LOADOUT };
  state.claimedTaskIds = ['mainline_clear_demon_tower_1'];
  state.completedDungeonIds = ['demon_tower_1'];
  state.preparedRelicFrame = 'assault';
  state.archivedRelicIds = [];
  delete state.preparedRelicSeedId;
  return state;
}

function makeEquipmentSoulHubSave() {
  const state = equipEquipmentSoulSkillSources(
    makeExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'fog_lesser_demon',
      rewardPoints: 5000,
      lingyun: 10,
      inventory: { gate_sigil: 2, healing_pill: 4 },
      log: ['equipment soul entry pointer smoke save']
    })
  );
  state.phase = 'hub';
  delete state.run;
  return state;
}

function makeEquipmentSoulExploreSave({
  dungeonId = 'demon_tower_1',
  nodeId,
  clearedNodeIds = [],
  inventory = {},
  lootBag = makeLootBag(),
  soulSkillState = makeEquipmentSoulSkillRunState(),
  log = ['equipment soul explore pointer smoke save']
}) {
  const state = equipEquipmentSoulSkillSources(
    makeExploreSave({
      dungeonId,
      nodeId,
      clearedNodeIds,
      inventory,
      lootBag,
      rewardPoints: 5000,
      lingyun: 10,
      log
    })
  );
  state.run.protocol = { id: 'standard', rulesVersion: 1 };
  state.run.soulSkillState = soulSkillState;
  return state;
}

function makeEquipmentSoulCombatSave() {
  const state = equipEquipmentSoulSkillSources(
    makeCombatSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'fog_lesser_demon',
      monsterId: 'fog_lesser_demon',
      monsterHp: 54,
      turn: 2,
      weaponFocus: 2,
      effects: {
        rustPoisonStacks: 2,
        mirrorSlowStacks: 1,
        lastPlayerAction: 'attack',
        armorCracked: true
      },
      player: { hp: 160, maxHp: 160, base: { body: 5, spirit: 5, agility: 4, luck: 2 } },
      combatLog: ['equipment soul combat pointer smoke save'],
      log: ['equipment soul combat pointer smoke save']
    })
  );
  state.run.protocol = { id: 'standard', rulesVersion: 1 };
  state.run.soulSkillState = makeEquipmentSoulSkillRunState();
  return state;
}

async function assertEquipmentSoulEntryAndReload(cdp, appUrl) {
  await injectGameState(cdp, makeEquipmentSoulHubSave());
  await setViewport(cdp, 390, 844);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.character-trigger')`, 'equipment soul hub renders at 390x844');
  await clickButtonByPointer(cdp, '角色');
  await waitForPage(
    cdp,
    `document.querySelector('.character-sheet[role="dialog"][aria-modal="true"]')`,
    'equipment soul character sheet opens by pointer'
  );

  const character = await evaluate(
    cdp,
    `(() => {
      const expectedSkills = ${JSON.stringify(EQUIPMENT_SOUL_SKILL_IDS)};
      const expectedSources = ${JSON.stringify(EQUIPMENT_SOUL_SKILL_SOURCES)};
      const dialog = document.querySelector('.character-sheet[role="dialog"][aria-modal="true"]');
      const rows = [...dialog.querySelectorAll('.loadout-row [data-equipment-soul-skill]')];
      const hitRows = rows.map((row) => {
        row.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = row.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          id: row.dataset.equipmentSoulSkill,
          source: row.dataset.soulSkillSourceEquipment,
          unlocked: row.dataset.soulSkillUnlocked,
          text: row.textContent.replace(/\\s+/g, ' ').trim(),
          hit: Boolean(hit && row.contains(hit))
        };
      });
      return {
        viewport: [innerWidth, innerHeight],
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        dialogOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
        ids: hitRows.map(({ id }) => id),
        sources: hitRows.map(({ source }) => source),
        badRows: hitRows.filter((row) =>
          row.unlocked !== 'true' ||
          !row.text.includes('解锁：装备 Lv.3 + 淬炼 I') ||
          !row.text.includes('当前 Lv.3') ||
          !row.hit
        ),
        missingSkills: expectedSkills.filter((skillId) => !hitRows.some(({ id }) => id === skillId)),
        missingSources: expectedSources.filter((equipmentId) => !hitRows.some(({ source }) => source === equipmentId))
      };
    })()`
  );
  if (
    character.viewport[0] !== 390 ||
    character.viewport[1] !== 844 ||
    character.pageOverflow ||
    character.dialogOverflow ||
    character.ids.length !== 6 ||
    character.badRows.length > 0 ||
    character.missingSkills.length > 0 ||
    character.missingSources.length > 0
  ) {
    throw new Error(`390x844 character equipment soul rows should be unlocked, overflow-free, and hittable: ${JSON.stringify(character)}`);
  }
  await clickElementByPointer(cdp, '.character-close');
  await waitForPage(cdp, `!document.querySelector('[role="dialog"][aria-modal="true"]')`, 'equipment soul character sheet closes');

  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '选择协议');
  await waitForPage(
    cdp,
    `document.querySelector('[data-protocol-soul-skills="active"][data-frozen-soul-skill-count="6"][data-soul-skill-charge="2"]')`,
    'equipment soul protocol snapshot renders'
  );
  const protocol = await evaluate(
    cdp,
    `(() => {
      const root = document.querySelector('[data-protocol-soul-skills="active"]');
      const rows = [...root.querySelectorAll('[data-soul-skill-id]')];
      return {
        ids: rows.map((row) => row.dataset.soulSkillId),
        sources: rows.map((row) => row.dataset.soulSkillSourceEquipment),
        text: root.textContent.replace(/\\s+/g, ' ').trim()
      };
    })()`
  );
  if (
    JSON.stringify(protocol.ids) !== JSON.stringify(EQUIPMENT_SOUL_SKILL_IDS) ||
    JSON.stringify(protocol.sources) !== JSON.stringify(EQUIPMENT_SOUL_SKILL_SOURCES) ||
    !protocol.text.includes('charge 2/2')
  ) {
    throw new Error(`Protocol should visibly freeze all six equipment soul sources with two charges: ${JSON.stringify(protocol)}`);
  }
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.protocol-sheet',
    targetSelectors: ['.protocol-soul-skill-lock', '.protocol-soul-skill-list', '.protocol-modal-actions'],
    buttonSelectors: ['[data-action="confirm-protocol-entry"]'],
    checkRootOverflow: true,
    label: 'mobile equipment soul protocol'
  });
  await clickElementByPointer(cdp, '[data-action="confirm-protocol-entry"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-soul-skills="active"][data-frozen-soul-skill-count="6"][data-soul-skill-charge="2"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState.readySkillIds.length === 6`,
    'real pointer enters with six frozen equipment soul skills'
  );
  const entered = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        soul: saved.run.soulSkillState,
        sources: [...document.querySelectorAll('[data-run-soul-skills="active"] [data-soul-skill-source-equipment]')]
          .map((row) => row.dataset.soulSkillSourceEquipment)
      };
    })()`
  );
  if (
    JSON.stringify(entered.soul.frozenSkillIds) !== JSON.stringify(EQUIPMENT_SOUL_SKILL_IDS) ||
    JSON.stringify(entered.soul.readySkillIds) !== JSON.stringify(EQUIPMENT_SOUL_SKILL_IDS) ||
    entered.soul.chargesRemaining !== 2 ||
    entered.sources.length !== 6
  ) {
    throw new Error(`Entered run should persist the exact six-skill snapshot: ${JSON.stringify(entered)}`);
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-soul-skills="active"][data-frozen-soul-skill-count="6"][data-soul-skill-charge="2"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState.readySkillIds.length === 6`,
    'equipment soul entry snapshot survives reload'
  );
  console.log('[smoke] equipment soul entry: six Lv.3 / temper-I sources render in the 390x844 character sheet, freeze in protocol, enter by pointer, and survive reload');
}

async function assertEquipmentSoulCombat(cdp, appUrl) {
  await injectGameState(cdp, makeEquipmentSoulCombatSave());
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.combat-soul-skill-toolbar [data-soul-skill-id="spirit_grounding"]:not(:disabled)')`,
    'equipment soul combat cleanse renders'
  );
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.combat-panel',
      targetSelectors: ['.combat-soul-skill-toolbar', '.combat-command-area'],
      buttonSelectors: [
        '.combat-soul-skill-toolbar [data-soul-skill-id="spirit_grounding"]',
        '[data-action="combat-attack"]'
      ],
      minimumButtonHeight: 43.5,
      checkRootOverflow: true,
      label: `${width}x${height} equipment soul combat toolbar`
    });
  }
  const before = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        turn: saved.combat.turn,
        focus: saved.combat.weaponFocus,
        hp: saved.player.hp,
        monsterHp: saved.combat.monsterHp,
        effects: saved.combat.effects,
        charge: saved.run.soulSkillState.chargesRemaining
      };
    })()`
  );
  await clickElementByPointer(cdp, '.combat-soul-skill-toolbar [data-soul-skill-id="spirit_grounding"]');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState.chargesRemaining === 1`,
    'real pointer uses spirit grounding'
  );
  const after = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        turn: saved.combat.turn,
        focus: saved.combat.weaponFocus,
        hp: saved.player.hp,
        monsterHp: saved.combat.monsterHp,
        effects: saved.combat.effects,
        soul: saved.run.soulSkillState,
        log: saved.combat.log.join(' ')
      };
    })()`
  );
  if (
    after.turn !== before.turn ||
    after.focus !== before.focus ||
    after.hp !== before.hp ||
    after.monsterHp !== before.monsterHp ||
    after.effects.rustPoisonStacks !== undefined ||
    after.effects.mirrorSlowStacks !== undefined ||
    after.effects.lastPlayerAction !== undefined ||
    after.effects.armorCracked !== true ||
    after.soul.chargesRemaining !== 1 ||
    after.soul.readySkillIds.includes('spirit_grounding') ||
    !after.log.includes('灵纹泄地')
  ) {
    throw new Error(`Spirit grounding should cleanse without a normal action or retaliation: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  console.log('[smoke] equipment soul combat: real pointer cleanse spends one shared charge while turn, focus, HP, and monster HP stay unchanged');
}

async function assertEquipmentSoulTrap(cdp, appUrl) {
  const trap = makeEquipmentSoulExploreSave({
    nodeId: 'blood_rune_trap',
    clearedNodeIds: ['fog_lesser_demon'],
    log: ['equipment soul trap retrace pointer smoke save']
  });
  await injectGameState(cdp, trap);
  await cdp.send('Page.navigate', { url: appUrl });
  const retraceSelector = '[data-soul-skill-id="cloudstep_retrace"][data-soul-skill-target-node="fog_lesser_demon"]:not(:disabled)';
  await waitForPage(cdp, `document.querySelector(${JSON.stringify(retraceSelector)})`, 'cloudstep retrace control renders');
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.main-column',
      targetSelectors: ['[data-run-soul-skills="active"]', '.node-soul-skill-controls', '.node-action-panel', '.dungeon-map'],
      buttonSelectors: [retraceSelector],
      minimumButtonHeight: 43.5,
      label: `${width}x${height} equipment soul explore and trap controls`
    });
  }
  await clickElementByPointer(cdp, retraceSelector);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.currentNodeId === 'fog_lesser_demon' &&
        !saved.run.clearedNodeIds.includes('blood_rune_trap') &&
        saved.run.soulSkillState.chargesRemaining === 1 &&
        !saved.run.soulSkillState.readySkillIds.includes('cloudstep_retrace');
    })()`,
    'real pointer cloudstep retraces without clearing trap'
  );
  console.log('[smoke] equipment soul trap: real pointer cloudstep returns to the cleared neighbor and leaves the original trap uncleared');
}

function prepareEquipmentSoulPortalState({ stable }) {
  const state = makeEquipmentSoulExploreSave({
    nodeId: 'cracked_portal',
    inventory: stable ? { gate_sigil: 1 } : {},
    soulSkillState: makeEquipmentSoulSkillRunState({ usedRechargeIds: ['soul_node_demon_mist_watch'] }),
    log: [`equipment soul portal ${stable ? 'stable' : 'force'} pointer smoke save`]
  });
  state.preparedItemIds = stable ? ['gate_sigil'] : [];
  state.run.tacticalLoadout = { rulesVersion: 1, itemIds: [...state.preparedItemIds] };
  return state;
}

async function assertEquipmentSoulPortal(cdp, appUrl) {
  const targetNodeId = 'lampbox_reward';
  const stableSelector = `[data-soul-skill-id="rift_misalignment"][data-soul-skill-target-node="${targetNodeId}"][data-soul-skill-portal-choice="stabilize"]`;
  await injectGameState(cdp, prepareEquipmentSoulPortalState({ stable: true }));
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector(${JSON.stringify(stableSelector)} + ':not(:disabled)')`, 'stable portal offset renders');
  const stableBefore = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  await clickElementByPointer(cdp, stableSelector);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'metro_abyss' && saved.run.currentNodeId === '${targetNodeId}';
    })()`,
    'real pointer stable portal offset lands beside default target'
  );
  const stableAfter = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  if (
    stableAfter.inventory.gate_sigil !== stableBefore.inventory.gate_sigil - 1 ||
    stableAfter.player.hp !== stableBefore.player.hp ||
    !stableAfter.run.usedItems.includes('gate_sigil') ||
    stableAfter.run.soulSkillState.chargesRemaining !== 1 ||
    stableAfter.run.soulSkillState.readySkillIds.includes('rift_misalignment') ||
    JSON.stringify(stableAfter.run.soulSkillState.usedRechargeIds) !== JSON.stringify(['soul_node_demon_mist_watch'])
  ) {
    throw new Error(`Stable portal offset should spend its real item and preserve soul metadata: ${JSON.stringify({ stableBefore, stableAfter })}`);
  }

  const forceSelector = `[data-soul-skill-id="rift_misalignment"][data-soul-skill-target-node="${targetNodeId}"][data-soul-skill-portal-choice="force"]`;
  await injectGameState(cdp, prepareEquipmentSoulPortalState({ stable: false }));
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector(${JSON.stringify(forceSelector)} + ':not(:disabled)')`, 'forced portal offset renders');
  const forceBefore = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  await clickElementByPointer(cdp, forceSelector);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'metro_abyss' && saved.run.currentNodeId === '${targetNodeId}' && saved.player.hp < ${forceBefore.player.hp};
    })()`,
    'real pointer forced portal offset takes backlash and lands beside default target'
  );
  const forceAfter = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  const forceDamage = forceBefore.player.hp - forceAfter.player.hp;
  if (
    forceDamage <= 0 ||
    forceAfter.run.damageTaken !== forceBefore.run.damageTaken + forceDamage ||
    forceAfter.run.soulSkillState.chargesRemaining !== 1 ||
    forceAfter.run.soulSkillState.readySkillIds.includes('rift_misalignment') ||
    JSON.stringify(forceAfter.run.soulSkillState.usedRechargeIds) !== JSON.stringify(forceBefore.run.soulSkillState.usedRechargeIds)
  ) {
    throw new Error(`Forced portal offset should take real backlash and preserve recharge history: ${JSON.stringify({ forceBefore, forceAfter })}`);
  }
  const preservedSoul = JSON.stringify(forceAfter.run.soulSkillState);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState) === ${JSON.stringify(preservedSoul)}`,
    'cross-portal equipment soul state survives reload'
  );
  console.log('[smoke] equipment soul portal: stable and force offset buttons spend the real cost/backlash, land off-default, and preserve charge/ready/recharge history across dungeon and reload');
}

async function assertEquipmentSoulRewardSeal(cdp, appUrl) {
  const reward = makeEquipmentSoulExploreSave({
    nodeId: 'watch_post_cache',
    log: ['equipment soul reward seal pointer smoke save']
  });
  attachRunRelicState(reward, { frame: 'assault', seed: 307 });
  await injectGameState(cdp, reward);
  await cdp.send('Page.navigate', { url: appUrl });
  const sealSelector = '[data-soul-skill-id="rift_seal"][data-soul-skill-item="medicine_ash"]:not(:disabled)';
  await waitForPage(cdp, `document.querySelector(${JSON.stringify(sealSelector)})`, 'reward seal control renders');
  const before = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  await clickElementByPointer(cdp, sealSelector);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.inventory.medicine_ash === ${before.inventory.medicine_ash + 1} &&
        saved.run.clearedNodeIds.includes('watch_post_cache') &&
        saved.run.relicState.pendingDraft?.draftId === 'demon_tower_1:echo:1';
    })()`,
    'real pointer seals reward item and still opens relic draft'
  );
  const sealed = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  if (
    (sealed.run.lootBag.items.medicine_ash ?? 0) !== 0 ||
    sealed.run.lootBag.rewardPoints !== 70 ||
    sealed.run.soulSkillState.chargesRemaining !== 1 ||
    sealed.run.soulSkillState.readySkillIds.includes('rift_seal') ||
    !sealed.run.relicState.pendingDraft
  ) {
    throw new Error(`Reward seal should transfer one real item while ordinary reward and relic draft remain: ${JSON.stringify(sealed)}`);
  }
  await clickButtonByPointer(cdp, '撤回主神空间');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' && saved.inventory.medicine_ash === ${before.inventory.medicine_ash + 1};
    })()`,
    'sealed reward survives real pointer retreat'
  );
  console.log('[smoke] equipment soul reward: real pointer seal transfers one item out of run loot, keeps points and relic draft, and the item survives retreat');
}

async function assertEquipmentSoulRecharge(cdp, appUrl) {
  const spentReady = EQUIPMENT_SOUL_SKILL_IDS.filter((skillId) => skillId !== 'spirit_grounding');
  const station = makeEquipmentSoulExploreSave({
    nodeId: 'upper_fog_patrol',
    clearedNodeIds: ['upper_fog_patrol'],
    soulSkillState: makeEquipmentSoulSkillRunState({ readySkillIds: spentReady, chargesRemaining: 1 }),
    log: ['equipment soul recharge pointer smoke save']
  });
  await injectGameState(cdp, station);
  await cdp.send('Page.navigate', { url: appUrl });
  const rechargeId = 'soul_node_demon_mist_watch';
  const openSelector = `[data-action="soul-recharge-open-${rechargeId}"]`;
  await waitForPage(cdp, `document.querySelector(${JSON.stringify(openSelector)} + ':not(:disabled)')`, 'equipment soul recharge station is available');
  await clickElementByPointer(cdp, openSelector);
  await waitForPage(
    cdp,
    `document.querySelector('[data-soul-recharge-id="${rechargeId}"][data-soul-recharge-state="pending"][data-route-lock-kind="soul_recharge_pending"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState.pendingRecharge.rechargeId === '${rechargeId}'`,
    'real pointer opens equipment soul recharge station'
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-soul-recharge-state="pending"] [data-soul-recharge-choice="spirit_grounding"]') &&
      document.querySelector('.route-lock-status[data-route-lock-kind="soul_recharge_pending"]')`,
    'pending equipment soul recharge survives reload'
  );

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.main-column',
      targetSelectors: ['[data-run-soul-skills="active"]', '.soul-recharge-station', '.route-lock-status', '.dungeon-map'],
      buttonSelectors: [
        '[data-soul-recharge-choice="spirit_grounding"]',
        '[data-soul-recharge-choice="cancel"]'
      ],
      minimumButtonHeight: 43.5,
      label: `${width}x${height} pending equipment soul recharge choices`
    });
  }
  const pending = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const blocked = document.querySelector('[data-action="grid-watch_post_cache"]');
      const retreat = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('撤回主神空间'));
      retreat?.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = retreat.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        nodeId: saved.run.currentNodeId,
        usedRechargeIds: saved.run.soulSkillState.usedRechargeIds,
        blockedDisabled: blocked?.disabled,
        blockedKind: document.querySelector('.route-lock-status')?.dataset.routeLockKind,
        retreatEnabled: Boolean(retreat && !retreat.disabled),
        retreatHit: Boolean(hit && retreat.contains(hit))
      };
    })()`
  );
  if (
    pending.nodeId !== 'upper_fog_patrol' ||
    pending.usedRechargeIds.length !== 0 ||
    !pending.blockedDisabled ||
    pending.blockedKind !== 'soul_recharge_pending' ||
    !pending.retreatEnabled ||
    !pending.retreatHit
  ) {
    throw new Error(`Pending recharge should lock travel but leave retreat enabled and hittable: ${JSON.stringify(pending)}`);
  }
  await clickElementByPointer(cdp, '[data-action="grid-watch_post_cache"]');
  await delay(150);
  const afterBlockedClick = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return { nodeId: saved.run.currentNodeId, pending: saved.run.soulSkillState.pendingRecharge };
    })()`
  );
  if (afterBlockedClick.nodeId !== 'upper_fog_patrol' || afterBlockedClick.pending?.rechargeId !== rechargeId) {
    throw new Error(`Pointer click on a pending-locked map cell must not move: ${JSON.stringify(afterBlockedClick)}`);
  }

  await clickElementByPointer(cdp, '[data-soul-recharge-choice="cancel"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-soul-recharge-state="available"]') &&
      !JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState.pendingRecharge &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState.usedRechargeIds.length === 0`,
    'real pointer cancels recharge without using station'
  );
  await clickElementByPointer(cdp, openSelector);
  await waitForPage(cdp, `document.querySelector('[data-soul-recharge-choice="spirit_grounding"]')`, 'recharge station reopens after cancel');
  await clickElementByPointer(cdp, '[data-soul-recharge-choice="spirit_grounding"]');
  await waitForPage(
    cdp,
    `(() => {
      const soul = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState;
      return soul.chargesRemaining === 2 && soul.readySkillIds.includes('spirit_grounding') &&
        soul.usedRechargeIds.includes('${rechargeId}') && !soul.pendingRecharge;
    })()`,
    'real pointer restores one spent equipment soul skill'
  );
  const restoredSoul = await evaluate(
    cdp,
    `JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState)`
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.soulSkillState) === ${JSON.stringify(restoredSoul)} &&
      document.querySelector('[data-soul-recharge-state="used"]')`,
    'resolved equipment soul recharge survives reload'
  );
  console.log('[smoke] equipment soul recharge: open and pending persist, travel stays locked, cancel preserves station, reopen restores one skill and charge, and used history survives reload');
}

async function assertEquipmentSoulSaveCompatibility(cdp, appUrl) {
  const legacy = makeEquipmentSoulExploreSave({
    nodeId: 'upper_fog_patrol',
    clearedNodeIds: ['upper_fog_patrol'],
    log: ['legacy active run without equipment soul state smoke save']
  });
  delete legacy.run.soulSkillState;
  await injectGameState(cdp, legacy);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-soul-skills="legacy-disabled"]') &&
      document.querySelector('[data-soul-recharge-state="legacy-disabled"]')`,
    'legacy active run remains equipment-soul disabled'
  );
  let compatibility = await evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = JSON.parse(raw).state;
      return {
        hasSave: Boolean(raw),
        phase: saved.phase,
        nodeId: saved.run?.currentNodeId,
        hasSoulState: Object.prototype.hasOwnProperty.call(saved.run ?? {}, 'soulSkillState'),
        soulButtons: document.querySelectorAll('button[data-soul-skill-id]').length,
        marker: document.body.textContent.includes('legacy active run without equipment soul state smoke save')
      };
    })()`
  );
  if (!compatibility.hasSave || compatibility.phase !== 'explore' || compatibility.nodeId !== 'upper_fog_patrol' || compatibility.hasSoulState || compatibility.soulButtons !== 0 || !compatibility.marker) {
    throw new Error(`Legacy active run should stay intact and never backfill equipment soul buttons: ${JSON.stringify(compatibility)}`);
  }

  const malformed = makeEquipmentSoulExploreSave({
    nodeId: 'upper_fog_patrol',
    clearedNodeIds: ['upper_fog_patrol'],
    log: ['malformed equipment soul substate recovery smoke save']
  });
  malformed.run.soulSkillState = {
    rulesVersion: 99,
    frozenSkillIds: ['raw_bad_soul_skill'],
    readySkillIds: ['raw_bad_soul_skill'],
    chargesRemaining: 9,
    usedRechargeIds: ['']
  };
  await injectGameState(cdp, malformed);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-soul-skills="legacy-disabled"]') &&
      document.body.textContent.includes('malformed equipment soul substate recovery smoke save')`,
    'malformed equipment soul substate degrades in place'
  );
  compatibility = await evaluate(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = JSON.parse(raw).state;
      return {
        hasSave: Boolean(raw),
        phase: saved.phase,
        nodeId: saved.run?.currentNodeId,
        hasSoulState: Object.prototype.hasOwnProperty.call(saved.run ?? {}, 'soulSkillState'),
        soulButtons: document.querySelectorAll('button[data-soul-skill-id]').length,
        leakedBadId: raw.includes('raw_bad_soul_skill') || document.body.textContent.includes('raw_bad_soul_skill'),
        dungeonCards: document.querySelectorAll('.dungeon-card').length
      };
    })()`
  );
  if (!compatibility.hasSave || compatibility.phase !== 'explore' || compatibility.nodeId !== 'upper_fog_patrol' || compatibility.hasSoulState || compatibility.soulButtons !== 0 || compatibility.leakedBadId || compatibility.dungeonCards !== 0) {
    throw new Error(`Malformed equipment soul substate should be removed without resetting the active run: ${JSON.stringify(compatibility)}`);
  }
  console.log('[smoke] equipment soul saves: missing and malformed active-run substates remain in place as legacy-disabled without synthetic skills or whole-save reset');
}

function collectEquipmentSoulNetworkFailures(cdp) {
  return cdp.events.flatMap((event) => {
    if (event.method !== 'Network.loadingFailed') return [];
    const errorText = event.params?.errorText ?? 'unknown network failure';
    if (event.params?.canceled || errorText === 'net::ERR_ABORTED') return [];
    return [`network.failed: ${event.params?.type ?? 'unknown'} ${errorText}`];
  });
}

async function resetEquipmentSoulSmokeState(cdp, appUrl) {
  await evaluate(
    cdp,
    `(() => {
      localStorage.removeItem(${JSON.stringify(STORAGE_KEY)});
      return true;
    })()`
  );
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      !document.querySelector('[role="dialog"][aria-modal="true"]') &&
      innerWidth === 1440 && innerHeight === 900`,
    'equipment soul smoke restores clean 1440x900 new game'
  );
}

async function runEquipmentSoulSmoke(cdp, appUrl) {
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await delay(100);

  try {
    await assertEquipmentSoulEntryAndReload(cdp, appUrl);
    await assertEquipmentSoulCombat(cdp, appUrl);
    await assertEquipmentSoulTrap(cdp, appUrl);
    await assertEquipmentSoulPortal(cdp, appUrl);
    await assertEquipmentSoulRewardSeal(cdp, appUrl);
    await assertEquipmentSoulRecharge(cdp, appUrl);
    await assertEquipmentSoulSaveCompatibility(cdp, appUrl);

    await delay(150);
    const browserErrors = collectBrowserErrorEvents(cdp);
    const networkFailures = collectEquipmentSoulNetworkFailures(cdp);
    const pageHealth = await evaluate(
      cdp,
      `(() => ({
        hasShell: Boolean(document.querySelector('.shell')),
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        errorOverlayCount: document.querySelectorAll('vite-error-overlay, #webpack-dev-server-client-overlay, [data-error-overlay]').length
      }))()`
    );
    if (browserErrors.length > 0 || networkFailures.length > 0 || !pageHealth.hasShell || pageHealth.pageOverflow || pageHealth.errorOverlayCount > 0) {
      throw new Error(`Equipment soul browser smoke should have no console, network, overlay, or horizontal-overflow failures: ${JSON.stringify({ browserErrors, networkFailures, pageHealth })}`);
    }
  } finally {
    await resetEquipmentSoulSmokeState(cdp, appUrl);
  }

  console.log('[smoke] equipment soul suite: real pointer entry, combat, trap, portal, reward seal, recharge, compatibility, persistence, and 1440x900 / 390x844 layouts pass');
}

function makeFieldSurveyHubSave() {
  const state = makeExploreSave({
    dungeonId: 'demon_tower_1',
    nodeId: 'fog_lesser_demon',
    rewardPoints: 5000,
    lingyun: 10,
    inventory: { healing_pill: 4, dispel_talisman: 4, gate_sigil: 2 },
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped: ADVANCED_EQUIPPED,
    completedDungeonIds: ['demon_tower_1'],
    log: ['field survey protocol entry smoke save']
  });
  state.phase = 'hub';
  state.equipmentAttunements = {
    starforged_edge: 'forge_overdrive',
    rift_belt: 'rift_anchor'
  };
  delete state.run;
  return state;
}

function makeFieldSurveyExploreSave({
  dungeonId,
  nodeId,
  frozenSources,
  equipmentAttunements,
  inventory = {},
  rewardPoints = 1000,
  lingyun = 6,
  player = {},
  preparedItemIds,
  equipped = ADVANCED_EQUIPPED,
  log = ['field survey reward pointer smoke save']
}) {
  const state = makeExploreSave({
    dungeonId,
    nodeId,
    rewardPoints,
    lingyun,
    player,
    inventory,
    ownedEquipment: ADVANCED_OWNED_EQUIPMENT,
    equipmentLevels: ADVANCED_EQUIPMENT_LEVELS,
    equipped,
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    log
  });
  state.equipmentAttunements = { ...equipmentAttunements };
  if (preparedItemIds) {
    state.preparedItemIds = [...preparedItemIds];
    state.run.tacticalLoadout = { rulesVersion: 1, itemIds: [...preparedItemIds] };
  }
  state.run.protocol = { id: 'standard', rulesVersion: 1 };
  state.run.relicState = { rulesVersion: 1, frame: 'assault', acquiredIds: [], processedDraftIds: [] };
  state.run.relicConduitSourceEquipmentIds = [];
  state.run.soulSkillState = {
    rulesVersion: 1,
    frozenSkillIds: [],
    readySkillIds: [],
    chargesRemaining: 0,
    usedRechargeIds: []
  };
  state.run.fieldSurveyState = {
    rulesVersion: 1,
    frozenSources: frozenSources.map((source) => ({ ...source })),
    resolvedSurveys: []
  };
  return state;
}

async function resetFieldSurveySmokeState(cdp, appUrl) {
  await evaluate(
    cdp,
    `(() => {
      localStorage.removeItem(${JSON.stringify(STORAGE_KEY)});
      return true;
    })()`
  );
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      innerWidth === 1440 && innerHeight === 900`,
    'field survey smoke restores clean 1440x900 new game'
  );
}

async function assertFieldSurveyHostLayout(cdp, { width, height, surveyId, optionIds, label }) {
  const rootSelector = `[data-field-survey-state="active"][data-field-survey-id="${surveyId}"]`;
  await assertResponsiveSurface(cdp, {
    width,
    height,
    rootSelector,
    targetSelectors: [rootSelector, '.node-action-panel', `[data-action="reward-current-${surveyId === 'survey_demon_bone_marrow' ? 'demon_bone_cache' : surveyId === 'survey_metro_lost_property' ? 'lost_locker_reward' : 'resonant_pick_reward'}"]`],
    buttonSelectors: optionIds.map((optionId) => `[data-field-survey-option="${optionId}"] button`),
    minimumButtonHeight: 43.5,
    checkRootOverflow: true,
    label
  });
}

async function runFieldSurveySmoke(cdp, appUrl) {
  const overdriveSource = [
    { equipmentId: 'mist_hood', attunementId: 'mist_vanguard' },
    { equipmentId: 'starforged_edge', attunementId: 'forge_overdrive' }
  ];
  const channelingSource = [{ equipmentId: 'starforged_edge', attunementId: 'forge_channeling' }];
  const anchorSource = [
    { equipmentId: 'rift_belt', attunementId: 'rift_anchor' },
    { equipmentId: 'rift_charm', attunementId: 'rift_resonance' }
  ];

  try {
    await injectGameState(cdp, makeFieldSurveyHubSave());
    await setViewport(cdp, 1440, 900);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('[data-action="open-protocol-demon_tower_1"]')`, 'field survey hub entry renders');
    await clickElementByPointer(cdp, '[data-action="open-protocol-demon_tower_1"]');
    await waitForPage(
      cdp,
      `document.querySelector('.protocol-sheet [data-field-survey-state="prepared"]') &&
        document.querySelector('[data-field-survey-attunement="forge_overdrive"][data-field-survey-source-equipment="starforged_edge"]') &&
        document.querySelector('[data-field-survey-attunement="rift_anchor"][data-field-survey-source-equipment="rift_belt"]')`,
      'protocol modal shows frozen field survey sources'
    );
    await clickElementByPointer(cdp, '[data-action="confirm-protocol-entry"]');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return document.querySelector('[data-field-survey-state="active"]') &&
          JSON.stringify(saved.run?.fieldSurveyState) === JSON.stringify({
            rulesVersion: 1,
            frozenSources: [
              { equipmentId: 'starforged_edge', attunementId: 'forge_overdrive' },
              { equipmentId: 'rift_belt', attunementId: 'rift_anchor' }
            ],
            resolvedSurveys: []
          });
      })()`,
      'protocol entry freezes the exact v1 field survey snapshot'
    );
    const enteredRun = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
    enteredRun.equipmentAttunements = { rift_belt: 'rift_anchor' };
    await injectGameState(cdp, enteredRun);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.equipmentAttunements?.starforged_edge === undefined &&
          JSON.stringify(saved.run?.fieldSurveyState?.frozenSources) === JSON.stringify([
            { equipmentId: 'starforged_edge', attunementId: 'forge_overdrive' },
            { equipmentId: 'rift_belt', attunementId: 'rift_anchor' }
          ]) &&
          document.querySelector('[data-field-survey-state="active"]');
      })()`,
      'reloading changed equipment attunements keeps the run field survey snapshot frozen'
    );
    await setViewport(cdp, 1440, 900);

    const demon = makeFieldSurveyExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'demon_bone_cache',
      frozenSources: overdriveSource,
      equipmentAttunements: { mist_hood: 'mist_vanguard', starforged_edge: 'forge_overdrive' },
      player: { hp: 500, maxHp: 500 },
      log: ['field survey demon forge pointer smoke save']
    });
    await injectGameState(cdp, demon);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('[data-field-survey-id="survey_demon_bone_marrow"]') &&
        document.querySelector('[data-action="reward-current-demon_bone_cache"]:not(:disabled)') &&
        document.querySelectorAll('[data-field-survey-id="survey_demon_bone_marrow"] .field-survey-option').length === 2 &&
        document.querySelector('[data-field-survey-option="forge_overdrive_crush_bone"] [data-field-survey-source-equipment="starforged_edge"]')`,
      'demon survey host shows ordinary collection and both survey options'
    );
    await assertFieldSurveyHostLayout(cdp, {
      width: 1440,
      height: 900,
      surveyId: 'survey_demon_bone_marrow',
      optionIds: ['mist_vanguard_fast_search', 'forge_overdrive_crush_bone'],
      label: 'desktop demon field survey host'
    });
    const demonBefore = await evaluate(cdp, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return { rewardPoints: saved.rewardPoints, hp: saved.player.hp, damageTaken: saved.run.damageTaken };
    })()`);
    await clickElementByPointer(cdp, '[data-action="field-survey-survey_demon_bone_marrow-forge_overdrive_crush_bone"]');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const bag = saved.run?.lootBag;
        return saved.rewardPoints === ${demonBefore.rewardPoints + 118} &&
          bag?.rewardPoints === 118 && bag?.items?.demon_bone === 2 && saved.inventory.demon_bone === 2 &&
          saved.player.hp < ${demonBefore.hp} && saved.run.damageTaken === ${demonBefore.damageTaken} + (${demonBefore.hp} - saved.player.hp) &&
          saved.run.fieldSurveyState?.resolvedSurveys?.[0]?.surveyId === 'survey_demon_bone_marrow' &&
          saved.run.fieldSurveyState?.resolvedSurveys?.[0]?.optionId === 'forge_overdrive_crush_bone' &&
          saved.run.clearedNodeIds.includes('demon_bone_cache') &&
          saved.log?.[0]?.includes('实际承受');
      })()`,
      'demon forge survey converts 95 to 118, grants two bones, damages by its 12 percent branch, and records resolution'
    );
    await setViewport(cdp, 1440, 900);

    const mine = makeFieldSurveyExploreSave({
      dungeonId: 'starfall_mine',
      nodeId: 'resonant_pick_reward',
      frozenSources: channelingSource,
      equipmentAttunements: { starforged_edge: 'forge_channeling' },
      rewardPoints: 2000,
      lingyun: 7,
      log: ['field survey starfall forge pointer smoke save']
    });
    await injectGameState(cdp, mine);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('[data-action="field-survey-survey_mine_resonant_vein-forge_channeling_heat_refine"]:not(:disabled)')`, 'starfall field survey heat refine renders');
    await clickElementByPointer(cdp, '[data-action="field-survey-survey_mine_resonant_vein-forge_channeling_heat_refine"]');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const bag = saved.run?.lootBag;
        return saved.rewardPoints === 2091 && saved.lingyun === 10 && bag?.rewardPoints === 91 && bag?.lingyun === 3 &&
          !Object.prototype.hasOwnProperty.call(bag?.items ?? {}, 'cracked_core') && saved.inventory.cracked_core === 0 &&
          saved.run.fieldSurveyState?.resolvedSurveys?.[0]?.surveyId === 'survey_mine_resonant_vein' &&
          saved.run.fieldSurveyState?.resolvedSurveys?.[0]?.optionId === 'forge_channeling_heat_refine' &&
          saved.run.clearedNodeIds.includes('resonant_pick_reward');
      })()`,
      'starfall heat refine converts 130 to 91, removes the cracked core reward, and grants three lingyun'
    );
    await setViewport(cdp, 1440, 900);

    const metro = makeFieldSurveyExploreSave({
      dungeonId: 'metro_abyss',
      nodeId: 'lost_locker_reward',
      frozenSources: anchorSource,
      equipmentAttunements: { rift_belt: 'rift_anchor', rift_charm: 'rift_resonance' },
      inventory: { echo_coin: 1 },
      preparedItemIds: ['echo_coin'],
      equipped: { ...ADVANCED_EQUIPPED, charm: 'rift_charm' },
      player: { hp: 40, maxHp: 500 },
      log: ['field survey metro anchor pointer smoke save']
    });
    await injectGameState(cdp, metro);
    await setViewport(cdp, 390, 844);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('[data-field-survey-id="survey_metro_lost_property"]') &&
        document.querySelector('[data-action="reward-current-lost_locker_reward"]:not(:disabled)') &&
        document.querySelector('[data-action="field-survey-survey_metro_lost_property-rift_anchor_lost_property"]:not(:disabled)') &&
        JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.tacticalLoadout?.itemIds) === JSON.stringify(['echo_coin'])`,
      'mobile metro survey carries and owns its echo coin'
    );
    await assertFieldSurveyHostLayout(cdp, {
      width: 390,
      height: 844,
      surveyId: 'survey_metro_lost_property',
      optionIds: ['rift_resonance_mirror_recast', 'rift_anchor_lost_property'],
      label: 'mobile metro field survey host'
    });
    const metroBefore = await evaluate(cdp, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return { rewardPoints: saved.rewardPoints, hp: saved.player.hp, maxHp: saved.player.maxHp };
    })()`);
    await clickElementByPointer(cdp, '[data-action="field-survey-survey_metro_lost_property-rift_anchor_lost_property"]');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const bag = saved.run?.lootBag;
        return saved.rewardPoints === ${metroBefore.rewardPoints + 48} && saved.inventory.echo_coin === 0 && saved.inventory.gate_sigil === 1 &&
          saved.player.hp > ${metroBefore.hp} && bag?.rewardPoints === 48 && bag?.items?.mirror_shell === 1 && bag?.items?.gate_sigil === 1 &&
          JSON.stringify(saved.run.usedItems) === JSON.stringify(['echo_coin']) &&
          saved.run.fieldSurveyState?.resolvedSurveys?.[0]?.optionId === 'rift_anchor_lost_property';
      })()`,
      'mobile metro anchor spends one carried coin, grants a gate sigil and 48 points, heals, and records bag usage'
    );
    await setViewport(cdp, 1440, 900);

    const legacy = makeFieldSurveyExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'demon_bone_cache',
      frozenSources: overdriveSource,
      equipmentAttunements: { starforged_edge: 'forge_overdrive' },
      rewardPoints: 1777,
      lingyun: 9,
      log: ['field survey legacy active run marker']
    });
    delete legacy.run.fieldSurveyState;
    await injectGameState(cdp, legacy);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return document.querySelector('[data-field-survey-state="legacy-disabled"]') && !Object.prototype.hasOwnProperty.call(saved.run, 'fieldSurveyState') &&
          saved.phase === 'explore' && saved.run.currentNodeId === 'demon_bone_cache' && saved.rewardPoints === 1777 && saved.lingyun === 9 &&
          saved.log?.includes('field survey legacy active run marker');
      })()`,
      'legacy active run stays field survey disabled without backfill'
    );
    await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
    await waitForPage(cdp, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !Object.prototype.hasOwnProperty.call(saved.run, 'fieldSurveyState') && saved.run.clearedNodeIds.includes('demon_bone_cache');
    })()`, 'legacy field survey run collects ordinary reward by pointer');

    const malformed = makeFieldSurveyExploreSave({
      dungeonId: 'starfall_mine',
      nodeId: 'resonant_pick_reward',
      frozenSources: channelingSource,
      equipmentAttunements: { starforged_edge: 'forge_channeling' },
      rewardPoints: 1666,
      lingyun: 8,
      inventory: { star_iron: 2 },
      log: ['field survey malformed active run marker']
    });
    malformed.run.fieldSurveyState.resolvedSurveys = [{
      surveyId: 'survey_mine_resonant_vein',
      optionId: 'forge_overdrive_overload_vein'
    }];
    await injectGameState(cdp, malformed);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return document.querySelector('[data-field-survey-state="legacy-disabled"]') && !Object.prototype.hasOwnProperty.call(saved.run, 'fieldSurveyState') &&
          saved.phase === 'explore' && saved.run.currentNodeId === 'resonant_pick_reward' && saved.rewardPoints === 1666 && saved.lingyun === 8 &&
          saved.inventory.star_iron === 2 && saved.log?.includes('field survey malformed active run marker');
      })()`,
      'malformed field survey state is removed without resetting the active run'
    );
    await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
    await waitForPage(cdp, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !Object.prototype.hasOwnProperty.call(saved.run, 'fieldSurveyState') && saved.run.clearedNodeIds.includes('resonant_pick_reward');
    })()`, 'malformed field survey run collects ordinary reward by pointer');
  } finally {
    await resetFieldSurveySmokeState(cdp, appUrl);
  }

  console.log('[smoke] field survey suite: protocol freeze, three real pointer branches, legacy/malformed recovery, persistence, and desktop/mobile layouts pass');
}

const EQUIPMENT_HUNT_DUNGEON_ID = 'demon_tower_1';
const EQUIPMENT_HUNT_TARGET_ID = 'armor_piercing_sword';
const EQUIPMENT_HUNT_TARGET_NAME = '破甲剑';
const EQUIPMENT_HUNT_CLUE_NODE_IDS = ['broken_sigil_reward', 'fallen_pack_reward'];
const EQUIPMENT_HUNT_UNOWNED_IDS = new Set([
  'armor_piercing_sword',
  'bone_spear',
  'mist_hood',
  'spirit_robe',
  'cloudstep_charm'
]);

function getEquipmentHuntOwnedEquipment() {
  return ADVANCED_OWNED_EQUIPMENT.filter((equipmentId) => !EQUIPMENT_HUNT_UNOWNED_IDS.has(equipmentId));
}

function getEquipmentHuntEquipmentLevels() {
  return Object.fromEntries(
    Object.entries(ADVANCED_EQUIPMENT_LEVELS).filter(([equipmentId]) => !EQUIPMENT_HUNT_UNOWNED_IDS.has(equipmentId))
  );
}

function getEquipmentHuntEquipped() {
  return {
    ...ADVANCED_EQUIPPED,
    head: 'patched_headwrap',
    charm: 'plain_charm'
  };
}

function makeEquipmentHuntHubSave() {
  const state = makeProtocolHubSave();
  state.ownedEquipment = getEquipmentHuntOwnedEquipment();
  state.equipmentLevels = getEquipmentHuntEquipmentLevels();
  state.equipped = getEquipmentHuntEquipped();
  state.log = ['equipment hunt protocol pointer smoke save'];
  return state;
}

function makeEquipmentHuntExploreSave({
  nodeId,
  crossedDungeonPortal = false,
  log = ['equipment hunt explore pointer smoke save']
}) {
  const state = makeExploreSave({
    dungeonId: EQUIPMENT_HUNT_DUNGEON_ID,
    nodeId,
    rewardPoints: 5000,
    lingyun: 10,
    inventory: {
      healing_pill: 30,
      thunder_talisman: 10,
      dispel_talisman: 10,
      gate_sigil: 5,
      echo_coin: 2,
      cycle_imprint: 0
    },
    ownedEquipment: getEquipmentHuntOwnedEquipment(),
    equipmentLevels: getEquipmentHuntEquipmentLevels(),
    equipped: getEquipmentHuntEquipped(),
    completedDungeonIds: [EQUIPMENT_HUNT_DUNGEON_ID],
    log
  });
  state.equipmentAttunements = {};
  state.preparedItemIds = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS];
  state.preparedEquipmentHunt = {
    dungeonId: EQUIPMENT_HUNT_DUNGEON_ID,
    targetEquipmentId: EQUIPMENT_HUNT_TARGET_ID
  };
  state.claimedTaskIds = ['mainline_clear_demon_tower_1'];
  state.run.tacticalLoadout = { rulesVersion: 1, itemIds: [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS] };
  state.run.protocol = { id: 'standard', rulesVersion: 1 };
  state.run.equipmentHunt = {
    rulesVersion: 1,
    dungeonId: EQUIPMENT_HUNT_DUNGEON_ID,
    targetEquipmentId: EQUIPMENT_HUNT_TARGET_ID,
    clueNodeIds: [...EQUIPMENT_HUNT_CLUE_NODE_IDS],
    crossedDungeonPortal
  };
  return state;
}

async function finishEquipmentHuntEliteByPointer(cdp, label) {
  await clickElementByPointer(cdp, '.node-action-panel [data-action^="fight-current-"]');
  await waitForPage(cdp, `document.querySelector('.combat-panel')`, `${label} combat starts`);

  for (let round = 0; round < 80; round += 1) {
    const combat = await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const panel = document.querySelector('.combat-panel');
        return {
          active: Boolean(panel),
          phase: saved.phase,
          hp: saved.player.hp,
          maxHp: saved.player.maxHp,
          canHeal: Boolean(panel?.querySelector('[data-action="combat-use_healing_pill"]:not(:disabled)')),
          skillReady: Boolean(panel?.querySelector('[data-action="combat-weapon_skill"]:not(:disabled)'))
        };
      })()`
    );
    if (!combat.active) {
      if (combat.phase === 'result') throw new Error(`${label} ended in failure instead of an equipment offer`);
      break;
    }

    if (combat.skillReady) {
      await clickElementByPointer(cdp, '[data-action="combat-weapon_skill"]');
    } else {
      await clickElementByPointer(
        cdp,
        combat.canHeal && combat.hp <= combat.maxHp * 0.55
          ? '[data-action="combat-use_healing_pill"]'
          : '[data-action="combat-attack"]'
      );
    }
  }

  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.cleared') &&
      document.querySelector('.equipment-loot-offer') &&
      !document.querySelector('.combat-panel')`,
    `${label} clears and opens equipment offer`
  );
}

async function getEquipmentHuntOfferSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const offer = document.querySelector('.equipment-loot-offer');
      if (!offer) throw new Error('Missing equipment hunt offer');
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const options = [...offer.querySelectorAll('.loot-offer-option')].map((option) => {
        const button = option.querySelector('button[data-action^="loot-select-"]');
        button?.scrollIntoView({ block: 'center', inline: 'center' });
        const optionRect = option.getBoundingClientRect();
        const buttonRect = button?.getBoundingClientRect();
        const x = buttonRect ? buttonRect.left + buttonRect.width / 2 : 0;
        const y = buttonRect ? Math.max(2, Math.min(innerHeight - 2, buttonRect.top + buttonRect.height / 2)) : 0;
        const hit = buttonRect ? document.elementFromPoint(x, y) : null;
        return {
          equipmentId: option.dataset.lootEquipmentId,
          actionId: button?.dataset.action,
          guaranteed: option.dataset.equipmentHuntGuaranteed === 'true',
          target: option.dataset.equipmentHuntTarget,
          text: compactText(option),
          insideX: optionRect.left >= -1 && optionRect.right <= innerWidth + 1,
          buttonHeight: buttonRect?.height ?? 0,
          pointerTarget: Boolean(button && hit && button.contains(hit))
        };
      });
      offer.scrollIntoView({ block: 'center', inline: 'center' });
      const offerRect = offer.getBoundingClientRect();
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        viewport: [innerWidth, innerHeight],
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        offerOverflow: offer.scrollWidth > offer.clientWidth + 1,
        offerInsideX: offerRect.left >= -1 && offerRect.right <= innerWidth + 1,
        options,
        guaranteedCount: offer.querySelectorAll('[data-equipment-hunt-guaranteed="true"]').length,
        statusState: document.querySelector('[data-equipment-hunt-state]')?.dataset.equipmentHuntState,
        pendingEquipmentIds: saved.run?.pendingEquipmentOffer?.equipmentIds ?? [],
        pendingGuaranteedEquipmentId: saved.run?.pendingEquipmentOffer?.guaranteedEquipmentId ?? null
      };
    })()`
  );
}

async function assertGuaranteedEquipmentHuntOffer(cdp) {
  const offer = await getEquipmentHuntOfferSnapshot(cdp);
  if (
    JSON.stringify(offer.viewport) !== JSON.stringify([390, 844]) ||
    offer.pageOverflow ||
    offer.offerOverflow ||
    !offer.offerInsideX ||
    offer.options.length !== 3 ||
    offer.options[0]?.equipmentId !== EQUIPMENT_HUNT_TARGET_ID ||
    offer.options.filter((option) => option.equipmentId === EQUIPMENT_HUNT_TARGET_ID).length !== 1 ||
    offer.guaranteedCount !== 1 ||
    !offer.options[0]?.guaranteed ||
    offer.options[0]?.target !== EQUIPMENT_HUNT_TARGET_ID ||
    !offer.options[0]?.text.includes('追猎目标') ||
    offer.options[0]?.actionId !== `loot-select-${EQUIPMENT_HUNT_TARGET_ID}` ||
    offer.options.some((option) => !option.insideX || option.buttonHeight < 40 || !option.pointerTarget) ||
    offer.pendingEquipmentIds[0] !== EQUIPMENT_HUNT_TARGET_ID ||
    offer.pendingGuaranteedEquipmentId !== EQUIPMENT_HUNT_TARGET_ID ||
    offer.statusState !== 'offering'
  ) {
    throw new Error(`Qualified equipment hunt should show one first-position guarantee in a mobile-safe three-choice offer: ${JSON.stringify(offer)}`);
  }
}

async function assertOrdinaryEquipmentOffer(cdp, label, expectedState) {
  const offer = await getEquipmentHuntOfferSnapshot(cdp);
  if (
    offer.options.length !== 3 ||
    offer.guaranteedCount !== 0 ||
    offer.options.some((option) => option.guaranteed || option.target || !option.pointerTarget) ||
    offer.pendingGuaranteedEquipmentId !== null ||
    offer.statusState !== expectedState
  ) {
    throw new Error(`${label} should fall back to the ordinary three-choice offer without a hunt guarantee: ${JSON.stringify(offer)}`);
  }
}

async function runEquipmentHuntSuccessfulPointerSmoke(cdp, appUrl) {
  await injectGameState(cdp, makeEquipmentHuntHubSave());
  await setViewport(cdp, 390, 844);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="open-protocol-${EQUIPMENT_HUNT_DUNGEON_ID}"]') &&
      !JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.ownedEquipment.includes('${EQUIPMENT_HUNT_TARGET_ID}')`,
    'equipment hunt protocol entry renders with an unowned target'
  );
  await clickElementByPointer(cdp, `[data-action="open-protocol-${EQUIPMENT_HUNT_DUNGEON_ID}"]`);
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-hunt-preparation="none"][data-equipment-hunt-target="none"]') &&
      document.querySelector('[data-action="prepare-equipment-hunt-${EQUIPMENT_HUNT_DUNGEON_ID}-${EQUIPMENT_HUNT_TARGET_ID}"]')`,
    'equipment hunt target appears in protocol modal'
  );
  await clickElementByPointer(
    cdp,
    `[data-action="prepare-equipment-hunt-${EQUIPMENT_HUNT_DUNGEON_ID}-${EQUIPMENT_HUNT_TARGET_ID}"]`
  );
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return document.querySelector('[data-equipment-hunt-preparation="prepared"][data-equipment-hunt-target="${EQUIPMENT_HUNT_TARGET_ID}"]') &&
        document.querySelector('[data-action="prepare-equipment-hunt-${EQUIPMENT_HUNT_DUNGEON_ID}-${EQUIPMENT_HUNT_TARGET_ID}"][aria-checked="true"]') &&
        JSON.stringify(saved.preparedEquipmentHunt) === JSON.stringify({
          dungeonId: '${EQUIPMENT_HUNT_DUNGEON_ID}',
          targetEquipmentId: '${EQUIPMENT_HUNT_TARGET_ID}'
        });
    })()`,
    'real pointer prepares equipment hunt target'
  );
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.protocol-sheet',
    targetSelectors: ['.protocol-equipment-hunt', '.protocol-equipment-hunt-options', '.protocol-modal-actions'],
    buttonSelectors: [
      `[data-action="prepare-equipment-hunt-${EQUIPMENT_HUNT_DUNGEON_ID}-${EQUIPMENT_HUNT_TARGET_ID}"]`,
      '[data-action="confirm-protocol-entry"]'
    ],
    checkRootOverflow: true,
    label: 'mobile equipment hunt protocol modal'
  });
  await clickElementByPointer(cdp, '[data-action="confirm-protocol-entry"]');

  const expectedSnapshot = {
    rulesVersion: 1,
    dungeonId: EQUIPMENT_HUNT_DUNGEON_ID,
    targetEquipmentId: EQUIPMENT_HUNT_TARGET_ID,
    clueNodeIds: [...EQUIPMENT_HUNT_CLUE_NODE_IDS],
    crossedDungeonPortal: false
  };
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' &&
        JSON.stringify(saved.run?.equipmentHunt) === ${JSON.stringify(JSON.stringify(expectedSnapshot))} &&
        document.querySelector('[data-equipment-hunt-state="seeking"][data-equipment-hunt-target="${EQUIPMENT_HUNT_TARGET_ID}"]');
    })()`,
    'protocol confirmation freezes equipment hunt into run'
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return JSON.stringify(saved.run?.equipmentHunt) === ${JSON.stringify(JSON.stringify(expectedSnapshot))} &&
        document.querySelector('[data-equipment-hunt-state="seeking"]');
    })()`,
    'frozen equipment hunt survives entry reload'
  );

  const eliteAvoidSelector = '[data-action="grid-butcher_turn"], [data-action="grid-bone_lane_monster"], [data-action="grid-tower_butcher_patrol"]';
  await walkToUnresolvedNodeByPointer(
    cdp,
    `[data-action="grid-${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]`,
    'equipment hunt first clue',
    eliteAvoidSelector
  );
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return document.querySelector('[data-equipment-hunt-clue="pending"][data-equipment-hunt-clue-id="${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"].current') &&
        document.querySelector('[data-equipment-hunt-state="seeking"]') &&
        !saved.run.clearedNodeIds.includes('${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}') &&
        saved.run.lootOffersMade === 0;
    })()`,
    'standing on equipment hunt clue remains unqualified'
  );
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.run-equipment-hunt-status',
    targetSelectors: ['.run-equipment-hunt-status', '.run-equipment-hunt-status > span:last-child'],
    checkRootOverflow: true,
    label: 'mobile equipment hunt status'
  });
  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.dungeon-map',
    targetSelectors: [
      '.dungeon-map',
      `[data-equipment-hunt-clue-id="${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]`,
      '.node-action-panel'
    ],
    buttonSelectors: [`[data-action="reward-current-${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]`],
    minimumButtonHeight: 40,
    checkRootOverflow: true,
    label: 'mobile equipment hunt clue map'
  });
  await clickElementByPointer(cdp, `[data-action="reward-current-${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]`);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.clearedNodeIds.includes('${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}') &&
        document.querySelector('[data-equipment-hunt-clue="collected"][data-equipment-hunt-clue-id="${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]') &&
        document.querySelector('[data-equipment-hunt-state="locked"]');
    })()`,
    'real reward collection qualifies equipment hunt'
  );

  await walkToUnresolvedNodeByPointer(
    cdp,
    '[data-action="grid-bone_lane_monster"]',
    'qualified equipment hunt elite',
    '[data-action="grid-butcher_turn"], [data-action="grid-tower_butcher_patrol"]'
  );
  await finishEquipmentHuntEliteByPointer(cdp, 'qualified equipment hunt elite');
  await assertGuaranteedEquipmentHuntOffer(cdp);
  await clickElementByPointer(cdp, `[data-action="loot-select-${EQUIPMENT_HUNT_TARGET_ID}"]`);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !document.querySelector('.equipment-loot-offer') &&
        document.querySelector('[data-equipment-hunt-state="selected"]') &&
        saved.run.lootBag.equipmentIds.filter((id) => id === '${EQUIPMENT_HUNT_TARGET_ID}').length === 1 &&
        !saved.ownedEquipment.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        saved.equipmentLevels['${EQUIPMENT_HUNT_TARGET_ID}'] === undefined;
    })()`,
    'real pointer selection stores hunt target only in run loot'
  );
  const selectedRunState = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return JSON.stringify(saved.run?.equipmentHunt) === ${JSON.stringify(JSON.stringify(expectedSnapshot))} &&
        saved.run.lootBag.equipmentIds.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        !saved.ownedEquipment.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        document.querySelector('[data-equipment-hunt-state="selected"]');
    })()`,
    'selected run loot and frozen hunt survive reload'
  );

  await clickGridCell(cdp, '白光裂口');
  await waitForPage(cdp, `document.querySelector('[data-action="exit-current-tower_exit"]:not(:disabled)')`, 'hunt exit opens');
  await clickElementByPointer(cdp, '[data-action="exit-current-tower_exit"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' &&
        saved.ownedEquipment.filter((id) => id === '${EQUIPMENT_HUNT_TARGET_ID}').length === 1 &&
        saved.equipmentLevels['${EQUIPMENT_HUNT_TARGET_ID}'] === 1 &&
        saved.run.lootBag.equipmentIds.length === 0 &&
        saved.run.lastLootSettlement?.retained.equipmentIds.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        !saved.run.lastLootSettlement?.lost.equipmentIds.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        document.querySelector('.loot-settlement')?.textContent.includes('${EQUIPMENT_HUNT_TARGET_NAME}');
    })()`,
    'successful exit banks hunt target at level one'
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' && saved.ownedEquipment.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        saved.equipmentLevels['${EQUIPMENT_HUNT_TARGET_ID}'] === 1 &&
        saved.run.lastLootSettlement?.retained.equipmentIds.includes('${EQUIPMENT_HUNT_TARGET_ID}');
    })()`,
    'banked level-one hunt target survives reload'
  );
  console.log('[smoke] equipment hunt success: mobile protocol, pointer clue qualification, first/unique guarantee, run-only selection, clear banking, and reload persistence pass');
  return selectedRunState;
}

async function runEquipmentHuntOrderAndPortalSmoke(cdp, appUrl) {
  const earlyElite = makeEquipmentHuntExploreSave({
    nodeId: 'bone_lane_monster',
    log: ['equipment hunt early elite pointer smoke save']
  });
  await injectGameState(cdp, earlyElite);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-equipment-hunt-state="seeking"]')`, 'early elite hunt renders');
  await finishEquipmentHuntEliteByPointer(cdp, 'equipment hunt elite before clue');
  await assertOrdinaryEquipmentOffer(cdp, 'elite before clue', 'order-expired');
  await clickElementByPointer(cdp, '[data-action="loot-decline-equipment"]');
  await waitForPage(cdp, `document.querySelector('[data-equipment-hunt-state="order-expired"]')`, 'early elite expires hunt');
  await walkToUnresolvedNodeByPointer(
    cdp,
    `[data-action="grid-${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]`,
    'late equipment hunt clue',
    '[data-action="grid-butcher_turn"], [data-action="grid-tower_butcher_patrol"]'
  );
  await clickElementByPointer(cdp, `[data-action="reward-current-${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]`);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.clearedNodeIds.includes('${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}') &&
        saved.run.lootOffersMade === 1 && !saved.run.pendingEquipmentOffer &&
        document.querySelector('[data-equipment-hunt-state="order-expired"]') &&
        !document.querySelector('[data-equipment-hunt-guaranteed="true"]');
    })()`,
    'late clue collection never retroactively guarantees target'
  );

  const portal = makeEquipmentHuntExploreSave({
    nodeId: 'cracked_portal',
    log: ['equipment hunt cross portal pointer smoke save']
  });
  await injectGameState(cdp, portal);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('[data-action="portal-stabilize-cracked_portal"]:not(:disabled)')`, 'equipment hunt portal renders');
  await clickElementByPointer(cdp, '[data-action="portal-stabilize-cracked_portal"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'metro_abyss' && saved.run.currentNodeId === 'platform_arrival' &&
        saved.run.equipmentHunt?.crossedDungeonPortal === true &&
        saved.run.equipmentHunt?.targetEquipmentId === '${EQUIPMENT_HUNT_TARGET_ID}' &&
        document.querySelector('[data-equipment-hunt-state="crossed"]');
    })()`,
    'real stable portal permanently crosses equipment hunt'
  );
  await clickElementByPointer(cdp, '[data-action="reward-current-platform_arrival"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.lawState?.law?.tide === 'flood' &&
        document.querySelector('.dungeon-law-status[data-law-status="涨潮"]');
    })()`,
    'crossed hunt landing reward advances tide to flood'
  );
  await clickGridCell(cdp, '排水渠补给');
  await waitForPage(cdp, `document.querySelector('[data-action="reward-current-drainage_cache"]')`, 'crossed hunt reaches drainage cache');
  await clickElementByPointer(cdp, '[data-action="reward-current-drainage_cache"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.lawState?.law?.tide === 'mirror' &&
        document.querySelector('.dungeon-law-status[data-law-status="镜潮"]');
    })()`,
    'crossed hunt drainage reward advances tide to mirror'
  );
  await clickGridCell(cdp, '撑篙回声');
  await waitForPage(cdp, `document.querySelector('[data-action="fight-current-boatman_echo"]')`, 'crossed hunt reaches boatman echo');
  await finishProtocolCombatByPointer(cdp, 'crossed hunt boatman echo');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const bossLane = document.querySelector('[data-action="grid-mirror_thread_spider"][data-route-gate-id="metro_ebb_boss_lane"]');
      return saved.run.lawState?.law?.tide === 'ebb' &&
        document.querySelector('.dungeon-law-status[data-law-status="退潮"]') &&
        bossLane?.dataset.routeGateStatus === 'open' && bossLane.classList.contains('movable') && !bossLane.disabled;
    })()`,
    'crossed hunt boatman echo opens ebb boss lane'
  );
  await clickGridCell(cdp, '镜丝织蛛');
  await waitForPage(cdp, `document.querySelector('.grid-node.current[data-action="grid-mirror_thread_spider"]')`, 'crossed hunt reaches mirror thread spider');
  await finishEquipmentHuntEliteByPointer(cdp, 'crossed hunt metro elite');
  await assertOrdinaryEquipmentOffer(cdp, 'cross-dungeon portal', 'crossed');
  await clickElementByPointer(cdp, '[data-action="loot-decline-equipment"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.equipmentHunt?.crossedDungeonPortal === true && saved.run.lootOffersMade === 1 &&
        document.querySelector('[data-equipment-hunt-state="crossed"]') &&
        !document.querySelector('[data-equipment-hunt-guaranteed="true"]');
    })()`,
    'crossed hunt stays expired after ordinary elite offer'
  );
  console.log('[smoke] equipment hunt invalidation: elite-before-clue cannot backfill, and a real cross-dungeon portal permanently falls back to ordinary loot');
}

async function runEquipmentHuntRetreatSmoke(cdp, appUrl, selectedRunState) {
  await injectGameState(cdp, selectedRunState);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run.lootBag.equipmentIds.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        !saved.ownedEquipment.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        document.querySelector('[data-action="abandon-run"]:not(:disabled)');
    })()`,
    'pointer-produced selected hunt run restores before retreat'
  );
  await clickElementByPointer(cdp, '[data-action="abandon-run"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' && !saved.ownedEquipment.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        saved.equipmentLevels['${EQUIPMENT_HUNT_TARGET_ID}'] === undefined &&
        saved.run.lootBag.equipmentIds.length === 0 &&
        saved.run.lastLootSettlement?.lost.equipmentIds.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        !saved.run.lastLootSettlement?.retained.equipmentIds.includes('${EQUIPMENT_HUNT_TARGET_ID}') &&
        document.querySelector('.loot-settlement')?.textContent.includes('${EQUIPMENT_HUNT_TARGET_NAME}');
    })()`,
    'real pointer retreat loses selected hunt target'
  );
  console.log('[smoke] equipment hunt retreat loses the pointer-selected run loot without creating owned equipment or a level');
}

async function runEquipmentHuntSaveCompatibilitySmoke(cdp, appUrl) {
  const malformedPreparation = makeEquipmentHuntExploreSave({
    nodeId: EQUIPMENT_HUNT_CLUE_NODE_IDS[0],
    log: ['malformed equipment hunt preparation marker']
  });
  malformedPreparation.rewardPoints = 4321;
  malformedPreparation.inventory.rift_dust = 2;
  malformedPreparation.preparedEquipmentHunt = {
    dungeonId: EQUIPMENT_HUNT_DUNGEON_ID,
    targetEquipmentId: 'void_lantern'
  };
  await injectGameState(cdp, malformedPreparation);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !Object.prototype.hasOwnProperty.call(saved, 'preparedEquipmentHunt') &&
        saved.run.equipmentHunt?.targetEquipmentId === '${EQUIPMENT_HUNT_TARGET_ID}' &&
        saved.phase === 'explore' && saved.run.currentNodeId === '${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}' &&
        saved.rewardPoints === 4321 && saved.inventory.rift_dust === 2 &&
        saved.log.includes('malformed equipment hunt preparation marker') &&
        document.querySelector('[data-equipment-hunt-state="seeking"]');
    })()`,
    'malformed equipment hunt preparation is removed in isolation'
  );

  const missingRunSnapshot = makeEquipmentHuntExploreSave({
    nodeId: EQUIPMENT_HUNT_CLUE_NODE_IDS[1],
    log: ['missing legacy equipment hunt run marker']
  });
  missingRunSnapshot.rewardPoints = 4210;
  missingRunSnapshot.inventory.hidden_stone = 3;
  delete missingRunSnapshot.run.equipmentHunt;
  await injectGameState(cdp, missingRunSnapshot);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !Object.prototype.hasOwnProperty.call(saved.run, 'equipmentHunt') &&
        saved.preparedEquipmentHunt?.targetEquipmentId === '${EQUIPMENT_HUNT_TARGET_ID}' &&
        saved.phase === 'explore' && saved.run.currentNodeId === '${EQUIPMENT_HUNT_CLUE_NODE_IDS[1]}' &&
        saved.rewardPoints === 4210 && saved.inventory.hidden_stone === 3 &&
        saved.log.includes('missing legacy equipment hunt run marker') &&
        !document.querySelector('[data-equipment-hunt-state]');
    })()`,
    'missing legacy equipment hunt snapshot stays disabled without backfill'
  );

  const malformedRunSnapshot = makeEquipmentHuntExploreSave({
    nodeId: EQUIPMENT_HUNT_CLUE_NODE_IDS[0],
    log: ['malformed equipment hunt run marker']
  });
  malformedRunSnapshot.rewardPoints = 4190;
  malformedRunSnapshot.lingyun = 7;
  malformedRunSnapshot.inventory.star_iron = 2;
  malformedRunSnapshot.run.equipmentHunt.rulesVersion = 2;
  await injectGameState(cdp, malformedRunSnapshot);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !Object.prototype.hasOwnProperty.call(saved.run, 'equipmentHunt') &&
        saved.preparedEquipmentHunt?.targetEquipmentId === '${EQUIPMENT_HUNT_TARGET_ID}' &&
        saved.phase === 'explore' && saved.run.currentNodeId === '${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}' &&
        saved.rewardPoints === 4190 && saved.lingyun === 7 && saved.inventory.star_iron === 2 &&
        saved.run.protocol?.id === 'standard' && saved.run.tacticalLoadout?.itemIds.includes('gate_sigil') &&
        saved.claimedTaskIds.includes('mainline_clear_demon_tower_1') &&
        saved.log.includes('malformed equipment hunt run marker') &&
        !document.querySelector('[data-equipment-hunt-state]') &&
        document.querySelector('[data-action="reward-current-${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]:not(:disabled)');
    })()`,
    'malformed equipment hunt run snapshot is removed in isolation'
  );
  await clickElementByPointer(cdp, `[data-action="reward-current-${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}"]`);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !Object.prototype.hasOwnProperty.call(saved.run, 'equipmentHunt') &&
        saved.run.clearedNodeIds.includes('${EQUIPMENT_HUNT_CLUE_NODE_IDS[0]}') &&
        saved.preparedEquipmentHunt?.targetEquipmentId === '${EQUIPMENT_HUNT_TARGET_ID}';
    })()`,
    'malformed run continues normally after local hunt cleanup'
  );
  console.log('[smoke] equipment hunt save recovery removes only malformed preparation/run fields and never backfills a missing legacy run snapshot');
}

async function runEquipmentHuntSmoke(cdp, appUrl) {
  try {
    const selectedRunState = await runEquipmentHuntSuccessfulPointerSmoke(cdp, appUrl);
    await runEquipmentHuntOrderAndPortalSmoke(cdp, appUrl);
    await runEquipmentHuntRetreatSmoke(cdp, appUrl, selectedRunState);
    await runEquipmentHuntSaveCompatibilitySmoke(cdp, appUrl);
  } finally {
    await resetEquipmentSoulSmokeState(cdp, appUrl);
  }

  console.log('[smoke] equipment hunt suite: pointer preparation, clue timing, guarantee order, loot settlement, invalidation, recovery, persistence, and 390x844 layout pass');
}

const EQUIPMENT_MEMORY_HUNT_DUNGEON_ID = 'demon_tower_1';
const EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID = 'starforged_edge';
const EQUIPMENT_MEMORY_HUNT_MEMORY_ID = 'equipment_memory_demon_tower_1';
const EQUIPMENT_MEMORY_EXISTING_ID = 'equipment_memory_metro_abyss';
const EQUIPMENT_MEMORY_ROUTE_CONTRACT_ID = 'tower_mist_watch';

function makeEquipmentMemoryHubSave() {
  const state = makeEquipmentHuntHubSave();
  state.inventory.cycle_imprint = 1;
  state.learnedMethods = ['mist_breathing'];
  state.equipmentAttunements = { [EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID]: 'forge_overdrive' };
  state.equipmentTemperRanks = { [EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID]: 2 };
  state.equipmentMemories = {
    [EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID]: {
      unlockedIds: [EQUIPMENT_MEMORY_EXISTING_ID],
      activeId: EQUIPMENT_MEMORY_EXISTING_ID
    }
  };
  state.log = ['equipment memory hunt pointer smoke save'];
  return state;
}

function makeEquipmentMemoryLegacyRunSave() {
  const state = makeExploreSave({
    dungeonId: EQUIPMENT_MEMORY_HUNT_DUNGEON_ID,
    nodeId: 'fog_lesser_demon',
    rewardPoints: 5000,
    lingyun: 10,
    inventory: {
      healing_pill: 30,
      dispel_talisman: 10,
      gate_sigil: 5,
      cycle_imprint: 1
    },
    ownedEquipment: getEquipmentHuntOwnedEquipment(),
    equipmentLevels: getEquipmentHuntEquipmentLevels(),
    equipmentAttunements: { [EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID]: 'forge_overdrive' },
    equipmentTemperRanks: { [EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID]: 2 },
    equipped: getEquipmentHuntEquipped(),
    learnedMethods: ['mist_breathing'],
    completedDungeonIds: [EQUIPMENT_MEMORY_HUNT_DUNGEON_ID],
    log: ['legacy equipment memory run without snapshot fields']
  });
  state.equipmentMemories = {
    [EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID]: {
      unlockedIds: [EQUIPMENT_MEMORY_EXISTING_ID],
      activeId: EQUIPMENT_MEMORY_EXISTING_ID
    }
  };
  state.claimedTaskIds = ['mainline_clear_demon_tower_1'];
  state.preparedItemIds = [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS];
  state.run.tacticalLoadout = { rulesVersion: 1, itemIds: [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS] };
  state.run.protocol = { id: 'standard', rulesVersion: 1 };
  return state;
}

async function assertEquipmentMemoryViewportLayout(
  cdp,
  { width, height, rootSelector, keyTextSelectors, checkMapMarks = false, label }
) {
  await setViewport(cdp, width, height);
  const snapshot = await evaluate(
    cdp,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      if (!root) throw new Error('Missing equipment memory layout root: ${rootSelector}');
      const selectors = ${JSON.stringify(keyTextSelectors)};
      const textElements = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
      const clippedText = textElements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const clipped = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
        const outsideX = rect.left < -1 || rect.right > window.innerWidth + 1;
        return clipped || outsideX
          ? [{ selector: selectors.find((selector) => element.matches(selector)) ?? element.tagName, text: element.textContent.replace(/\\s+/g, ' ').trim(), clipped, outsideX }]
          : [];
      });
      const intersects = (left, right) =>
        Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
        Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
      const target = document.querySelector('[data-equipment-memory-target]');
      const memoryMark = target?.querySelector('.equipment-memory-mark');
      const protectedMarks = [...document.querySelectorAll('.route-contract-order-mark, .protocol-anchor-mark')];
      const targetRect = target?.getBoundingClientRect();
      const memoryRect = memoryMark?.getBoundingClientRect();
      const markCollisions = memoryRect
        ? protectedMarks.filter((mark) => intersects(memoryRect, mark.getBoundingClientRect())).map((mark) => mark.className)
        : [];
      return {
        viewport: [window.innerWidth, window.innerHeight],
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
        rootOverflow: root.scrollWidth > root.clientWidth + 1,
        clippedText,
        memoryMarkExists: Boolean(memoryMark),
        memoryMarkInsideTarget: Boolean(memoryRect && targetRect && memoryRect.left >= targetRect.left - 1 && memoryRect.right <= targetRect.right + 1 && memoryRect.top >= targetRect.top - 1 && memoryRect.bottom <= targetRect.bottom + 1),
        memoryMarkPointerTransparent: memoryMark ? getComputedStyle(memoryMark).pointerEvents === 'none' : false,
        protectedMarkCount: protectedMarks.length,
        protectedMarksInsideNodes: protectedMarks.every((mark) => {
          const rect = mark.getBoundingClientRect();
          const nodeRect = mark.closest('.grid-node')?.getBoundingClientRect();
          return Boolean(nodeRect && rect.left >= nodeRect.left - 1 && rect.right <= nodeRect.right + 1 && rect.top >= nodeRect.top - 1 && rect.bottom <= nodeRect.bottom + 1);
        }),
        markCollisions
      };
    })()`
  );
  if (
    JSON.stringify(snapshot.viewport) !== JSON.stringify([width, height]) ||
    snapshot.pageOverflow ||
    snapshot.rootOverflow ||
    snapshot.clippedText.length > 0 ||
    (checkMapMarks && (
      !snapshot.memoryMarkExists ||
      !snapshot.memoryMarkInsideTarget ||
      !snapshot.memoryMarkPointerTransparent ||
      snapshot.protectedMarkCount < 3 ||
      !snapshot.protectedMarksInsideNodes ||
      snapshot.markCollisions.length > 0
    ))
  ) {
    throw new Error(`${label} should stay horizontally contained, readable, and collision-free: ${JSON.stringify(snapshot)}`);
  }
  return snapshot;
}

async function changeEquipmentMemorySelectByKeyboard(cdp, selector, targetValue) {
  const movement = await evaluate(
    cdp,
    `(() => {
      const select = document.querySelector(${JSON.stringify(selector)});
      if (!(select instanceof HTMLSelectElement)) throw new Error('Missing equipment memory select: ${selector}');
      const targetIndex = [...select.options].findIndex((option) => option.value === ${JSON.stringify(targetValue)});
      if (targetIndex < 0) throw new Error('Missing equipment memory option: ${targetValue}');
      return { direction: targetIndex >= select.selectedIndex ? 'ArrowDown' : 'ArrowUp', count: Math.abs(targetIndex - select.selectedIndex) };
    })()`
  );
  await clickElementByPointer(cdp, selector);
  const keyCode = movement.direction === 'ArrowDown' ? 40 : 38;
  for (let index = 0; index < movement.count; index += 1) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: movement.direction,
      code: movement.direction,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: movement.direction,
      code: movement.direction,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode
    });
  }
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13
  });
}

async function runEquipmentMemoryHuntSmoke(cdp, appUrl) {
  let cleanupEvidence;
  const viewportEvidence = {};

  try {
    await setViewport(cdp, 390, 844);
    await injectGameState(cdp, makeEquipmentMemoryLegacyRunSave());
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.phase === 'explore' &&
          !Object.prototype.hasOwnProperty.call(saved.run, 'equipmentMemorySnapshot') &&
          !Object.prototype.hasOwnProperty.call(saved.run, 'equipmentMemoryHunt') &&
          !document.querySelector('.run-equipment-memory-hunt-status') &&
          saved.log.includes('legacy equipment memory run without snapshot fields');
      })()`,
      'legacy equipment memory run stays disabled without snapshot backfill'
    );

    await injectGameState(cdp, makeEquipmentMemoryHubSave());
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `document.querySelector('[data-action="open-protocol-${EQUIPMENT_MEMORY_HUNT_DUNGEON_ID}"]') &&
        JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentTemperRanks?.${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID} === 2`,
      'mature equipment memory hunt hub renders'
    );
    await clickElementByPointer(cdp, `[data-action="open-protocol-${EQUIPMENT_MEMORY_HUNT_DUNGEON_ID}"]`);
    await waitForPage(
      cdp,
      `document.querySelector('.protocol-equipment-memory-hunt') &&
        document.querySelector('[data-equipment-memory-option="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]')`,
      'equipment memory hunt protocol controls render'
    );

    await clickElementByPointer(cdp, `[data-equipment-memory-option="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]`);
    await clickElementByPointer(cdp, `[data-route-contract-option="${EQUIPMENT_MEMORY_ROUTE_CONTRACT_ID}"]`);
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const memoryOption = document.querySelector('[data-equipment-memory-option="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]');
        return document.querySelector('.protocol-equipment-memory-hunt[data-equipment-memory-preparation="prepared"][data-equipment-memory-id="${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}"]') &&
          memoryOption?.dataset.equipmentMemorySelected === 'true' &&
          memoryOption?.dataset.equipmentMemoryId === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}' &&
          memoryOption?.dataset.equipmentMemoryCollection === '1' &&
          document.querySelector('.protocol-route-contract[data-route-contract-selected="${EQUIPMENT_MEMORY_ROUTE_CONTRACT_ID}"]') &&
          document.querySelector('.protocol-equipment-hunt[data-hunt-conflict="memory"]') &&
          [...document.querySelectorAll('.protocol-equipment-hunt-option')].every((button) => button.disabled) &&
          saved.preparedEquipmentMemoryHunt?.equipmentId === '${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}' &&
          saved.preparedEquipmentMemoryHunt?.memoryId === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}';
      })()`,
      'pointer memory selection coexists with route contract and disables ordinary equipment hunt'
    );

    await clickElementByPointer(
      cdp,
      `[data-action="prepare-equipment-hunt-${EQUIPMENT_MEMORY_HUNT_DUNGEON_ID}-${EQUIPMENT_HUNT_TARGET_ID}"]`
    );
    await delay(120);
    const conflictState = await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return {
          memoryEquipmentId: saved.preparedEquipmentMemoryHunt?.equipmentId,
          ordinaryHunt: saved.preparedEquipmentHunt ?? null,
          conflict: document.querySelector('.protocol-equipment-hunt')?.dataset.huntConflict,
          ordinaryButtonDisabled: document.querySelector('[data-action="prepare-equipment-hunt-${EQUIPMENT_MEMORY_HUNT_DUNGEON_ID}-${EQUIPMENT_HUNT_TARGET_ID}"]')?.disabled
        };
      })()`
    );
    if (
      conflictState.memoryEquipmentId !== EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID ||
      conflictState.ordinaryHunt !== null ||
      conflictState.conflict !== 'memory' ||
      !conflictState.ordinaryButtonDisabled
    ) {
      throw new Error(`Disabled ordinary hunt must not silently replace the memory hunt: ${JSON.stringify(conflictState)}`);
    }

    for (const mode of ['imprint', 'deep', 'standard', 'imprint']) {
      await clickElementByPointer(cdp, `[data-protocol-mode="${mode}"]`);
      await waitForPage(
        cdp,
        `document.querySelector('[data-selected-protocol="${mode}"]') &&
          document.querySelector('[data-equipment-memory-option="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"][data-equipment-memory-selected="true"]') &&
          document.querySelector('.protocol-route-contract[data-route-contract-selected="${EQUIPMENT_MEMORY_ROUTE_CONTRACT_ID}"]')`,
        `equipment memory selection survives ${mode} protocol switch`
      );
    }

    viewportEvidence.mobileProtocol = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 390,
      height: 844,
      rootSelector: '.protocol-sheet',
      keyTextSelectors: [
        '.protocol-equipment-memory-heading strong',
        '[data-equipment-memory-selected="true"] .equipment-memory-option-title strong',
        '[data-equipment-memory-selected="true"] .equipment-memory-option-title b',
        '[data-equipment-memory-selected="true"] > small',
        '.protocol-equipment-hunt .equipment-hunt-conflict'
      ],
      label: '390x844 equipment memory protocol'
    });
    viewportEvidence.desktopProtocol = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 1440,
      height: 900,
      rootSelector: '.protocol-sheet',
      keyTextSelectors: [
        '.protocol-equipment-memory-heading strong',
        '[data-equipment-memory-selected="true"] .equipment-memory-option-title strong',
        '[data-equipment-memory-selected="true"] .equipment-memory-option-title b',
        '[data-equipment-memory-selected="true"] > small',
        '.protocol-equipment-hunt .equipment-hunt-conflict'
      ],
      label: '1440x900 equipment memory protocol'
    });

    await setViewport(cdp, 390, 844);
    await clickElementByPointer(cdp, '[data-action="confirm-protocol-entry"]');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const snapshot = saved.run?.equipmentMemorySnapshot;
        const hunt = saved.run?.equipmentMemoryHunt;
        return saved.phase === 'explore' && saved.run?.protocol?.id === 'imprint' &&
          saved.run?.routeContractState?.contractId === '${EQUIPMENT_MEMORY_ROUTE_CONTRACT_ID}' &&
          snapshot?.rulesVersion === 1 && snapshot.activeEntries.some((entry) =>
            entry.equipmentId === '${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}' && entry.memoryId === '${EQUIPMENT_MEMORY_EXISTING_ID}'
          ) &&
          hunt?.equipmentId === '${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}' &&
          hunt?.memoryId === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}' && hunt?.status === 'active' &&
          document.querySelector('[data-equipment-memory-target="${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}"] .equipment-memory-mark');
      })()`,
      'real protocol entry freezes memory snapshot and hunt'
    );

    await cdp.send('Page.reload', { ignoreCache: true });
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.run?.equipmentMemorySnapshot?.activeEntries.some((entry) =>
          entry.equipmentId === '${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}' && entry.memoryId === '${EQUIPMENT_MEMORY_EXISTING_ID}'
        ) && saved.run?.equipmentMemoryHunt?.memoryId === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}' &&
          document.querySelector('[data-equipment-memory-status="0/2"]');
      })()`,
      'equipment memory snapshot and hunt survive entry reload'
    );

    viewportEvidence.mobileMap = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 390,
      height: 844,
      rootSelector: '.dungeon-map',
      keyTextSelectors: [
        '[data-equipment-memory-target] > .node-type-label',
        '[data-equipment-memory-target] > strong',
        '[data-equipment-memory-target] > small',
        '.run-equipment-memory-hunt-status strong'
      ],
      checkMapMarks: true,
      label: '390x844 equipment memory map'
    });
    viewportEvidence.desktopMap = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 1440,
      height: 900,
      rootSelector: '.dungeon-map',
      keyTextSelectors: [
        '[data-equipment-memory-target] > .node-type-label',
        '[data-equipment-memory-target] > strong',
        '[data-equipment-memory-target] > small',
        '.run-equipment-memory-hunt-status strong'
      ],
      checkMapMarks: true,
      label: '1440x900 equipment memory map'
    });

    await setViewport(cdp, 390, 844);
    await walkToUnresolvedNodeByPointer(
      cdp,
      `[data-equipment-memory-target="${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}"]`,
      'equipment memory target node',
      '.boss-node'
    );
    await waitForPage(
      cdp,
      `document.querySelector('[data-equipment-memory-target="${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}"].current[data-equipment-memory-status="pending"]') &&
        document.querySelector('.dungeon-event-card')?.textContent.includes('血字阶梯的呼吸')`,
      'memory target event and pending node signal render'
    );
    await clickElementByPointer(cdp, '[data-action="event-blood_rune_stair-breathe_through_runes"]');
    await waitForPage(
      cdp,
      `(() => {
        const hunt = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.equipmentMemoryHunt;
        return hunt?.eventSucceeded === true && hunt?.nodeCleared === false && hunt?.status === 'active' &&
          document.querySelector('[data-equipment-memory-status="1/2"]');
      })()`,
      'real event option completes the memory event signal only'
    );
    await resolveCurrentProtocolNodeByPointer(cdp, 'equipment memory target trap');
    await waitForPage(
      cdp,
      `(() => {
        const hunt = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.equipmentMemoryHunt;
        return hunt?.eventSucceeded === true && hunt?.nodeCleared === true && hunt?.status === 'secured' &&
          document.querySelector('[data-equipment-memory-status="secured"]') &&
          document.querySelector('[data-equipment-memory-target="${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}"][data-equipment-memory-status="completed"] .equipment-memory-mark.state-completed');
      })()`,
      'real trap action completes the second memory signal'
    );

    await walkProtocolRouteByPointer(cdp, '.protocol-anchor-node', 'equipment memory imprint anchor', '.boss-node');
    await waitForPage(
      cdp,
      `document.querySelector('[data-run-protocol="imprint"][data-protocol-anchor-complete="true"]') &&
        document.querySelector('.protocol-anchor-node.cleared')`,
      'memory hunt keeps imprint anchor completion independent'
    );
    await walkProtocolRouteByPointer(cdp, '.boss-node', 'equipment memory boss route', '[data-action="grid-mist_herb_cache"]');
    await waitForPage(
      cdp,
      `document.querySelector('.boss-node.cleared') && document.querySelector('[data-equipment-memory-status="secured"]')`,
      'memory remains secured after real Boss combat'
    );
    await walkProtocolRouteByPointer(cdp, '.type-exit', 'equipment memory exit route');
    await clickElementByPointer(cdp, '[data-action="exit-current-tower_exit"]');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const settlement = saved.run?.lastEquipmentMemoryHuntSettlement;
        const entry = saved.equipmentMemories?.${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID};
        const element = document.querySelector('[data-equipment-memory-settlement="banked"][data-equipment-memory-granted="true"][data-equipment-memory-id="${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}"][data-equipment-memory-equipment="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]');
        return saved.phase === 'result' && settlement?.granted === true &&
          JSON.stringify(Object.keys(settlement).sort()) === JSON.stringify(['granted', 'state']) &&
          entry?.unlockedIds.includes('${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}') &&
          entry?.unlockedIds.includes('${EQUIPMENT_MEMORY_EXISTING_ID}') &&
          entry?.activeId === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}' &&
          element?.textContent.includes('额外奖励点 +0');
      })()`,
      'equipment memory settlement grants permanent active memory with zero extra reward points'
    );

    viewportEvidence.mobileResult = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 390,
      height: 844,
      rootSelector: '.result-panel',
      keyTextSelectors: [
        '.equipment-memory-settlement span',
        '.equipment-memory-settlement strong',
        '.equipment-memory-settlement small'
      ],
      label: '390x844 equipment memory settlement'
    });
    viewportEvidence.desktopResult = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 1440,
      height: 900,
      rootSelector: '.result-panel',
      keyTextSelectors: [
        '.equipment-memory-settlement span',
        '.equipment-memory-settlement strong',
        '.equipment-memory-settlement small'
      ],
      label: '1440x900 equipment memory settlement'
    });

    await cdp.send('Page.reload', { ignoreCache: true });
    await waitForPage(
      cdp,
      `document.querySelector('[data-equipment-memory-settlement="banked"][data-equipment-memory-granted="true"]') &&
        JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentMemories?.${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}?.activeId === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}'`,
      'banked equipment memory settlement and active map survive reload'
    );
    await clickElementByPointer(cdp, '[data-action="return-hub"]');
    await waitForPage(
      cdp,
      `document.querySelector('.character-trigger') &&
        JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentMemories?.${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}?.activeId === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}'`,
      'banked equipment memory returns to hub as active'
    );

    await setViewport(cdp, 390, 844);
    await clickButtonByPointer(cdp, '角色', '.topbar');
    await waitForPage(
      cdp,
      `(() => {
        const select = document.querySelector('[data-equipment-memory-select="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]');
        return select?.value === '${EQUIPMENT_MEMORY_HUNT_MEMORY_ID}' &&
          [...select.options].some((option) => option.value === '${EQUIPMENT_MEMORY_EXISTING_ID}');
      })()`,
      'character sheet exposes both unlocked memories in the real select'
    );
    viewportEvidence.mobileCharacter = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 390,
      height: 844,
      rootSelector: '.character-sheet',
      keyTextSelectors: [
        `[data-equipment-memory-equipment="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"] > span > strong`,
        `[data-equipment-memory-equipment="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"] > span > small`
      ],
      label: '390x844 equipment memory character library'
    });
    viewportEvidence.desktopCharacter = await assertEquipmentMemoryViewportLayout(cdp, {
      width: 1440,
      height: 900,
      rootSelector: '.character-sheet',
      keyTextSelectors: [
        `[data-equipment-memory-equipment="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"] > span > strong`,
        `[data-equipment-memory-equipment="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"] > span > small`
      ],
      label: '1440x900 equipment memory character library'
    });

    await setViewport(cdp, 390, 844);
    await changeEquipmentMemorySelectByKeyboard(
      cdp,
      `[data-equipment-memory-select="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]`,
      EQUIPMENT_MEMORY_EXISTING_ID
    );
    await waitForPage(
      cdp,
      `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentMemories?.${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}?.activeId === '${EQUIPMENT_MEMORY_EXISTING_ID}' &&
        document.querySelector('[data-equipment-memory-select="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]')?.value === '${EQUIPMENT_MEMORY_EXISTING_ID}'`,
      'real select keyboard change switches active equipment memory'
    );
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitForPage(
      cdp,
      `document.querySelector('.character-trigger') &&
        JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipmentMemories?.${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}?.activeId === '${EQUIPMENT_MEMORY_EXISTING_ID}'`,
      'selected active equipment memory survives reload'
    );
    await clickButtonByPointer(cdp, '角色', '.topbar');
    await waitForPage(
      cdp,
      `document.querySelector('[data-equipment-memory-select="${EQUIPMENT_MEMORY_HUNT_EQUIPMENT_ID}"]')?.value === '${EQUIPMENT_MEMORY_EXISTING_ID}'`,
      'reopened character sheet restores the selected active memory'
    );
  } finally {
    await evaluate(
      cdp,
      `(() => {
        localStorage.removeItem(${JSON.stringify(STORAGE_KEY)});
        return true;
      })()`
    );
    await setViewport(cdp, 1440, 900);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(
      cdp,
      `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
        document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
      'equipment memory smoke cleanup restores a clean desktop hub'
    );
    cleanupEvidence = await evaluate(
      cdp,
      `(() => ({
        storageCleared: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null,
        viewport: [window.innerWidth, window.innerHeight],
        memorySettlementCount: document.querySelectorAll('[data-equipment-memory-settlement]').length,
        memorySelectCount: document.querySelectorAll('[data-equipment-memory-select]').length
      }))()`
    );
    if (
      !cleanupEvidence.storageCleared ||
      JSON.stringify(cleanupEvidence.viewport) !== JSON.stringify([1440, 900]) ||
      cleanupEvidence.memorySettlementCount !== 0 ||
      cleanupEvidence.memorySelectCount !== 0
    ) {
      throw new Error(`Equipment memory smoke cleanup did not fully restore the test surface: ${JSON.stringify(cleanupEvidence)}`);
    }
  }

  console.log(
    `[smoke] equipment memory hunt: legacy no-backfill, pointer preparation/conflict/modes, dual-signal route, Boss exit, settlement, active select reload, 390x844 + 1440x900 layouts, and cleanup pass; map marks ${viewportEvidence.mobileMap.protectedMarkCount}/${viewportEvidence.desktopMap.protectedMarkCount}; cleanup=${JSON.stringify(cleanupEvidence)}`
  );
}

async function getPressureUiState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const read = (name) => document.querySelector('[data-pressure-' + name + ']')?.getAttribute('data-pressure-' + name) ?? null;
      return {
        status: read('status'),
        tier: read('tier'),
        count: read('count'),
        bonus: read('bonus')
      };
    })()`
  );
}

async function runCycleErosionPointerSmoke(cdp, appUrl) {
  // Storage is only cleared to make this pointer-driven flow independent from earlier suites.
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'clean hub before cycle erosion pointer entry'
  );

  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-map') &&
      document.querySelector('.grid-node.current') &&
      document.querySelector('[data-pressure-status="active"]') &&
      document.querySelector('[data-pressure-tier="stable"]') &&
      document.querySelector('[data-pressure-count="0"]') &&
      document.querySelector('[data-pressure-bonus="15"]')`,
    'pointer entry preserves the cycle erosion baseline'
  );

  await clearCurrentMonsterByAttack(cdp, 'cycle erosion first non-exit clear');
  await waitForPage(
    cdp,
    `(() => {
      const value = document.querySelector('[data-pressure-count]')?.getAttribute('data-pressure-count');
      return Number.isInteger(Number(value)) && Number(value) > 0;
    })()`,
    'real node clear advances the cycle erosion count'
  );

  const beforeReload = await getPressureUiState(cdp);
  const persistedBeforeReload = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
      return Boolean(saved?.state?.run);
    })()`
  );
  if (!persistedBeforeReload || Number(beforeReload.count) <= 0) {
    throw new Error(`Real node clear should persist a positive cycle erosion snapshot: ${JSON.stringify(beforeReload)}`);
  }

  await cdp.send('Page.reload', { ignoreCache: true });
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-map') &&
      localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null &&
      document.querySelector('[data-pressure-status="${beforeReload.status}"]') &&
      document.querySelector('[data-pressure-tier="${beforeReload.tier}"]') &&
      document.querySelector('[data-pressure-count="${beforeReload.count}"]') &&
      document.querySelector('[data-pressure-bonus="${beforeReload.bonus}"]')`,
    'cycle erosion snapshot survives reload'
  );
  const afterReload = await getPressureUiState(cdp);
  if (JSON.stringify(afterReload) !== JSON.stringify(beforeReload)) {
    throw new Error(`Reload should preserve the cycle erosion UI snapshot: before=${JSON.stringify(beforeReload)} after=${JSON.stringify(afterReload)}`);
  }

  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'pointer new game returns to a clean hub'
  );
  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-map') &&
      document.querySelector('[data-pressure-status="active"]') &&
      document.querySelector('[data-pressure-tier="stable"]') &&
      document.querySelector('[data-pressure-count="0"]') &&
      document.querySelector('[data-pressure-bonus="15"]')`,
    'pointer re-entry confirms cycle erosion reset'
  );
  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'cycle erosion smoke leaves a clean hub'
  );
  console.log('[smoke] cycle erosion: pointer entry and real node clear advance count, reload preserves the snapshot, and pointer restart resets active/stable/0/15');
}

async function runRunPursuitSmoke(cdp, appUrl) {
  const dungeonId = 'demon_tower_1';
  const materialId = 'demon_bone';
  const spawnNodeId = 'tower_butcher_patrol';
  const containmentNodeId = 'sealed_cache';

  const navigateWithState = async (state, label) => {
    await injectGameState(cdp, state);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };

  const moveByPointer = async (nodeId, label) => {
    await clickElementByPointer(cdp, `[data-action="grid-${nodeId}"]:not(:disabled)`);
    await waitForPage(
      cdp,
      `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.currentNodeId === ${JSON.stringify(nodeId)}`,
      label
    );
  };

  const collectRewardByPointer = async (nodeId, expectedClearCount, label) => {
    await clickElementByPointer(cdp, `[data-action="reward-current-${nodeId}"]:not(:disabled)`);
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        return saved.run?.clearedNodeIds.includes(${JSON.stringify(nodeId)}) &&
          saved.run.pressureState?.clearedNodeCount === ${expectedClearCount} &&
          document.querySelector('[data-action="grid-${nodeId}"].cleared');
      })()`,
      label
    );
  };

  const assertPursuitLayout = async ({ width, height, status, markerSelectors, label }) => {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.dungeon-map',
      targetSelectors: ['.run-pursuit-status', ...markerSelectors],
      checkRootOverflow: true,
      label
    });

    const layout = await evaluate(
      cdp,
      `(() => {
        const intersects = (left, right) =>
          Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
          Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
        const status = document.querySelector('.run-pursuit-status');
        const statusCells = [...(status?.children ?? [])];
        const markedNodes = [...document.querySelectorAll('[data-pursuit-position], [data-pursuit-containment], [data-pursuit-fusion]')];
        const chips = [...document.querySelectorAll('.pursuit-node-marks > span')];
        const statusCollisions = [];
        const chipCollisions = [];
        const chipCopyCollisions = [];
        for (let leftIndex = 0; leftIndex < statusCells.length; leftIndex += 1) {
          for (let rightIndex = leftIndex + 1; rightIndex < statusCells.length; rightIndex += 1) {
            if (intersects(statusCells[leftIndex].getBoundingClientRect(), statusCells[rightIndex].getBoundingClientRect())) {
              statusCollisions.push([leftIndex, rightIndex]);
            }
          }
        }
        for (let leftIndex = 0; leftIndex < chips.length; leftIndex += 1) {
          const leftNode = chips[leftIndex].closest('.grid-node');
          for (let rightIndex = leftIndex + 1; rightIndex < chips.length; rightIndex += 1) {
            if (leftNode === chips[rightIndex].closest('.grid-node') &&
              intersects(chips[leftIndex].getBoundingClientRect(), chips[rightIndex].getBoundingClientRect())) {
              chipCollisions.push([leftIndex, rightIndex]);
            }
          }
          const copy = [...leftNode.querySelectorAll(':scope > .node-type-label, :scope > strong, :scope > small')];
          if (copy.some((element) => intersects(chips[leftIndex].getBoundingClientRect(), element.getBoundingClientRect()))) {
            chipCopyCollisions.push(leftIndex);
          }
        }
        return {
          viewport: [window.innerWidth, window.innerHeight],
          pursuitStatus: status?.dataset.runPursuitStatus ?? '',
          pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
          mapOverflow: document.querySelector('.dungeon-map')?.scrollWidth > document.querySelector('.dungeon-map')?.clientWidth + 1,
          statusOverflow: status?.scrollWidth > status?.clientWidth + 1,
          statusCellOverflow: statusCells.some((cell) => cell.scrollWidth > cell.clientWidth + 1),
          markedNodeOverflow: markedNodes.some((node) => node.scrollWidth > node.clientWidth + 1),
          markerCount: markedNodes.length,
          chipCount: chips.length,
          statusCollisions,
          chipCollisions,
          chipCopyCollisions
        };
      })()`
    );
    if (
      JSON.stringify(layout.viewport) !== JSON.stringify([width, height]) ||
      layout.pursuitStatus !== status ||
      layout.pageOverflow ||
      layout.mapOverflow ||
      layout.statusOverflow ||
      layout.statusCellOverflow ||
      layout.markedNodeOverflow ||
      layout.markerCount !== markerSelectors.length ||
      layout.chipCount !== markerSelectors.length ||
      layout.statusCollisions.length > 0 ||
      layout.chipCollisions.length > 0 ||
      layout.chipCopyCollisions.length > 0
    ) {
      throw new Error(`${label} should keep pursuit status, chips, and pointer targets collision-free: ${JSON.stringify(layout)}`);
    }
  };

  await setViewport(cdp, 390, 844);
  await navigateWithState(makeProtocolHubSave(), 'run pursuit replay hub renders');
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="open-protocol-${dungeonId}"]')`,
    'run pursuit replay protocol entry renders'
  );
  await clickElementByPointer(cdp, `[data-action="open-protocol-${dungeonId}"]`);
  await waitForPage(
    cdp,
    `(() => {
      const note = document.querySelector('.protocol-pursuit-note[data-pursuit-replay="true"]');
      const text = note?.textContent.replace(/\\s+/g, ' ').trim() ?? '';
      return text.includes('侵蚀6格后唤醒') && text.includes('雾后暗格') && text.includes('妖骨 x1');
    })()`,
    'replay protocol explains the live pursuit contract'
  );
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.protocol-sheet',
      targetSelectors: ['.protocol-pursuit-note[data-pursuit-replay="true"]', '.protocol-modal-actions'],
      buttonSelectors: ['[data-action="confirm-protocol-entry"]'],
      minimumButtonHeight: 40,
      checkRootOverflow: true,
      label: `${width}x${height} run pursuit protocol note`
    });
  }

  await setViewport(cdp, 390, 844);
  await clickElementByPointer(cdp, '[data-action="confirm-protocol-entry"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run?.dungeonId === '${dungeonId}' &&
        saved.run.pursuitState?.status === 'dormant' &&
        saved.run.pursuitState?.nodeId === null &&
        document.querySelector('[data-run-pursuit-status="dormant"][data-run-pursuit-clears-remaining="6"]') &&
        document.querySelector('[data-pursuit-containment="true"][data-pursuit-containment-status="ready"]');
    })()`,
    'replay entry freezes a dormant pursuit snapshot'
  );

  const legalDormantFixture = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
  );
  const legacyFixture = structuredClone(legalDormantFixture);
  legacyFixture.log = ['run pursuit legacy fixture', ...legacyFixture.log];
  delete legacyFixture.run.pursuitState;
  await navigateWithState(legacyFixture, 'run pursuit legacy fixture renders');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run?.currentNodeId === 'fog_lesser_demon' &&
        !Object.prototype.hasOwnProperty.call(saved.run, 'pursuitState') &&
        saved.log.includes('run pursuit legacy fixture') &&
        document.querySelector('[data-run-pursuit-status="legacy"]');
    })()`,
    'legacy active run stays pursuit-disabled without backfill'
  );

  const malformedFixture = structuredClone(legalDormantFixture);
  malformedFixture.log = ['run pursuit malformed fixture', ...malformedFixture.log];
  malformedFixture.run.pursuitState = {
    ...malformedFixture.run.pursuitState,
    status: 'contained',
    nodeId: spawnNodeId,
    rewardGranted: true
  };
  await navigateWithState(malformedFixture, 'run pursuit malformed fixture renders');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run?.currentNodeId === 'fog_lesser_demon' &&
        !Object.prototype.hasOwnProperty.call(saved.run, 'pursuitState') &&
        saved.log.includes('run pursuit malformed fixture') &&
        document.querySelector('[data-run-pursuit-status="legacy"]');
    })()`,
    'malformed pursuit field is removed without resetting the legal run'
  );

  await navigateWithState(legalDormantFixture, 'run pursuit dormant fixture restored');
  await waitForPage(cdp, `document.querySelector('[data-run-pursuit-status="dormant"]')`, 'dormant pursuit resumes');

  await finishProtocolCombatByPointer(cdp, 'run pursuit clear 1 fog lesser demon');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.pressureState?.clearedNodeCount === 1`,
    'run pursuit first non-exit clear counts once'
  );
  await moveByPointer('broken_sigil_reward', 'run pursuit moves to clear 2');
  await collectRewardByPointer('broken_sigil_reward', 2, 'run pursuit reward clear 2');
  await moveByPointer('left_watch_trap', 'run pursuit moves to clear 3');
  await resolveCurrentProtocolNodeByPointer(cdp, 'run pursuit trap clear 3');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.pressureState?.clearedNodeCount === 3`,
    'run pursuit trap clear 3 counts once'
  );
  await moveByPointer('fog_patrol_pair', 'run pursuit moves to clear 4');
  await finishProtocolCombatByPointer(cdp, 'run pursuit monster clear 4');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.pressureState?.clearedNodeCount === 4`,
    'run pursuit monster clear 4 counts once'
  );
  await moveByPointer('mist_herb_cache', 'run pursuit moves to clear 5');
  await collectRewardByPointer('mist_herb_cache', 5, 'run pursuit reward clear 5');
  await moveByPointer('north_supply_niche', 'run pursuit moves to clear 6');
  await collectRewardByPointer('north_supply_niche', 6, 'run pursuit sixth non-exit clear wakes the pursuer');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.clearedNodeIds.length === 6 &&
        saved.run.pursuitState?.status === 'stalking' &&
        saved.run.pursuitState?.nodeId === '${spawnNodeId}' &&
        document.querySelector('[data-run-pursuit-status="stalking"][data-run-pursuit-node="${spawnNodeId}"][data-run-pursuit-clears-remaining="0"]') &&
        document.querySelector('[data-action="grid-${spawnNodeId}"][data-pursuit-position="true"]');
    })()`,
    'exactly six real non-exit clears wake the demon tower pursuit'
  );

  const legalStalkingFixture = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
  );
  const fusedFixture = structuredClone(legalStalkingFixture);
  fusedFixture.log = ['run pursuit fused fixture', ...fusedFixture.log];
  fusedFixture.run.pursuitState = {
    ...fusedFixture.run.pursuitState,
    status: 'fused',
    nodeId: null,
    graceMoves: 0
  };
  await navigateWithState(fusedFixture, 'run pursuit fused fixture renders');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.pursuitState?.status === 'fused' &&
        saved.log.includes('run pursuit fused fixture') &&
        document.querySelector('[data-run-pursuit-status="fused"]') &&
        document.querySelector('.boss-node[data-pursuit-fusion="true"][data-pursuit-status="fused"]');
    })()`,
    'legal fused fixture renders the Boss fusion evidence'
  );
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertPursuitLayout({
      width,
      height,
      status: 'fused',
      markerSelectors: ['[data-pursuit-fusion="true"]'],
      label: `${width}x${height} fused pursuit map`
    });
  }

  await setViewport(cdp, 390, 844);
  await navigateWithState(legalStalkingFixture, 'run pursuit stalking fixture restored');
  await waitForPage(
    cdp,
    `document.querySelector('[data-run-pursuit-status="stalking"][data-run-pursuit-node="${spawnNodeId}"]')`,
    'live stalking pursuit resumes at its authored spawn'
  );
  await moveByPointer('mist_herb_cache', 'real player move advances the awakened pursuer once');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.pursuitState?.status === 'stalking' &&
        saved.run.pursuitState.nodeId === 'demon_bone_cache' &&
        document.querySelector('[data-action="grid-demon_bone_cache"][data-pursuit-position="true"]');
    })()`,
    'awakened pursuer takes one real grid step'
  );
  await moveByPointer(containmentNodeId, 'run pursuit reaches the uncleared containment node');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.pursuitState?.nodeId === 'blood_rune_trap'`,
    'pursuer closes on the player before containment is ready'
  );
  const demonBoneBeforeContainment = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.inventory.${materialId}`
  );
  await collectRewardByPointer(containmentNodeId, 7, 'real reward action clears the pursuit containment node');
  await moveByPointer('mist_herb_cache', 'first real lure move lines up the containment route');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run?.pursuitState?.nodeId === 'cracked_portal'`,
    'pursuer moves adjacent to the cleared containment node'
  );
  await moveByPointer(containmentNodeId, 'second real lure move completes pursuit containment');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.inventory.${materialId} === ${demonBoneBeforeContainment} &&
        saved.run?.pursuitState?.status === 'contained' &&
        saved.run.pursuitState.nodeId === '${containmentNodeId}' &&
        saved.run.pursuitState.rewardGranted === true &&
        document.querySelector('[data-run-pursuit-status="contained"][data-run-pursuit-node="${containmentNodeId}"]') &&
        document.querySelector('[data-action="grid-${containmentNodeId}"][data-pursuit-containment-status="completed"]');
    })()`,
    'cleared sealed cache contains the pursuer without paying before exit'
  );
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertPursuitLayout({
      width,
      height,
      status: 'contained',
      markerSelectors: ['[data-pursuit-containment-status="completed"]'],
      label: `${width}x${height} contained pursuit map`
    });
  }

  await setViewport(cdp, 390, 844);
  await moveByPointer('mist_herb_cache', 'contained pursuit route returns toward Boss');
  await moveByPointer('bone_lane_monster', 'contained pursuit route reaches Boss');
  await finishProtocolCombatByPointer(cdp, 'contained pursuit Boss');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.clearedNodeIds.includes('bone_lane_monster') &&
        saved.run.pursuitState?.status === 'contained' && document.querySelector('.boss-node.cleared');
    })()`,
    'real Boss clear preserves contained pursuit state'
  );
  await moveByPointer('tower_exit', 'contained pursuit route reaches the unsealed exit');
  const pursuitExitBaseline = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        inventoryDemonBone: saved.inventory.${materialId},
        lootBagDemonBone: saved.run?.lootBag?.items?.${materialId} ?? 0,
        pursuitStatus: saved.run?.pursuitState?.status
      };
    })()`
  );
  if (pursuitExitBaseline.pursuitStatus !== 'contained') {
    throw new Error(`Pursuit should remain contained at the exit: ${JSON.stringify(pursuitExitBaseline)}`);
  }
  const expectedSettledDemonBone = pursuitExitBaseline.inventoryDemonBone + 1;
  await clickElementByPointer(cdp, '[data-action="exit-current-tower_exit"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' && document.querySelector('.pursuit-settlement');
    })()`,
    'Boss and exit render pursuit settlement evidence'
  );

  const pursuitSettlement = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const evidence = document.querySelector('.pursuit-settlement');
      return {
        phase: saved.phase,
        demonBone: saved.inventory.${materialId},
        settlement: saved.run?.lastPursuitSettlement,
        lastOutcome: saved.lastOutcome,
        evidence: evidence ? { ...evidence.dataset } : null,
        evidenceText: evidence?.textContent.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (
    pursuitSettlement.phase !== 'result' ||
    pursuitSettlement.demonBone !== expectedSettledDemonBone ||
    pursuitSettlement.settlement?.reason !== 'successful_exit' ||
    pursuitSettlement.settlement?.materialId !== materialId ||
    pursuitSettlement.settlement?.rewarded !== true ||
    pursuitSettlement.settlement?.state?.status !== 'contained' ||
    !pursuitSettlement.lastOutcome?.includes('pursuitRewarded=1') ||
    pursuitSettlement.evidence?.pursuitSettlement !== 'contained/successful_exit' ||
    pursuitSettlement.evidence?.pursuitStatus !== 'contained' ||
    pursuitSettlement.evidence?.pursuitReason !== 'successful_exit' ||
    pursuitSettlement.evidence?.pursuitRewarded !== 'true' ||
    pursuitSettlement.evidence?.pursuitMaterial !== materialId ||
    pursuitSettlement.evidence?.pursuitOriginDungeon !== dungeonId
  ) {
    throw new Error(`Boss and exit should bank ordinary loot plus exactly one pursuit demon bone: ${JSON.stringify({ pursuitExitBaseline, expectedSettledDemonBone, pursuitSettlement })}`);
  }

  const settledMaterialCount = expectedSettledDemonBone;
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.result-panel',
      targetSelectors: ['.pursuit-settlement[data-pursuit-settlement="contained/successful_exit"]', '.pursuit-settlement-result'],
      checkRootOverflow: true,
      label: `${width}x${height} pursuit settlement`
    });
  }
  await setViewport(cdp, 390, 844);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'result' && saved.inventory.${materialId} === ${settledMaterialCount} &&
        saved.run?.lastPursuitSettlement?.rewarded === true &&
        document.querySelector('.pursuit-settlement[data-pursuit-settlement="contained/successful_exit"][data-pursuit-rewarded="true"][data-pursuit-material="${materialId}"]');
    })()`,
    'pursuit reward and result data attributes survive refresh without duplicate payout'
  );

  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      innerWidth === 1440 && innerHeight === 900 &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'run pursuit smoke restores clean storage and desktop viewport'
  );
  console.log('[smoke] run pursuit: replay note -> six real non-exit clears -> chase step -> sealed-cache containment -> Boss/exit demon_bone +1 -> result attributes/reload, legal fused/legacy/malformed fixtures, responsive hit-tests, and cleanup pass');
}

async function runCausalClearinghousePointerSmoke(cdp, appUrl) {
  const navigateWithState = async (state, label) => {
    await injectGameState(cdp, state);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };

  const assertLedgerModalLayout = async (label) => {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      await assertResponsiveSurface(cdp, {
        width,
        height,
        rootSelector: '.causal-ledger-sheet',
        targetSelectors: ['.causal-ledger-sheet', '.causal-ledger-metrics', '.causal-ledger-choices'],
        buttonSelectors: [
          '[data-causal-ledger-choice="balance"]',
          '[data-causal-ledger-choice="overdraw"]'
        ],
        minimumButtonHeight: 40,
        checkRootOverflow: true,
        label: `${label} ${width}x${height}`
      });
      const layout = await evaluate(
        cdp,
        `(() => {
          const dialog = document.querySelector('.causal-ledger-sheet');
          const buttons = [...document.querySelectorAll('.causal-ledger-choice')];
          const intersects = (left, right) =>
            Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
            Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
          const buttonCollisions = [];
          for (let leftIndex = 0; leftIndex < buttons.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < buttons.length; rightIndex += 1) {
              if (intersects(buttons[leftIndex].getBoundingClientRect(), buttons[rightIndex].getBoundingClientRect())) {
                buttonCollisions.push([leftIndex, rightIndex]);
              }
            }
          }
          return {
            pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
            dialogOverflow: Boolean(dialog && dialog.scrollWidth > dialog.clientWidth + 1),
            buttonOverflow: buttons.some((button) => button.scrollWidth > button.clientWidth + 1),
            buttonCollisions,
            focusInside: Boolean(dialog?.contains(document.activeElement))
          };
        })()`
      );
      if (
        layout.pageOverflow ||
        layout.dialogOverflow ||
        layout.buttonOverflow ||
        layout.buttonCollisions.length > 0 ||
        !layout.focusInside
      ) {
        throw new Error(`${label} should keep the forced ledger dialog collision-free and pointer-safe: ${JSON.stringify(layout)}`);
      }
    }
  };

  const assertLedgerOpenAndBlocked = async (label) => {
    const snapshot = await evaluate(
      cdp,
      `(() => {
        const dialog = document.querySelector('.causal-ledger-sheet[role="dialog"][aria-modal="true"]');
        const appContent = document.querySelector('.app-content');
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.state;
        const lock = document.querySelector('.route-lock-status');
        const choices = [...document.querySelectorAll('[data-causal-ledger-choice]')];
        return {
          hasDialog: Boolean(dialog),
          text: dialog?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
          bodyModalOpen: document.body.classList.contains('modal-open'),
          appContentInert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
          focusInside: Boolean(dialog?.contains(document.activeElement)),
          choiceCount: choices.length,
          choiceLabels: choices.map((choice) => choice.textContent.replace(/\\s+/g, ' ').trim()),
          lockKind: lock?.dataset.routeLockKind ?? '',
          lockText: lock?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
          enabledMovableCount: document.querySelectorAll('.grid-node.movable:not(:disabled)').length,
          currentNodeId: saved?.run?.currentNodeId,
          pendingLedgerNodeId: saved?.run?.lawState?.law?.pendingLedgerNodeId
        };
      })()`
    );
    if (
      !snapshot.hasDialog ||
      !snapshot.text.includes('因果账本') ||
      !snapshot.text.includes('强制结算') ||
      !snapshot.text.includes('平衡') ||
      !snapshot.text.includes('透支') ||
      !snapshot.text.includes('偿还') ||
      !snapshot.bodyModalOpen ||
      !snapshot.appContentInert ||
      !snapshot.focusInside ||
      snapshot.choiceCount !== 3 ||
      snapshot.lockKind !== 'causal_ledger' ||
      !snapshot.lockText.includes('因果账本尚未结算') ||
      snapshot.enabledMovableCount !== 0 ||
      snapshot.pendingLedgerNodeId !== snapshot.currentNodeId
    ) {
      throw new Error(`${label} should open the ledger modal and block movement: ${JSON.stringify(snapshot)}`);
    }
    return snapshot;
  };

  const assertCausalMapLayout = async (actionSelector, label) => {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      await assertResponsiveSurface(cdp, {
        width,
        height,
        rootSelector: '.dungeon-map',
        targetSelectors: ['[data-dungeon-law="causal_clearinghouse"]', '.dungeon-map', '.node-action-panel'],
        buttonSelectors: [actionSelector],
        minimumButtonHeight: 40,
        checkRootOverflow: true,
        label: `${label} ${width}x${height}`
      });
    }
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      innerWidth === 1440 && innerHeight === 900`,
    'causal smoke starts from a clean fourteen-chapter hub'
  );
  await clickElementByPointer(cdp, '[data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      document.querySelector('.resource-strip')?.textContent.includes('850')`,
    'pointer new game keeps the clean hub'
  );
  await openCharacterSheet(cdp, 'clean new game character sheet');
  await closeCharacterSheet(cdp, 'clean new game character sheet');
  await openTaskModal(cdp, 'clean new game task sheet');
  await closeTaskModal(cdp, 'clean new game task sheet');

  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(cdp, `document.querySelector('.dungeon-map')`, 'causal fixture seed enters a real run');
  const causalExploreTemplate = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
  );
  const makeValidCausalExploreState = ({
    dungeonId = 'causal_clearinghouse',
    nodeId = 'clearinghouse_gate',
    debt = 0,
    pendingLedgerNodeId = null,
    settledLedgerNodeIds = [],
    bossDebtLocked = false,
    collectionSeals = 0,
    entryPassives = { causalVisor: false, echoBreakerGauntlets: false, returnAnchorBelt: false },
    visorCreditUsed = false,
    clearedNodeIds = [],
    rewardPoints = 200,
    lingyun = 0,
    player = { hp: 900, maxHp: 1000 },
    inventory = {},
    log = ['causal pointer smoke save'],
    law
  } = {}) => {
    const state = JSON.parse(JSON.stringify(causalExploreTemplate));
    state.phase = 'explore';
    state.rewardPoints = rewardPoints;
    state.lingyun = lingyun;
    state.player = { ...state.player, ...player };
    state.inventory = { ...state.inventory, ...inventory };
    state.run = {
      ...state.run,
      dungeonId,
      currentNodeId: nodeId,
      clearedNodeIds,
      lawState: makeDungeonLawState(dungeonId, law ?? {
        kind: 'causal_clearinghouse',
        debt,
        pendingLedgerNodeId,
        settledLedgerNodeIds,
        bossDebtLocked,
        collectionSeals,
        entryPassives,
        visorCreditUsed
      }, { clearedNodeIds })
    };
    state.log = log;
    return state;
  };
  const makeValidCausalCombatState = () => {
    const state = makeValidCausalExploreState({
      nodeId: 'zero_sum_auditor',
      rewardPoints: 500,
      lingyun: 5,
      player: { hp: 500, maxHp: 500, base: { body: 30, spirit: 10, agility: 8, luck: 2 } },
      debt: 3,
      log: ['causal Boss追缴印 pointer smoke save']
    });
    state.phase = 'combat';
    state.combat = {
      nodeId: 'zero_sum_auditor',
      monsterId: 'zero_sum_auditor',
      monsterHp: 180,
      turn: 1,
      guarding: false,
      weaponFocus: 0,
      log: ['causal Boss追缴印 pointer smoke save']
    };
    return state;
  };

  const balanceState = makeValidCausalExploreState({
    nodeId: 'contradiction_line',
    rewardPoints: 200,
    player: { hp: 900, maxHp: 1000 },
    log: ['causal balance pointer smoke save']
  });
  await navigateWithState(balanceState, 'causal balance entry renders');
  await waitForPage(
    cdp,
    `document.querySelector('[data-dungeon-law="causal_clearinghouse"]')?.textContent.includes('账目已结') &&
      document.querySelector('[data-action="trap-risk-contradiction_line"]:not(:disabled)')`,
    'causal balance ordinary node renders'
  );
  await assertCausalMapLayout('[data-action="trap-risk-contradiction_line"]', 'causal ordinary trap map');
  await setViewport(cdp, 390, 844);
  await clickElementByPointer(cdp, '[data-action="trap-risk-contradiction_line"]');
  await waitForPage(
    cdp,
    `document.querySelector('.causal-ledger-sheet') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.pendingLedgerNodeId === 'contradiction_line'`,
    'first real trap clear opens the causal ledger'
  );
  await assertLedgerOpenAndBlocked('ordinary node ledger');
  await assertLedgerModalLayout('causal ledger modal');
  await setViewport(cdp, 390, 844);
  await clickElementByPointer(cdp, '[data-causal-ledger-choice="balance"]');
  await waitForPage(
    cdp,
    `!document.querySelector('.causal-ledger-sheet') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.pendingLedgerNodeId === null &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.debt === 0 &&
      document.querySelector('.grid-node.current.cleared')`,
    'balance closes the ledger and restores movement'
  );
  await assertRouteUnlocked(cdp, 'balanced causal node');

  const overdrawState = makeValidCausalExploreState({
    nodeId: 'retroactive_sentence_trap',
    rewardPoints: 200,
    player: { hp: 900, maxHp: 1000 },
    log: ['causal overdraw pointer smoke save']
  });
  await navigateWithState(overdrawState, 'causal overdraw entry renders');
  await clickElementByPointer(cdp, '[data-action="trap-risk-retroactive_sentence_trap"]');
  await waitForPage(cdp, `document.querySelector('.causal-ledger-sheet')`, 'overdraw ledger opens');
  const overdrawAtLedger = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return { rewardPoints: saved.rewardPoints, hp: saved.player.hp, maxHp: saved.player.maxHp };
    })()`
  );
  await clickElementByPointer(cdp, '[data-causal-ledger-choice="overdraw"]');
  await waitForPage(
    cdp,
    `!document.querySelector('.causal-ledger-sheet')`,
    'overdraw applies reward, healing, and one debt'
  );
  const overdrawResult = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        debt: saved.run.lawState.law.debt,
        pendingLedgerNodeId: saved.run.lawState.law.pendingLedgerNodeId,
        rewardPoints: saved.rewardPoints,
        hp: saved.player.hp,
        expectedRewardPoints: ${overdrawAtLedger.rewardPoints + 108},
        expectedHp: ${overdrawAtLedger.hp + Math.max(1, Math.floor(overdrawAtLedger.maxHp * 0.1))}
      };
    })()`
  );
  if (
    overdrawResult.debt !== 1 ||
    overdrawResult.pendingLedgerNodeId !== null ||
    overdrawResult.rewardPoints !== overdrawResult.expectedRewardPoints ||
    overdrawResult.hp !== overdrawResult.expectedHp
  ) {
    throw new Error(`overdraw should settle with +108 reward, +10% max-health healing, and one debt: ${JSON.stringify(overdrawResult)}`);
  }

  const repayState = makeValidCausalExploreState({
    nodeId: 'prospective_sentence_trap',
    debt: 1,
    rewardPoints: 200,
    player: { hp: 900, maxHp: 1000 },
    log: ['causal repay pointer smoke save']
  });
  await navigateWithState(repayState, 'causal repay entry renders');
  await clickElementByPointer(cdp, '[data-action="trap-risk-prospective_sentence_trap"]');
  await waitForPage(cdp, `document.querySelector('.causal-ledger-sheet')?.textContent.includes('债务 1/4')`, 'repay ledger opens');
  const repayAtLedger = await evaluate(
    cdp,
    `(() => {
      const player = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player;
      return {
        hp: player.hp,
        damage: Math.max(1, Math.floor(player.maxHp * 0.15))
      };
    })()`
  );
  await clickElementByPointer(cdp, '[data-causal-ledger-choice="repay"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return !document.querySelector('.causal-ledger-sheet') &&
        saved.run.lawState.law.pendingLedgerNodeId === null &&
        saved.run.lawState.law.debt === 0 &&
        saved.player.hp === ${repayAtLedger.hp - repayAtLedger.damage};
    })()`,
    'repay applies non-lethal damage and removes one debt'
  );

  const bossState = makeValidCausalCombatState();
  await navigateWithState(bossState, 'causal Boss entry renders');
  await waitForPage(
    cdp,
    `document.querySelector('.combat-panel') &&
      document.querySelector('[data-dungeon-law="causal_clearinghouse"]')`,
    'causal Boss combat is visible'
  );
  await clickButtonByPointer(cdp, '攻击', '.combat-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.lawState.law.bossDebtLocked === true &&
        saved.run.lawState.law.collectionSeals === 2 &&
        saved.combat.log.some((line) => line.includes('追缴印抵消本次攻势')) &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('追缴印 2');
    })()`,
    'Boss first attack consumes one collection seal'
  );
  await clickButtonByPointer(cdp, '攻击', '.combat-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.collectionSeals === 1 &&
      document.querySelector('.dungeon-law-status')?.textContent.includes('追缴印 1')`,
    'Boss second attack consumes another collection seal'
  );

  const chapterEightPortalState = makeValidCausalExploreState({
    dungeonId: 'temporal_observatory',
    nodeId: 'past_echo_portal',
    inventory: { gate_sigil: 1 },
    law: { kind: 'temporal_observatory', pastCalibrated: true, futureCalibrated: true },
    log: ['chapter eight to nine portal pointer smoke save']
  });
  chapterEightPortalState.completedDungeonIds = [...CAUSAL_PRIOR_DUNGEON_IDS];
  chapterEightPortalState.claimedTaskIds = [...CAUSAL_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterEightPortalState, 'chapter eight portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'causal_clearinghouse' &&
        saved.run.currentNodeId === 'cause_clue_cache' &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('因果账本');
    })()`,
    'chapter eight stable portal reaches chapter nine'
  );

  await navigateWithState(
    makeValidCausalExploreState({
      nodeId: 'cause_echo_portal',
      inventory: { gate_sigil: 1 },
      log: ['chapter nine to ten portal pointer smoke save']
    }),
    'chapter nine portal entry renders'
  );
  const chapterNinePortalState = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
  );
  chapterNinePortalState.completedDungeonIds = [...ENTROPY_PRIOR_DUNGEON_IDS];
  chapterNinePortalState.claimedTaskIds = [...ENTROPY_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterNinePortalState, 'chapter nine unlocked portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'entropy_ark' &&
        saved.run.currentNodeId === 'port_clue_cache' &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('方舟航态');
    })()`,
    'chapter nine stable portal reaches chapter ten'
  );

  const chapterTenPortalState = makeEntropyExploreSave({
    nodeId: 'port_return_portal',
    inventory: { gate_sigil: 1 },
    completedDungeonIds: [...MIRROR_PRIOR_DUNGEON_IDS],
    log: ['chapter ten to eleven portal pointer smoke save']
  });
  chapterTenPortalState.claimedTaskIds = [...MIRROR_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterTenPortalState, 'chapter ten portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'mirror_cycle_city' &&
        saved.run.currentNodeId === 'real_clue_vault' &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('镜海相位');
    })()`,
    'chapter ten stable portal reaches chapter eleven'
  );

  const chapterElevenPortalState = makeValidCausalExploreState({
    dungeonId: 'mirror_cycle_city',
    nodeId: 'upper_return_portal',
    inventory: { gate_sigil: 1 },
    law: {
      kind: 'mirror_cycle_city', currentPhase: 'real', pendingPhaseNodeId: null,
      resolvedPhaseChoices: {}, anchors: { real: false, mirror: false }, bossAnchorSnapshot: null,
      brokenMirrorShells: 0,
      entryPassives: { parallaxVisor: false, phaseweaveMantle: false, homecomingPrism: false }
    },
    log: ['chapter eleven to twelve portal pointer smoke save']
  });
  chapterElevenPortalState.completedDungeonIds = [...REDACTION_PRIOR_DUNGEON_IDS];
  chapterElevenPortalState.claimedTaskIds = [...REDACTION_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterElevenPortalState, 'chapter eleven portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'redaction_scriptorium' && saved.run.currentNodeId === 'folio_gate' &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('删界终稿');
    })()`,
    'chapter eleven stable portal reaches chapter twelve'
  );

  const chapterTwelvePortalState = makeValidCausalExploreState({
    dungeonId: 'redaction_scriptorium',
    nodeId: 'upper_revision_portal',
    inventory: { gate_sigil: 1 },
    law: {
      kind: 'redaction_scriptorium',
      pendingClauseNodeId: null,
      resolvedClauseChoices: {},
      bossClauseSnapshot: null,
      entryPassives: { redlineEdge: false, palimpsestMantle: false, finalProofSeal: false }
    },
    log: ['chapter twelve to thirteen portal pointer smoke save']
  });
  chapterTwelvePortalState.completedDungeonIds = [...AUCTION_PRIOR_DUNGEON_IDS];
  chapterTwelvePortalState.claimedTaskIds = [...AUCTION_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterTwelvePortalState, 'chapter twelve portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.dungeonId === 'legacy_auction_court' && saved.run.currentNodeId === 'estate_gate' &&
        document.querySelector('.dungeon-law-status')?.textContent.includes('亡队遗产拍卖');
    })()`,
    'chapter twelve stable portal reaches chapter thirteen'
  );

  const chapterThirteenPortalState = makeValidCausalExploreState({
    dungeonId: 'legacy_auction_court', nodeId: 'upper_auction_portal', inventory: { gate_sigil: 1 },
    law: { kind: 'legacy_auction_court', pendingLotNodeId: null, resolvedLotChoices: {}, bossLotSnapshot: null, entryPassives: { legacyGavel: false, anonymousVeil: false, escrowPlate: false, finalLotBell: false } },
    log: ['chapter thirteen to fourteen portal pointer smoke save']
  });
  chapterThirteenPortalState.completedDungeonIds = [...GENESIS_PRIOR_DUNGEON_IDS];
  chapterThirteenPortalState.claimedTaskIds = [...GENESIS_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterThirteenPortalState, 'chapter thirteen portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'genesis_vault' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'genesis_gate'`, 'chapter thirteen stable portal reaches chapter fourteen');

  const chapterFourteenPortalState = makeValidCausalExploreState({
    dungeonId: 'genesis_vault', nodeId: 'upper_genesis_portal', inventory: { gate_sigil: 1 },
    law: { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: [], bossGenomeSnapshot: null, entryGear: { force: false, art: false, guard: false, renewal: false }, entryBloodline: { aspect: null, rank: 0 } },
    log: ['chapter fourteen to fifteen portal pointer smoke save']
  });
  chapterFourteenPortalState.completedDungeonIds = [...BROADCAST_PRIOR_DUNGEON_IDS];
  chapterFourteenPortalState.claimedTaskIds = [...BROADCAST_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterFourteenPortalState, 'chapter fourteen portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'silent_broadcast_tower' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'chapter fourteen stable portal reaches chapter fifteen');
  const chapterFifteenPortalState = makeValidCausalExploreState({
    dungeonId: 'silent_broadcast_tower', nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 },
    law: { kind: 'silent_broadcast_tower', noise: 0, pendingRelayNodeId: null, resolvedRelayChoices: {}, bossNoiseSnapshot: null, firstClashMutedUsed: false, entryPassives: { hushblade: false, deadAirHeadset: false, anechoicMantle: false, lastChannelBeacon: false } },
    log: ['chapter fifteen to sixteen portal pointer smoke save']
  });
  chapterFifteenPortalState.completedDungeonIds = [...SHELTER_PRIOR_DUNGEON_IDS];
  chapterFifteenPortalState.claimedTaskIds = [...SHELTER_PRIOR_MAINLINE_TASK_IDS];
  await navigateWithState(chapterFifteenPortalState, 'chapter fifteen portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'lost_shelter' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'chapter fifteen stable portal reaches chapter sixteen');
  await navigateWithState(makeLostShelterExploreSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'chapter sixteen portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'false_testimony_court' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'chapter sixteen stable portal reaches chapter seventeen');
  await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'chapter seventeen portal entry renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'combat_replay_stage' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'upper_entry'`, 'chapter seventeen stable portal reaches chapter eighteen');

  await navigateWithState(
    makeValidCausalExploreState({
      nodeId: 'clearinghouse_exit',
      clearedNodeIds: ['zero_sum_auditor'],
      rewardPoints: 700,
      lingyun: 5,
      bossDebtLocked: true,
      log: ['causal exit settlement pointer smoke save']
    }),
    'causal exit settlement entry renders'
  );
  await waitForPage(
    cdp,
    `document.querySelector('[data-action="exit-current-clearinghouse_exit"]:not(:disabled)')`,
    'causal exit is unsealed after Boss clear'
  );
  await clickElementByPointer(cdp, '[data-action="exit-current-clearinghouse_exit"]');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.phase === 'result' &&
      document.querySelector('.result-panel')?.textContent.includes('结算') &&
      document.querySelector('.result-panel')?.textContent.includes('因果清算所')`,
    'causal exit settles the run'
  );
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.result-panel',
      targetSelectors: ['.result-panel', '.result-panel .score-strip', '.result-panel .next-action-panel'],
      buttonSelectors: ['.result-panel [data-action="return-hub"]'],
      minimumButtonHeight: 40,
      checkRootOverflow: true,
      label: `${width}x${height} causal settlement`
    });
  }

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({
    events: cdp.events.filter((event) => !(
      event.method === 'Log.entryAdded' &&
      event.params?.entry?.url === faviconUrl &&
      event.params.entry.text.includes('404')
    ))
  });
  const pageHealth = await evaluate(
    cdp,
    `(() => ({
      hasShell: Boolean(document.querySelector('.shell')),
      pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
      errorOverlayCount: document.querySelectorAll('vite-error-overlay, #webpack-dev-server-client-overlay, [data-error-overlay]').length
    }))()`
  );
  if (browserErrors.length > 0 || !pageHealth.hasShell || pageHealth.pageOverflow || pageHealth.errorOverlayCount > 0) {
    throw new Error(`Causal clearinghouse browser smoke should have no console/page errors or horizontal overflow: ${JSON.stringify({ browserErrors, pageHealth })}`);
  }

  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      innerWidth === 1440 && innerHeight === 900 &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      !document.querySelector('[role="dialog"][aria-modal="true"]')`,
    'causal smoke restores clean 1440x900 hub'
  );
  console.log('[smoke] nineteen-chapter causal pointer smoke: clean new game + character/task sheets, causal ledger balance/overdraw/repay and route lock, collection-seal Boss costs, chapter 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 1 portals, exit settlement, responsive/error checks, and 1440x900 cleanup pass');
}

async function runEntropyArkPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (state, label) => {
    await injectGameState(cdp, state);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };

  const getEntropyLayout = async () => evaluate(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const map = document.querySelector('.dungeon-map');
      const panel = document.querySelector('.node-action-panel');
      const fieldset = document.querySelector('.entropy-heading-fieldset');
      const choices = [...document.querySelectorAll('.entropy-heading-choice')];
      const cells = map ? [...map.children].filter((element) => element.matches('.grid-node, .grid-cell')) : [];
      const firstRowWidths = cells.slice(0, 6).map((cell) => cell.getBoundingClientRect().width);
      const choiceRects = choices.map((choice) => {
        const rect = choice.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          clipped: choice.scrollWidth > choice.clientWidth + 1 || choice.scrollHeight > choice.clientHeight + 1
        };
      });
      const appContent = document.querySelector('.app-content');
      const bodyStyle = getComputedStyle(document.body);
      return {
        viewport: [innerWidth, innerHeight],
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        mapWidth: map?.getBoundingClientRect().width ?? 0,
        mapScrollOverflow: Boolean(map && map.scrollWidth > map.clientWidth + 1),
        firstRowWidths,
        panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth + 1),
        fieldsetInsidePanel: Boolean(fieldset && panel?.contains(fieldset)),
        fieldsetStatus: fieldset?.dataset.entropyArkStatus ?? '',
        fieldsetValue: fieldset?.dataset.entropyValue ?? '',
        fieldsetNode: fieldset?.dataset.entropyHeadingNode ?? '',
        fieldsetChoice: fieldset?.dataset.entropyHeadingChoice ?? '',
        choiceRects,
        choiceTexts: choices.map(compactText),
        activeChoice: document.activeElement?.getAttribute('data-entropy-heading-choice') ?? '',
        routeLockKind: document.querySelector('.route-lock-status')?.dataset.routeLockKind ?? '',
        enabledMovableCount: document.querySelectorAll('.grid-node.movable:not(:disabled)').length,
        dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
        entropyBackdropCount: document.querySelectorAll('.entropy-heading-backdrop').length,
        bodyModalOpen: document.body.classList.contains('modal-open'),
        bodyScrollLocked: bodyStyle.overflowY === 'hidden' || bodyStyle.position === 'fixed',
        appContentInert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
        characterEnabled: Boolean(document.querySelector('.character-trigger:not(:disabled)')),
        taskEnabled: Boolean(document.querySelector('.task-trigger:not(:disabled)')),
        retreatEnabled: [...document.querySelectorAll('button')].some((button) =>
          !button.disabled && button.textContent.includes('撤回主神空间')
        )
      };
    })()`
  );

  const assertStableMap = (before, after, label) => {
    const widthDelta = Math.abs(before.mapWidth - after.mapWidth);
    const columnDelta = Math.max(
      0,
      ...before.firstRowWidths.map((width, index) => Math.abs(width - (after.firstRowWidths[index] ?? 0)))
    );
    if (
      before.mapWidth <= 0 ||
      after.mapWidth <= 0 ||
      widthDelta > 1 ||
      columnDelta > 1 ||
      after.pageOverflow ||
      after.mapScrollOverflow ||
      after.panelOverflow
    ) {
      throw new Error(`${label} should not change the six-column map width or overflow: ${JSON.stringify({ before, after, widthDelta, columnDelta })}`);
    }
  };

  const assertPendingHeading = async ({ width, height, nodeId, entropy, layout, label }) => {
    const snapshot = layout ?? await getEntropyLayout();
    const [first, second] = snapshot.choiceRects;
    const mobileSingleColumn = width !== 390 || Boolean(
      first && second && Math.abs(first.left - second.left) <= 1 && second.top >= first.bottom - 1
    );
    const desktopEqualColumns = width !== 1440 || Boolean(
      first && second && Math.abs(first.top - second.top) <= 1 && Math.abs(first.width - second.width) <= 1
    );
    if (
      snapshot.viewport[0] !== width ||
      snapshot.viewport[1] !== height ||
      !snapshot.fieldsetInsidePanel ||
      snapshot.fieldsetStatus !== 'pending' ||
      snapshot.fieldsetValue !== String(entropy) ||
      snapshot.fieldsetNode !== nodeId ||
      snapshot.fieldsetChoice !== 'pending' ||
      snapshot.choiceRects.length !== 2 ||
      snapshot.choiceRects.some((rect) => rect.height < 68 || rect.clipped) ||
      !mobileSingleColumn ||
      !desktopEqualColumns ||
      snapshot.routeLockKind !== 'entropy_heading' ||
      snapshot.enabledMovableCount !== 0 ||
      snapshot.dialogCount !== 0 ||
      snapshot.entropyBackdropCount !== 0 ||
      snapshot.bodyModalOpen ||
      snapshot.bodyScrollLocked ||
      snapshot.appContentInert ||
      !snapshot.characterEnabled ||
      !snapshot.taskEnabled ||
      !snapshot.retreatEnabled ||
      snapshot.pageOverflow ||
      snapshot.mapScrollOverflow ||
      snapshot.panelOverflow
    ) {
      throw new Error(`${label} should expose an accessible non-modal heading fieldset and only lock adjacent movement: ${JSON.stringify(snapshot)}`);
    }
    return snapshot;
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      innerWidth === 1440 && innerHeight === 900`,
    'entropy smoke starts from a clean fourteen-chapter hub'
  );
  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(cdp, `document.querySelector('.dungeon-map')`, 'entropy fixture seed enters a real run');
  const exploreTemplate = await evaluate(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`
  );

  const makeValidExploreState = ({
    dungeonId,
    nodeId,
    law,
    clearedNodeIds = [],
    inventory = {},
    completedDungeonIds = [],
    claimedTaskIds = [],
    player = {},
    log = ['entropy pointer smoke save']
  }) => {
    const state = JSON.parse(JSON.stringify(exploreTemplate));
    state.phase = 'explore';
    delete state.combat;
    state.player = { ...state.player, ...player };
    state.inventory = { ...state.inventory, ...inventory };
    state.completedDungeonIds = completedDungeonIds;
    state.claimedTaskIds = claimedTaskIds;
    state.run = {
      ...state.run,
      dungeonId,
      currentNodeId: nodeId,
      clearedNodeIds,
      lawState: makeDungeonLawState(dungeonId, law, { clearedNodeIds })
    };
    state.log = log;
    return state;
  };
  const makeValidEntropyState = ({
    nodeId = 'ark_gate',
    entropy = 2,
    pendingHeadingNodeId = null,
    resolvedHeadingChoices = {},
    bossEntropyLocked = false,
    collapseLayers = 0,
    entryPassives = { entropyCompass: false, dissipationMantle: false, arkKeelBoots: false },
    compassCreditUsed = false,
    ...options
  } = {}) => makeValidExploreState({
    dungeonId: 'entropy_ark',
    nodeId,
    law: {
      kind: 'entropy_ark',
      entropy,
      pendingHeadingNodeId,
      resolvedHeadingChoices,
      bossEntropyLocked,
      collapseLayers,
      entryPassives,
      compassCreditUsed
    },
    ...options
  });

  const steadyState = makeValidEntropyState({ nodeId: 'bow_heading_console' });
  await navigateWithState(steadyState, 'mobile steady heading console renders');
  await setViewport(cdp, 390, 844);
  const steadyBeforeReward = await getEntropyLayout();
  await clickElementByPointer(cdp, '[data-action="reward-current-bow_heading_console"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-entropy-ark-status="pending"][data-entropy-value="2"][data-entropy-heading-node="bow_heading_console"]') &&
      document.activeElement === document.querySelector('[data-entropy-heading-choice="steady"]')`,
    'real heading-console reward opens pending choice and focuses the first available option'
  );
  const steadyPending = await assertPendingHeading({
    width: 390,
    height: 844,
    nodeId: 'bow_heading_console',
    entropy: 2,
    label: '390x844 steady heading pending'
  });
  assertStableMap(steadyBeforeReward, steadyPending, '390x844 pending heading');

  await pressEscape(cdp);
  const afterEscape = await getEntropyLayout();
  if (afterEscape.fieldsetStatus !== 'pending' || afterEscape.activeChoice !== 'steady') {
    throw new Error(`Escape should not cancel or move focus away from the pending heading: ${JSON.stringify(afterEscape)}`);
  }
  await openCharacterSheet(cdp, 'pending entropy heading');
  await closeCharacterSheet(cdp, 'pending entropy heading');
  await openTaskModal(cdp, 'pending entropy heading');
  await closeTaskModal(cdp, 'pending entropy heading');
  const afterSheets = await getEntropyLayout();
  if (afterSheets.fieldsetStatus !== 'pending' || afterSheets.routeLockKind !== 'entropy_heading') {
    throw new Error(`Character and task sheets should not settle the pending heading: ${JSON.stringify(afterSheets)}`);
  }

  await clickElementByPointer(cdp, '[data-entropy-heading-choice="steady"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const result = document.querySelector('[data-entropy-ark-status="resolved"][data-entropy-value="1"][data-entropy-heading-node="bow_heading_console"][data-entropy-heading-choice="steady"][role="status"][aria-live="polite"]');
      const lowGate = document.querySelector('.grid-node[data-route-gate-id="ark_bow_dissipation_lane"][data-route-gate-status="open"]');
      return saved.run.lawState.law.entropy === 1 && result && lowGate;
    })()`,
    'mobile steady resolves, announces, and opens the low-entropy gate'
  );
  const steadyFocus = await evaluate(
    cdp,
    `(() => {
      const active = document.activeElement;
      const lowGate = document.querySelector('.grid-node[data-route-gate-id="ark_bow_dissipation_lane"][data-route-gate-status="open"]');
      return {
        focusedLowGate: active === lowGate,
        activeTag: active?.tagName ?? '',
        activeAction: active?.getAttribute('data-action') ?? '',
        activeText: active?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (!steadyFocus.focusedLowGate) {
    throw new Error(`Steady heading should focus the opened low-entropy move target: ${JSON.stringify(steadyFocus)}`);
  }
  const steadyResolved = await getEntropyLayout();
  assertStableMap(steadyPending, steadyResolved, '390x844 resolved steady heading');
  await clickElementByPointer(cdp, '.grid-node[data-route-gate-id="ark_bow_dissipation_lane"][data-route-gate-status="open"]');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'dissipation_navigator_alpha'`,
    'mobile steady moves through the opened low-entropy gate'
  );

  const rushState = makeValidEntropyState({ nodeId: 'bow_heading_console' });
  await navigateWithState(rushState, 'desktop rush heading console renders');
  await setViewport(cdp, 1440, 900);
  const rushBeforeReward = await getEntropyLayout();
  await clickElementByPointer(cdp, '[data-action="reward-current-bow_heading_console"]');
  await waitForPage(cdp, `document.querySelector('[data-entropy-ark-status="pending"]')`, 'desktop heading reward opens pending choice');
  const rushPending = await assertPendingHeading({
    width: 1440,
    height: 900,
    nodeId: 'bow_heading_console',
    entropy: 2,
    label: '1440x900 rush heading pending'
  });
  assertStableMap(rushBeforeReward, rushPending, '1440x900 pending heading');
  await clickElementByPointer(cdp, '[data-entropy-heading-choice="rush"]');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const highGate = document.querySelector('.grid-node[data-route-gate-id="ark_bow_port_relic_lane"][data-route-gate-status="open"]');
      return saved.run.lawState.law.entropy === 3 &&
        document.querySelector('[data-entropy-ark-status="resolved"][data-entropy-heading-choice="rush"][role="status"][aria-live="polite"]') &&
        highGate;
    })()`,
    'desktop rush resolves, announces, and opens the high-entropy gate'
  );
  const rushFocus = await evaluate(
    cdp,
    `(() => {
      const active = document.activeElement;
      const highGate = document.querySelector('.grid-node[data-route-gate-id="ark_bow_port_relic_lane"][data-route-gate-status="open"]');
      return {
        focusedHighGate: active === highGate,
        activeTag: active?.tagName ?? '',
        activeAction: active?.getAttribute('data-action') ?? '',
        activeText: active?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''
      };
    })()`
  );
  if (!rushFocus.focusedHighGate) {
    throw new Error(`Rush heading should focus the opened high-entropy move target: ${JSON.stringify(rushFocus)}`);
  }
  const rushResolved = await getEntropyLayout();
  assertStableMap(rushPending, rushResolved, '1440x900 resolved rush heading');
  await clickElementByPointer(cdp, '.grid-node[data-route-gate-id="ark_bow_port_relic_lane"][data-route-gate-status="open"]');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'port_relic_hold'`,
    'desktop rush moves through the opened high-entropy gate'
  );

  await navigateWithState(
    makeValidEntropyState({
      nodeId: 'bow_heading_console',
      entropy: 4,
      pendingHeadingNodeId: 'bow_heading_console',
      clearedNodeIds: ['bow_heading_console']
    }),
    'entropy four boundary renders'
  );
  await waitForPage(
    cdp,
    `document.querySelector('[data-entropy-heading-choice="rush"]:disabled')?.textContent.includes('4/4') &&
      document.querySelector('[data-entropy-heading-choice="steady"]:not(:disabled)')`,
    'entropy four visibly disables rush with a boundary reason'
  );

  await navigateWithState(
    makeValidEntropyState({
      nodeId: 'last_helmsman',
      entropy: 4,
      player: { hp: 1200, maxHp: 1200, base: { body: 30, spirit: 20, agility: 12, luck: 4 } }
    }),
    'entropy Boss entry renders'
  );
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'combat' && saved.run.lawState.law.bossEntropyLocked === true &&
        saved.run.lawState.law.collapseLayers === 2 &&
        document.querySelector('[data-dungeon-law="entropy_ark"]')?.textContent.includes('崩解层 2');
    })()`,
    'Boss entry locks entropy and displays collapse layers'
  );

  const causalPortalState = makeValidExploreState({
    dungeonId: 'causal_clearinghouse',
    nodeId: 'cause_echo_portal',
    law: {
      kind: 'causal_clearinghouse',
      debt: 0,
      pendingLedgerNodeId: null,
      settledLedgerNodeIds: [],
      bossDebtLocked: false,
      collectionSeals: 0,
      entryPassives: { causalVisor: false, echoBreakerGauntlets: false, returnAnchorBelt: false },
      visorCreditUsed: false
    },
    inventory: { gate_sigil: 2 },
    completedDungeonIds: [...ENTROPY_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...ENTROPY_PRIOR_MAINLINE_TASK_IDS],
    log: ['causal to entropy portal smoke save']
  });
  await navigateWithState(causalPortalState, 'causal to entropy portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'entropy_ark' &&
      document.querySelector('[data-dungeon-law="entropy_ark"]')?.textContent.includes('方舟航态')`,
    'causal stable portal reaches entropy ark'
  );

  await navigateWithState(
    makeValidEntropyState({
      nodeId: 'port_return_portal',
      inventory: { gate_sigil: 1 },
      completedDungeonIds: [...MIRROR_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...MIRROR_PRIOR_MAINLINE_TASK_IDS],
      log: ['entropy to mirror portal smoke save']
    }),
    'entropy to mirror portal renders'
  );
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'mirror_cycle_city' &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'real_clue_vault'`,
    'entropy stable portal reaches mirror cycle city'
  );
  await navigateWithState(makeValidExploreState({
    dungeonId: 'mirror_cycle_city',
    nodeId: 'upper_return_portal',
    inventory: { gate_sigil: 1 },
    completedDungeonIds: [...AUCTION_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...AUCTION_PRIOR_MAINLINE_TASK_IDS],
    law: {
      kind: 'mirror_cycle_city', currentPhase: 'real', pendingPhaseNodeId: null,
      resolvedPhaseChoices: {}, anchors: { real: false, mirror: false }, bossAnchorSnapshot: null,
      brokenMirrorShells: 0,
      entryPassives: { parallaxVisor: false, phaseweaveMantle: false, homecomingPrism: false }
    },
    log: ['mirror to redaction portal smoke save']
  }), 'mirror to redaction portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'redaction_scriptorium' &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'folio_gate'`,
    'mirror stable portal reaches redaction scriptorium'
  );
  await navigateWithState(makeValidExploreState({
    dungeonId: 'redaction_scriptorium',
    nodeId: 'upper_revision_portal',
    inventory: { gate_sigil: 1 },
    completedDungeonIds: [...AUCTION_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...AUCTION_PRIOR_MAINLINE_TASK_IDS],
    law: {
      kind: 'redaction_scriptorium',
      pendingClauseNodeId: null,
      resolvedClauseChoices: {},
      bossClauseSnapshot: null,
      entryPassives: { redlineEdge: false, palimpsestMantle: false, finalProofSeal: false }
    },
    log: ['redaction to auction portal smoke save']
  }), 'redaction to auction portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'legacy_auction_court' &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'estate_gate'`,
    'redaction stable portal reaches legacy auction court'
  );
  await navigateWithState(makeValidExploreState({
    dungeonId: 'legacy_auction_court', nodeId: 'upper_auction_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS], claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'legacy_auction_court', pendingLotNodeId: null, resolvedLotChoices: {}, bossLotSnapshot: null, entryPassives: { legacyGavel: false, anonymousVeil: false, escrowPlate: false, finalLotBell: false } }
  }), 'auction to genesis portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'genesis_vault' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'genesis_gate'`, 'auction stable portal reaches genesis vault');
  await navigateWithState(makeValidExploreState({
    dungeonId: 'genesis_vault', nodeId: 'upper_genesis_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...BROADCAST_PRIOR_DUNGEON_IDS], claimedTaskIds: [...BROADCAST_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: [], bossGenomeSnapshot: null, entryGear: {}, entryBloodline: {} }
  }), 'genesis to broadcast portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'silent_broadcast_tower' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'genesis stable portal reaches silent broadcast tower');
  await navigateWithState(makeValidExploreState({
    dungeonId: 'silent_broadcast_tower', nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS], claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'silent_broadcast_tower', noise: 0, pendingRelayNodeId: null, resolvedRelayChoices: {}, bossNoiseSnapshot: null, firstClashMutedUsed: false, entryPassives: { hushblade: false, deadAirHeadset: false, anechoicMantle: false, lastChannelBeacon: false } }
  }), 'broadcast to shelter portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'lost_shelter' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'broadcast stable portal reaches lost shelter');
  await navigateWithState(makeLostShelterExploreSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'shelter to verdict portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'false_testimony_court' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'shelter stable portal reaches false testimony court');
  await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'verdict to replay portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'combat_replay_stage' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'upper_entry'`, 'verdict stable portal reaches replay stage');

  await navigateWithState(
    makeValidEntropyState({
      nodeId: 'entropy_ark_exit',
      clearedNodeIds: ['last_helmsman'],
      completedDungeonIds: [...ENTROPY_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...ENTROPY_PRIOR_MAINLINE_TASK_IDS],
      bossEntropyLocked: true,
      collapseLayers: 2,
      entropy: 4,
      log: ['entropy exit settlement pointer smoke save']
    }),
    'entropy exit settlement entry renders'
  );
  await clickElementByPointer(cdp, '[data-action="exit-current-entropy_ark_exit"]');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.phase === 'result' &&
      document.querySelector('.result-panel')?.textContent.includes('熵海方舟')`,
    'entropy exit settles the run'
  );

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({
    events: cdp.events.filter((event) => !(
      event.method === 'Log.entryAdded' &&
      event.params?.entry?.url === faviconUrl &&
      event.params.entry.text.includes('404')
    ))
  });
  if (browserErrors.length > 0) {
    throw new Error(`Entropy ark pointer smoke should have no browser errors: ${JSON.stringify(browserErrors)}`);
  }
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      innerWidth === 1440 && innerHeight === 900 &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      !document.querySelector('[role="dialog"][aria-modal="true"]')`,
    'entropy smoke restores clean 1440x900 hub'
  );
  console.log('[smoke] entropy ark: real reward -> non-modal pending fieldset, Escape persistence, character/task/retreat availability, 390 steady low gate, 1440 rush high gate, entropy-4 boundary, Boss collapse, causal -> entropy -> mirror -> redaction -> auction -> genesis -> demon portals, exit, and clean 1440x900 reset');
}

async function runMirrorCycleCityPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (state, label) => {
    await injectGameState(cdp, state);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      document.querySelector('.dungeon-card[data-dungeon-id="mirror_cycle_city"] .mirror-city-banner')?.complete`,
    'mirror smoke starts from a fourteen-chapter hub with its visual asset'
  );
  const assetState = await evaluate(
    cdp,
    `(() => {
      const image = document.querySelector('.dungeon-card[data-dungeon-id="mirror_cycle_city"] .mirror-city-banner');
      if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        return { loaded: false };
      }
      const canvas = document.createElement('canvas');
      canvas.width = 72;
      canvas.height = 18;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      let opaque = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0) opaque += 1;
        colors.add(pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2] + ',' + pixels[index + 3]);
      }
      const rect = image.getBoundingClientRect();
      return { loaded: true, colors: colors.size, opaque, width: rect.width, height: rect.height };
    })()`
  );
  if (!assetState.loaded || assetState.colors < 6 || assetState.opaque < 100 || assetState.width <= 0 || assetState.height <= 0) {
    throw new Error(`Mirror-city visual asset should load and paint nonblank pixels: ${JSON.stringify(assetState)}`);
  }

  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(cdp, `document.querySelector('.dungeon-map')`, 'mirror fixture seed enters a valid run');
  const exploreTemplate = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);

  const makeExploreState = ({
    dungeonId,
    nodeId,
    law,
    clearedNodeIds = [],
    inventory = {},
    completedDungeonIds = [],
    claimedTaskIds = [],
    player = {},
    log = ['mirror cycle city pointer smoke save']
  }) => {
    const next = JSON.parse(JSON.stringify(exploreTemplate));
    next.phase = 'explore';
    delete next.combat;
    next.player = { ...next.player, ...player };
    next.inventory = { ...next.inventory, ...inventory };
    next.completedDungeonIds = completedDungeonIds;
    next.claimedTaskIds = claimedTaskIds;
    next.run = {
      ...next.run,
      dungeonId,
      currentNodeId: nodeId,
      clearedNodeIds,
      lawState: makeDungeonLawState(dungeonId, law, { clearedNodeIds })
    };
    next.log = log;
    return next;
  };
  const makeMirrorState = ({
    nodeId = 'cycle_gate',
    currentPhase = 'real',
    pendingPhaseNodeId = null,
    resolvedPhaseChoices = {},
    anchors = { real: false, mirror: false },
    bossAnchorSnapshot = null,
    brokenMirrorShells = 0,
    entryPassives = { parallaxVisor: false, phaseweaveMantle: false, homecomingPrism: false },
    ...options
  } = {}) => makeExploreState({
    dungeonId: 'mirror_cycle_city',
    nodeId,
    law: {
      kind: 'mirror_cycle_city',
      currentPhase,
      pendingPhaseNodeId,
      resolvedPhaseChoices,
      anchors,
      bossAnchorSnapshot,
      brokenMirrorShells,
      entryPassives
    },
    ...options
  });

  const getMirrorLayout = async () => evaluate(
    cdp,
    `(() => {
      const fieldset = document.querySelector('.mirror-phase-fieldset');
      const panel = document.querySelector('.node-action-panel');
      const map = document.querySelector('.dungeon-map');
      const choices = [...document.querySelectorAll('.mirror-phase-choice')];
      const rects = choices.map((choice) => {
        const rect = choice.getBoundingClientRect();
        return {
          left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
          width: rect.width, height: rect.height,
          clipped: choice.scrollWidth > choice.clientWidth + 1 || choice.scrollHeight > choice.clientHeight + 1
        };
      });
      const appContent = document.querySelector('.app-content');
      return {
        viewport: [innerWidth, innerHeight],
        fieldsetInsidePanel: Boolean(fieldset && panel?.contains(fieldset)),
        status: fieldset?.dataset.mirrorPhaseStatus ?? '',
        value: fieldset?.dataset.mirrorPhaseValue ?? '',
        node: fieldset?.dataset.mirrorPhaseNode ?? '',
        choice: fieldset?.dataset.mirrorPhaseChoice ?? '',
        activeChoice: document.activeElement?.getAttribute('data-mirror-phase-choice') ?? '',
        rects,
        lockKind: document.querySelector('.route-lock-status')?.dataset.routeLockKind ?? '',
        enabledMoves: document.querySelectorAll('.grid-node.movable:not(:disabled)').length,
        dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
        bodyModal: document.body.classList.contains('modal-open'),
        inert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
        mapOverflow: Boolean(map && map.scrollWidth > map.clientWidth + 1),
        panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth + 1),
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        characterEnabled: Boolean(document.querySelector('.character-trigger:not(:disabled)')),
        taskEnabled: Boolean(document.querySelector('.task-trigger:not(:disabled)')),
        companionEnabled: Boolean(document.querySelector('.companion-trigger:not(:disabled)')),
        retreatEnabled: [...document.querySelectorAll('button')].some((button) =>
          !button.disabled && button.textContent.includes('撤回主神空间')
        )
      };
    })()`
  );
  const assertPendingLayout = async (width, height, label) => {
    const layout = await getMirrorLayout();
    const [real, mirror] = layout.rects;
    const mobileColumns = width !== 390 || Boolean(real && mirror && Math.abs(real.left - mirror.left) <= 1 && mirror.top >= real.bottom - 1);
    const desktopColumns = width !== 1440 || Boolean(real && mirror && Math.abs(real.top - mirror.top) <= 1 && Math.abs(real.width - mirror.width) <= 1);
    if (
      layout.viewport[0] !== width || layout.viewport[1] !== height || !layout.fieldsetInsidePanel ||
      layout.status !== 'pending' || layout.node !== 'first_phase_mirror' || layout.choice !== 'pending' ||
      layout.rects.length !== 2 || layout.rects.some((rect) => rect.height < 88 || rect.clipped) ||
      !mobileColumns || !desktopColumns || layout.lockKind !== 'mirror_phase' || layout.enabledMoves !== 0 ||
      layout.dialogCount !== 0 || layout.bodyModal || layout.inert || layout.mapOverflow || layout.panelOverflow ||
      layout.pageOverflow || !layout.characterEnabled || !layout.taskEnabled || !layout.companionEnabled || !layout.retreatEnabled
    ) {
      throw new Error(`${label} should expose a stable non-modal mirror fieldset that only locks adjacent movement: ${JSON.stringify(layout)}`);
    }
    return layout;
  };

  await navigateWithState(makeMirrorState({ nodeId: 'first_phase_mirror' }), 'mirror first phase reward renders');
  await setViewport(cdp, 390, 844);
  await clickElementByPointer(cdp, '[data-action="reward-current-first_phase_mirror"]');
  await waitForPage(
    cdp,
    `document.querySelector('.mirror-phase-fieldset[data-mirror-phase-status="pending"][data-mirror-phase-value="real"][data-mirror-phase-node="first_phase_mirror"][data-mirror-phase-choice="pending"]') &&
      document.activeElement === document.querySelector('[data-mirror-phase-choice="real"]')`,
    'mirror reward opens pending fieldset and focuses first legal phase'
  );
  await assertPendingLayout(390, 844, '390x844 mirror phase');
  await pressEscape(cdp);
  const afterEscape = await getMirrorLayout();
  if (afterEscape.status !== 'pending' || afterEscape.activeChoice !== 'real') {
    throw new Error(`Escape should preserve the pending mirror choice and focus: ${JSON.stringify(afterEscape)}`);
  }
  await openCharacterSheet(cdp, 'pending mirror phase');
  await closeCharacterSheet(cdp, 'pending mirror phase');
  await openTaskModal(cdp, 'pending mirror phase');
  await closeTaskModal(cdp, 'pending mirror phase');
  await clickElementByPointer(cdp, '.companion-trigger');
  await waitForPage(cdp, `document.querySelector('.companion-sheet[role="dialog"]')`, 'pending mirror companion sheet opens');
  await clickElementByPointer(cdp, '.companion-close');
  await waitForPage(cdp, `!document.querySelector('.companion-sheet[role="dialog"]')`, 'pending mirror companion sheet closes');
  if ((await getMirrorLayout()).status !== 'pending') throw new Error('Sheets must not settle a pending mirror phase.');

  await clickElementByPointer(cdp, '[data-mirror-phase-choice="real"]');
  await waitForPage(
    cdp,
    `document.querySelector('.mirror-phase-result[data-mirror-phase-status="resolved"][data-mirror-phase-choice="real"]') &&
      document.querySelector('.grid-node[data-route-gate-id="mirror_city_real_relic_phase_lane"][data-route-gate-status="open"]') &&
      document.activeElement === document.querySelector('.grid-node[data-route-gate-id="mirror_city_real_relic_phase_lane"][data-route-gate-status="open"]')`,
    'real phase resolves, opens its route, and focuses the legal move'
  );

  await navigateWithState(
    makeMirrorState({
      nodeId: 'first_phase_mirror',
      pendingPhaseNodeId: 'first_phase_mirror',
      clearedNodeIds: ['first_phase_mirror'],
      player: { hp: 1, maxHp: 100 }
    }),
    'insufficient HP mirror switch renders'
  );
  await waitForPage(
    cdp,
    `document.querySelector('[data-mirror-phase-choice="mirror"]:disabled')?.textContent.includes('生命不足') &&
      document.querySelector('[data-mirror-phase-choice="real"]:not(:disabled)')?.textContent.includes('0 生命')`,
    'insufficient HP disables only the phase-changing choice'
  );

  const frozenPassiveState = makeMirrorState({
    nodeId: 'first_phase_mirror',
    pendingPhaseNodeId: 'first_phase_mirror',
    clearedNodeIds: ['first_phase_mirror'],
    entryPassives: { parallaxVisor: true, phaseweaveMantle: true, homecomingPrism: true },
    player: { hp: 100, maxHp: 100 }
  });
  frozenPassiveState.equipped = { ...BASIC_EQUIPPED };
  await navigateWithState(frozenPassiveState, 'entry-frozen mirror passives survive mid-run equipment mutation');
  await setViewport(cdp, 1440, 900);
  await assertPendingLayout(1440, 900, '1440x900 mirror phase');
  await waitForPage(
    cdp,
    `document.querySelector('[data-mirror-phase-choice="mirror"]')?.textContent.includes('5%（5 点）') &&
      document.querySelector('[data-mirror-phase-choice="mirror"]')?.textContent.includes('无惩罚') &&
      document.querySelector('.mirror-city-map-status[data-mirror-shell-count="1"]')`,
    'all three entry-frozen passives remain active after the live equipment no longer contains them'
  );

  await navigateWithState(
    makeMirrorState({
      nodeId: 'reflection_event_stage',
      currentPhase: 'mirror',
      resolvedPhaseChoices: { first_phase_mirror: 'real' }
    }),
    'mirror-specific route gate renders'
  );
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node[data-route-gate-id="mirror_city_mirror_relic_phase_lane"][data-route-gate-status="open"]')`,
    'mirror phase opens only the mirror relic route'
  );

  await navigateWithState(makeMirrorState({ nodeId: 'real_anchor' }), 'real anchor renders');
  await clickElementByPointer(cdp, '[data-action="reward-current-real_anchor"]');
  await waitForPage(cdp, `document.querySelector('.mirror-city-map-status[data-mirror-anchor-count="1"]')?.textContent.includes('现实已亮')`, 'real anchor lights');
  await navigateWithState(makeMirrorState({ nodeId: 'mirror_anchor', currentPhase: 'mirror', anchors: { real: true, mirror: false } }), 'mirror anchor renders');
  await clickElementByPointer(cdp, '[data-action="reward-current-mirror_anchor"]');
  await waitForPage(cdp, `document.querySelector('.mirror-city-map-status[data-mirror-anchor-count="2"]')?.textContent.includes('镜像已亮')`, 'mirror anchor lights');

  const allChoices = {
    first_phase_mirror: 'real',
    second_phase_mirror: 'mirror',
    third_phase_mirror: 'real'
  };
  for (const [anchors, expectedShells] of [
    [{ real: false, mirror: false }, 2],
    [{ real: true, mirror: false }, 1],
    [{ real: true, mirror: true }, 0]
  ]) {
    await navigateWithState(makeMirrorState({ nodeId: 'nameless_reflection', resolvedPhaseChoices: allChoices, anchors }), `Boss shell ${expectedShells} fixture renders`);
    await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
    await waitForPage(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const law = saved.run.lawState.law;
        return saved.phase === 'combat' && law.bossAnchorSnapshot &&
          document.querySelector('[data-dungeon-law="mirror_cycle_city"]')?.textContent.includes('镜壳 ${expectedShells}/${expectedShells}');
      })()`,
      `Boss starts with ${expectedShells} mirror shells`
    );
  }

  await navigateWithState(makeMirrorState({ nodeId: 'nameless_reflection', resolvedPhaseChoices: allChoices }), 'two-shell Boss attack fixture renders');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await clickButtonByPointer(cdp, '攻击', '.combat-panel');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.lawState.law.brokenMirrorShells === 1 &&
        saved.combat.log.join(' ').includes('最终伤害减半，剩余 1 枚');
    })()`,
    'one positive hit consumes exactly one mirror shell'
  );
  const awakenedState = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  awakenedState.combat.bossPhase = 'awakened';
  awakenedState.combat.monsterHp = 100;
  await navigateWithState(awakenedState, 'awakened mirror Boss save renders');
  await cdp.send('Page.reload');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.bossPhase === 'awakened' &&
      document.querySelector('.combat-panel[data-boss-phase="awakened"]')?.textContent.includes('万相无名')`,
    'mirror Boss awakening persists across reload'
  );

  await navigateWithState(makeExploreState({
    dungeonId: 'entropy_ark',
    nodeId: 'port_return_portal',
    inventory: { gate_sigil: 2 },
    completedDungeonIds: [...MIRROR_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...MIRROR_PRIOR_MAINLINE_TASK_IDS],
    law: {
      kind: 'entropy_ark', entropy: 2, pendingHeadingNodeId: null, resolvedHeadingChoices: {},
      bossEntropyLocked: false, collapseLayers: 0,
      entryPassives: { entropyCompass: false, dissipationMantle: false, arkKeelBoots: false }, compassCreditUsed: false
    }
  }), 'entropy to mirror portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'mirror_cycle_city'`, 'entropy portal reaches mirror city');
  await navigateWithState(makeMirrorState({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 }, completedDungeonIds: [...REDACTION_PRIOR_DUNGEON_IDS], claimedTaskIds: [...REDACTION_PRIOR_MAINLINE_TASK_IDS] }), 'mirror to redaction portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'redaction_scriptorium' &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'folio_gate'`,
    'mirror portal reaches redaction scriptorium'
  );
  await navigateWithState(makeExploreState({
    dungeonId: 'redaction_scriptorium',
    nodeId: 'upper_revision_portal',
    inventory: { gate_sigil: 1 },
    completedDungeonIds: [...AUCTION_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...AUCTION_PRIOR_MAINLINE_TASK_IDS],
    law: {
      kind: 'redaction_scriptorium',
      pendingClauseNodeId: null,
      resolvedClauseChoices: {},
      bossClauseSnapshot: null,
      entryPassives: { redlineEdge: false, palimpsestMantle: false, finalProofSeal: false }
    },
    log: ['redaction to auction portal smoke save']
  }), 'redaction to auction portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'legacy_auction_court' &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'estate_gate'`,
    'redaction portal reaches legacy auction court'
  );
  await navigateWithState(makeExploreState({
    dungeonId: 'legacy_auction_court', nodeId: 'upper_auction_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS], claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'legacy_auction_court', pendingLotNodeId: null, resolvedLotChoices: {}, bossLotSnapshot: null, entryPassives: { legacyGavel: false, anonymousVeil: false, escrowPlate: false, finalLotBell: false } }
  }), 'auction to genesis portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'genesis_vault'`, 'auction portal reaches genesis vault');
  await navigateWithState(makeExploreState({
    dungeonId: 'genesis_vault', nodeId: 'upper_genesis_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...BROADCAST_PRIOR_DUNGEON_IDS], claimedTaskIds: [...BROADCAST_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: [], bossGenomeSnapshot: null, entryGear: {}, entryBloodline: {} }
  }), 'genesis to broadcast portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'silent_broadcast_tower' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'genesis portal reaches silent broadcast tower');
  await navigateWithState(makeExploreState({
    dungeonId: 'silent_broadcast_tower', nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS], claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'silent_broadcast_tower', noise: 0, pendingRelayNodeId: null, resolvedRelayChoices: {}, bossNoiseSnapshot: null, firstClashMutedUsed: false, entryPassives: { hushblade: false, deadAirHeadset: false, anechoicMantle: false, lastChannelBeacon: false } }
  }), 'broadcast to shelter portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'lost_shelter' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'broadcast portal reaches lost shelter');
  await navigateWithState(makeLostShelterExploreSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'shelter to verdict portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'false_testimony_court' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'north_entry'`, 'shelter portal reaches false testimony court');
  await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'verdict to replay portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'combat_replay_stage' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'upper_entry'`, 'verdict portal reaches replay stage');

  await navigateWithState(makeMirrorState({
    nodeId: 'mirror_cycle_exit',
    clearedNodeIds: ['nameless_reflection'],
    completedDungeonIds: [...MIRROR_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...MIRROR_PRIOR_MAINLINE_TASK_IDS],
    resolvedPhaseChoices: allChoices,
    anchors: { real: true, mirror: true },
    bossAnchorSnapshot: { real: true, mirror: true }
  }), 'mirror exit settlement renders');
  await clickElementByPointer(cdp, '[data-action="exit-current-mirror_cycle_exit"]');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.phase === 'result' && document.querySelector('.result-panel')?.textContent.includes('镜海轮回城')`, 'mirror exit settles');

  const malformed = makeMirrorState({ nodeId: 'cycle_gate', log: ['mirror malformed local recovery'] });
  malformed.rewardPoints = 4321;
  malformed.run.lawState.law = {
    kind: 'mirror_cycle_city', currentPhase: 'broken', pendingPhaseNodeId: 'unknown_mirror',
    resolvedPhaseChoices: { first_phase_mirror: 'broken', second_phase_mirror: 'mirror' },
    anchors: { real: 'yes', mirror: true }, bossAnchorSnapshot: { real: false, mirror: false },
    brokenMirrorShells: 99, entryPassives: { parallaxVisor: 'yes', phaseweaveMantle: true }
  };
  await navigateWithState(malformed, 'malformed mirror substate recovers locally');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const law = saved.run.lawState.law;
      return saved.rewardPoints === 4321 && saved.log[0] === 'mirror malformed local recovery' &&
        law.kind === 'mirror_cycle_city' && law.currentPhase === 'real' && law.pendingPhaseNodeId === null &&
        law.resolvedPhaseChoices.second_phase_mirror === 'mirror' && !('first_phase_mirror' in law.resolvedPhaseChoices) &&
        law.anchors.real === false && law.anchors.mirror === true;
    })()`,
    'malformed mirror law normalizes without resetting the whole save'
  );
  const legacy = makeMirrorState({ nodeId: 'cycle_gate', log: ['mirror legacy save recovery'] });
  delete legacy.inventory.phase_glass;
  delete legacy.inventory.redaction_ink;
  delete legacy.run.lawState;
  await navigateWithState(legacy, 'legacy mirror save recovers');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.inventory.phase_glass === 0 && saved.run.lawState.law.kind === 'mirror_cycle_city' &&
        saved.log[0] === 'mirror legacy save recovery';
    })()`,
    'legacy mirror save re-saves phase_glass zero and a normalized law'
  );

  const unknownItem = makeMirrorState({ nodeId: 'cycle_gate', log: ['unknown item must reject'] });
  unknownItem.inventory.unknown_mirror_item = 1;
  await navigateWithState(unknownItem, 'unknown item fixture falls back');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`,
    'unknown item IDs remain rejected'
  );

  const restartState = makeMirrorState({
    nodeId: 'cycle_gate',
    currentPhase: 'mirror',
    resolvedPhaseChoices: allChoices,
    anchors: { real: true, mirror: true },
    inventory: { phase_glass: 7 },
    completedDungeonIds: [...MIRROR_PRIOR_DUNGEON_IDS],
    claimedTaskIds: [...MIRROR_PRIOR_MAINLINE_TASK_IDS],
    log: ['mirror real restart pointer smoke save']
  });
  await navigateWithState(restartState, 'mirror progress is seeded before the real restart pointer');
  await setViewport(cdp, 1440, 900);
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run?.dungeonId === 'mirror_cycle_city' && saved.inventory.phase_glass === 7 &&
        saved.run.lawState.law.currentPhase === 'mirror' &&
        Object.keys(saved.run.lawState.law.resolvedPhaseChoices).length === 3;
    })()`,
    'restart fixture contains mirror run progress and material'
  );
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      !document.querySelector('.dungeon-map') && !document.querySelector('[data-dungeon-law="mirror_cycle_city"]') &&
      !document.querySelector('[data-mirror-phase-status]')`,
    'real restart pointer clears the mirror run and phase progress'
  );
  await openCharacterSheet(cdp, 'mirror real restart material reset');
  await waitForPage(
    cdp,
    `!document.querySelector('.inventory-chip[data-item-id="phase_glass"]') &&
      !document.querySelector('.character-sheet')?.textContent.includes('相位镜晶')`,
    'real restart pointer clears phase glass material'
  );
  await closeCharacterSheet(cdp, 'mirror real restart material reset');
  await cdp.send('Page.reload');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && innerWidth === 1440 && innerHeight === 900 &&
      document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('.dungeon-map') &&
      !document.querySelector('[role="dialog"][aria-modal="true"]')`,
    'real restart remains a clean 1440x900 hub after reload'
  );

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({
    events: cdp.events.filter((event) => !(
      event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
    ))
  });
  if (browserErrors.length > 0) throw new Error(`Mirror city smoke should have no browser errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] mirror cycle city: responsive pending phase, Escape/sheet access, HP gate, frozen passives, phase routes, dual anchors, 2/1/0 shells, one-hit shell use, Boss awakening reload, entropy -> mirror -> redaction -> auction -> genesis -> demon portals, exit, save recovery, unknown-ID rejection, asset pixels, browser errors, and pointer-driven restart/reload reset');
}

async function runRedactionScriptoriumPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (state, label) => {
    await injectGameState(cdp, state);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      document.querySelector('.dungeon-card[data-dungeon-id="redaction_scriptorium"] .redaction-scriptorium-banner')?.complete`,
    'redaction smoke starts from a fourteen-chapter hub with its visual asset'
  );
  const hubEvidence = await evaluate(
    cdp,
    `(() => {
      const image = document.querySelector('.dungeon-card[data-dungeon-id="redaction_scriptorium"] .redaction-scriptorium-banner');
      if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return { loaded: false };
      const canvas = document.createElement('canvas');
      canvas.width = 72;
      canvas.height = 18;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      let opaque = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0) opaque += 1;
        colors.add(pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2] + ',' + pixels[index + 3]);
      }
      return {
        loaded: true,
        natural: [image.naturalWidth, image.naturalHeight],
        colors: colors.size,
        opaque,
        tier11: document.querySelector('[data-dungeon-id="mirror_cycle_city"]')?.textContent.includes('Tier 11'),
        tier12: document.querySelector('[data-dungeon-id="redaction_scriptorium"]')?.textContent.includes('Tier 12')
      };
    })()`
  );
  if (!hubEvidence.loaded || hubEvidence.natural?.join('x') !== '720x180' || hubEvidence.colors < 6 || hubEvidence.opaque < 100 || !hubEvidence.tier11 || !hubEvidence.tier12) {
    throw new Error(`Tier-12 hub asset and 11 -> 12 chapter cards should render: ${JSON.stringify(hubEvidence)}`);
  }

  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(cdp, `document.querySelector('.dungeon-map')`, 'redaction fixture seed enters a valid modern run');
  const exploreTemplate = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  const makeExploreState = ({
    dungeonId,
    nodeId,
    law,
    clearedNodeIds = [],
    inventory = {},
    completedDungeonIds = [...REDACTION_PRIOR_DUNGEON_IDS],
    claimedTaskIds = [...REDACTION_PRIOR_MAINLINE_TASK_IDS],
    player = {},
    log = ['redaction scriptorium pointer smoke save']
  }) => {
    const next = JSON.parse(JSON.stringify(exploreTemplate));
    next.phase = 'explore';
    delete next.combat;
    next.player = { ...next.player, ...player };
    next.inventory = { ...next.inventory, ...inventory };
    next.completedDungeonIds = completedDungeonIds;
    next.claimedTaskIds = claimedTaskIds;
    next.run = {
      ...next.run,
      dungeonId,
      currentNodeId: nodeId,
      clearedNodeIds,
      lawState: makeDungeonLawState(dungeonId, law, { clearedNodeIds })
    };
    next.log = log;
    return next;
  };
  const makeRedactionState = ({
    nodeId = 'folio_gate',
    pendingClauseNodeId = null,
    resolvedClauseChoices = {},
    bossClauseSnapshot = null,
    entryPassives = { redlineEdge: false, palimpsestMantle: false, finalProofSeal: false },
    ...options
  } = {}) => makeExploreState({
    dungeonId: 'redaction_scriptorium',
    nodeId,
    law: { kind: 'redaction_scriptorium', pendingClauseNodeId, resolvedClauseChoices, bossClauseSnapshot, entryPassives },
    ...options
  });

  const getPendingLayout = async () => evaluate(
    cdp,
    `(() => {
      const fieldset = document.querySelector('.redaction-clause-fieldset');
      const panel = document.querySelector('.node-action-panel');
      const map = document.querySelector('.dungeon-map[data-dungeon-id="redaction_scriptorium"]');
      const choices = [...document.querySelectorAll('button.redaction-clause-choice[data-redaction-clause-choice]')];
      const rects = choices.map((choice) => {
        const rect = choice.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, clipped: choice.scrollWidth > choice.clientWidth + 1 };
      });
      const mapNodes = [...(map?.querySelectorAll('.grid-node') ?? [])];
      const rightColumn = mapNodes.filter((node) => ['body_proof_vault', 'upper_revision_portal', 'boss_side_lock', 'lower_revision_portal', 'scriptorium_exit'].includes(node.dataset.action?.replace('grid-', '') ?? ''));
      const pointerHits = rightColumn.map((node) => {
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(hit && node.contains(hit));
      });
      const appContent = document.querySelector('.app-content');
      return {
        viewport: [innerWidth, innerHeight],
        insidePanel: Boolean(fieldset && panel?.contains(fieldset)),
        status: fieldset?.dataset.redactionClauseStatus ?? '',
        value: fieldset?.dataset.redactionClauseValue ?? '',
        node: fieldset?.dataset.redactionClauseNode ?? '',
        choice: fieldset?.dataset.redactionClauseChoice ?? '',
        activeChoice: document.activeElement?.getAttribute('data-redaction-clause-choice') ?? '',
        rects,
        nodeCount: mapNodes.length,
        columns: map ? getComputedStyle(map).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        minimumNodeWidth: mapNodes.length ? Math.min(...mapNodes.map((node) => node.getBoundingClientRect().width)) : 0,
        rightColumnCount: rightColumn.length,
        pointerHits,
        lockKind: document.querySelector('.route-lock-status')?.dataset.routeLockKind ?? '',
        enabledMoves: document.querySelectorAll('.grid-node.movable:not(:disabled)').length,
        dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
        bodyModal: document.body.classList.contains('modal-open'),
        inert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        mapOverflow: Boolean(map && map.scrollWidth > map.clientWidth + 1),
        panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth + 1),
        characterEnabled: Boolean(document.querySelector('.character-trigger:not(:disabled)')),
        taskEnabled: Boolean(document.querySelector('.task-trigger:not(:disabled)')),
        companionEnabled: Boolean(document.querySelector('.companion-trigger:not(:disabled)')),
        methodEnabled: Boolean(document.querySelector('.method-trigger:not(:disabled)')),
        retreatEnabled: [...document.querySelectorAll('button')].some((button) => !button.disabled && button.textContent.includes('撤回主神空间'))
      };
    })()`
  );
  const assertPendingLayout = async (width, height, label) => {
    const layout = await getPendingLayout();
    const [certify, redact] = layout.rects;
    const mobileColumns = width !== 390 || Boolean(certify && redact && Math.abs(certify.left - redact.left) <= 1 && redact.top >= certify.bottom - 1);
    const desktopColumns = width !== 1440 || Boolean(certify && redact && Math.abs(certify.top - redact.top) <= 1 && Math.abs(certify.width - redact.width) <= 1);
    if (
      layout.viewport.join('x') !== `${width}x${height}` || !layout.insidePanel || layout.status !== 'pending' || layout.node !== 'body_clause_desk' ||
      layout.choice !== 'pending' || layout.rects.length !== 2 || layout.rects.some((rect) => rect.height < 44 || rect.clipped) || !mobileColumns || !desktopColumns ||
      layout.nodeCount !== 30 || layout.columns !== 6 || layout.minimumNodeWidth < 43.5 || layout.rightColumnCount !== 5 || layout.pointerHits.some((hit) => !hit) ||
      layout.lockKind !== 'redaction_clause' || layout.enabledMoves !== 0 || layout.dialogCount !== 0 || layout.bodyModal || layout.inert ||
      layout.pageOverflow || layout.mapOverflow || layout.panelOverflow || !layout.characterEnabled || !layout.taskEnabled || !layout.companionEnabled ||
      !layout.methodEnabled || !layout.retreatEnabled
    ) throw new Error(`${label} should expose a non-modal clause fieldset and a pointer-safe six-column map: ${JSON.stringify(layout)}`);
  };

  await navigateWithState(makeRedactionState({ nodeId: 'body_clause_desk' }), 'body clause first-clear fixture renders');
  await setViewport(cdp, 390, 844);
  await clickElementByPointer(cdp, '[data-action="reward-current-body_clause_desk"]');
  await waitForPage(
    cdp,
    `document.querySelector('[data-redaction-clause-status="pending"][data-redaction-clause-node="body_clause_desk"][data-redaction-clause-choice="pending"]') &&
      document.activeElement === document.querySelector('[data-redaction-clause-choice="certify"]')`,
    'real first-clear opens the body clause and focuses the first enabled choice'
  );
  await assertPendingLayout(390, 844, '390x844 redaction clause');
  await pressEscape(cdp);
  let pending = await getPendingLayout();
  if (pending.status !== 'pending' || pending.activeChoice !== 'certify') throw new Error(`Escape must do nothing to the pending fieldset: ${JSON.stringify(pending)}`);
  await openCharacterSheet(cdp, 'pending redaction clause');
  await assertEscapeClosesCharacterSheet(cdp, 'pending redaction clause');
  await openTaskModal(cdp, 'pending redaction clause');
  await assertEscapeClosesTaskModal(cdp, 'pending redaction clause');
  for (const [trigger, sheet] of [['.companion-trigger', '.companion-sheet'], ['.method-trigger', '.method-sheet']]) {
    await clickElementByPointer(cdp, trigger);
    await waitForPage(cdp, `document.querySelector(${JSON.stringify(sheet + '[role="dialog"]')})`, `${trigger} opens over pending clause`);
    await pressEscape(cdp);
    await waitForPage(cdp, `!document.querySelector(${JSON.stringify(sheet)}) && document.activeElement === document.querySelector(${JSON.stringify(trigger)}) && document.querySelector('[data-redaction-clause-status="pending"]')`, `${trigger} Escape closes only its sheet and restores focus`);
  }
  pending = await getPendingLayout();
  if (pending.status !== 'pending') throw new Error('Character, task, companion, and method sheets must preserve the pending clause.');
  await clickElementByPointer(cdp, '[data-redaction-clause-choice="certify"]');
  await waitForPage(
    cdp,
    `document.querySelector('.redaction-clause-result[data-redaction-clause-choice="certify"][role="status"][aria-live="polite"]')?.textContent.includes('已裁定 1/3') &&
      document.querySelector('[data-route-sector="redaction_body_clause_area"][data-open-gates="2"]')`,
    'certify announces exact counts and opens the body optional area'
  );

  await navigateWithState(makeRedactionState({
    nodeId: 'body_clause_desk', pendingClauseNodeId: 'body_clause_desk', clearedNodeIds: ['body_clause_desk'], player: { hp: 999 }
  }), 'redact exact-cost fixture renders');
  const redactBefore = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player`);
  await clickElementByPointer(cdp, '[data-redaction-clause-choice="redact"]');
  await waitForPage(cdp, `document.querySelector('.redaction-clause-result[data-redaction-clause-choice="redact"]')`, 'redact resolves through a real pointer');
  const redactAfter = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  const expectedRedactDamage = Math.max(1, Math.floor(redactBefore.maxHp * 0.08));
  if (redactBefore.hp - redactAfter.player.hp !== expectedRedactDamage || redactAfter.run.lawState.law.resolvedClauseChoices.body_clause_desk !== 'redact') {
    throw new Error(`Redact should charge exactly 8% max HP once: ${JSON.stringify({ redactBefore, after: redactAfter.player, expectedRedactDamage })}`);
  }
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('[data-route-sector="redaction_body_clause_area"][data-open-gates="0"]') && !document.querySelector('.redaction-clause-choice')`, 'redact permanently closes its optional area and remains one-shot after reload');

  await navigateWithState(makeRedactionState({
    nodeId: 'body_clause_desk', pendingClauseNodeId: 'body_clause_desk', clearedNodeIds: ['body_clause_desk'], player: { hp: 1 }
  }), 'insufficient HP clause fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-redaction-clause-choice="redact"]:disabled')?.textContent.includes('生命不足') && document.querySelector('[data-redaction-clause-choice="certify"]:not(:disabled)')`, 'insufficient HP disables only redact');

  await navigateWithState(makeRedactionState({
    nodeId: 'return_clause_desk', pendingClauseNodeId: 'return_clause_desk', clearedNodeIds: ['return_clause_desk'],
    entryPassives: { redlineEdge: false, palimpsestMantle: false, finalProofSeal: true }
  }), 'return clause negative-player-effect copy renders');
  await waitForPage(
    cdp,
    `document.querySelector('[data-redaction-clause-choice="certify"]')?.textContent.includes('封印态玩家治疗与防御效果 -5%') &&
      document.querySelector('[data-redaction-clause-choice="certify"]')?.textContent.includes('觉醒态玩家治疗与防御效果 -10%')`,
    'return clause copy describes the halved player penalty instead of a Boss healing buff'
  );

  const clauseNodes = ['body_clause_desk', 'memory_clause_desk', 'return_clause_desk'];
  for (const [index, nodeId] of clauseNodes.entries()) {
    await navigateWithState(makeRedactionState({ nodeId, pendingClauseNodeId: nodeId, clearedNodeIds: [nodeId] }), `${nodeId} one-shot fixture renders`);
    const choice = index % 2 === 0 ? 'certify' : 'redact';
    await clickElementByPointer(cdp, `[data-redaction-clause-choice="${choice}"]`);
    await waitForPage(cdp, `document.querySelector('.redaction-clause-result[data-redaction-clause-node="${nodeId}"][data-redaction-clause-choice="${choice}"]') && !document.querySelector('.redaction-clause-choice')`, `${nodeId} resolves exactly once`);
  }

  const combinations = Array.from({ length: 8 }, (_, mask) => Object.fromEntries(
    clauseNodes.map((nodeId, index) => [nodeId, (mask & (1 << index)) ? 'certify' : 'redact'])
  ));
  for (const [index, choices] of combinations.entries()) {
    await navigateWithState(makeRedactionState({ nodeId: 'final_proof_nexus', resolvedClauseChoices: choices }), `redaction combination ${index + 1}/8 renders`);
    await waitForPage(cdp, `document.querySelector('[data-action="grid-last_redactor"][data-route-gate-status="open"]:not(:disabled)')`, `redaction combination ${index + 1}/8 opens the Boss gate`);
    await clickElementByPointer(cdp, '[data-action="grid-last_redactor"]');
    await waitForPage(cdp, `document.querySelector('.grid-node.current[data-action="grid-last_redactor"]')`, `redaction combination ${index + 1}/8 reaches the Boss`);
  }

  const allCertified = Object.fromEntries(clauseNodes.map((nodeId) => [nodeId, 'certify']));
  const passiveCases = [
    [{ redlineEdge: true, palimpsestMantle: false, finalProofSeal: false }, ['防御 +5%', '术强 +10%', '治疗 -10%'], 'redlineEdge'],
    [{ redlineEdge: false, palimpsestMantle: true, finalProofSeal: false }, ['防御 +10%', '术强 +5%', '治疗 -10%'], 'palimpsestMantle'],
    [{ redlineEdge: false, palimpsestMantle: false, finalProofSeal: true }, ['防御 +10%', '术强 +10%', '治疗 -5%', '防御效果 -5%'], 'finalProofSeal']
  ];
  for (const [entryPassives, expectedEffects, passiveId] of passiveCases) {
    for (const frozen of [false, true]) {
      const fixture = makeRedactionState({
        nodeId: 'final_proof_nexus', resolvedClauseChoices: allCertified,
        bossClauseSnapshot: frozen ? allCertified : null, entryPassives
      });
      fixture.equipped = { ...BASIC_EQUIPPED };
      await navigateWithState(fixture, `${passiveId} ${frozen ? 'frozen' : 'projected'} clause fixture renders after live equipment mutation`);
      const effectEvidence = await evaluate(cdp, `(() => {
        const status = document.querySelector('.redaction-map-status');
        return { text: status?.textContent.replace(/\\s+/g, ' ').trim() ?? '', state: status?.dataset.redactionClauseStatus, passive: status?.querySelector('[data-redaction-entry-passive="${passiveId}"]')?.dataset.frozen };
      })()`);
      if (effectEvidence.state !== (frozen ? 'frozen' : 'resolved') || effectEvidence.passive !== 'true' || expectedEffects.some((effect) => !effectEvidence.text.includes(effect))) {
        throw new Error(`${passiveId} must halve only its matching ${frozen ? 'frozen' : 'projected'} clause effect: ${JSON.stringify(effectEvidence)}`);
      }
    }
  }

  await navigateWithState(makeRedactionState({ nodeId: 'last_redactor', resolvedClauseChoices: allCertified }), 'redaction Boss snapshot fixture renders');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.bossClauseSnapshot?.body_clause_desk === 'certify'`, 'Boss entry freezes the clause snapshot');
  const awakenedBoss = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  awakenedBoss.combat.bossPhase = 'awakened';
  awakenedBoss.combat.monsterHp = Math.max(1, awakenedBoss.combat.monsterHp);
  await navigateWithState(awakenedBoss, 'awakened redaction Boss save renders');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.bossPhase === 'awakened' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.bossClauseSnapshot.return_clause_desk === 'certify' && document.querySelector('.combat-panel[data-boss-phase="awakened"]')`, 'Boss snapshot and awakening persist through reload');

  const indicatorFixture = makeRedactionState({ nodeId: 'errata_event_stage' });
  indicatorFixture.run.protocol = { id: 'imprint', rulesVersion: 1 };
  indicatorFixture.run.routeContractState = { rulesVersion: 1, contractId: 'redaction_copyist_recharge', dungeonId: 'redaction_scriptorium', completedTargetCount: 0, status: 'active' };
  indicatorFixture.run.equipmentHunt = { rulesVersion: 1, dungeonId: 'redaction_scriptorium', targetEquipmentId: 'redline_edge', clueNodeIds: ['north_clue_cache', 'south_clue_cache'], crossedDungeonPortal: false };
  indicatorFixture.run.pursuitState = { rulesVersion: 1, dungeonId: 'redaction_scriptorium', status: 'stalking', nodeId: 'palimpsest_censor_alpha', contacts: 0, graceMoves: 0, rewardGranted: false, repelledReason: null };
  await navigateWithState(indicatorFixture, 'Tier-12 protocol and indicator fixture renders');
  await waitForPage(
    cdp,
    `document.querySelector('.task-trigger') && document.querySelector('[data-run-protocol="imprint"]') && document.querySelector('[data-route-contract-selected="redaction_copyist_recharge"]') &&
      document.querySelector('[data-equipment-hunt-clue-id="north_clue_cache"]') && document.querySelector('[data-equipment-hunt-clue-id="south_clue_cache"]') &&
      document.querySelector('.dungeon-events')?.textContent.includes('覆页证词') &&
      document.querySelector('[data-run-pursuit-status="stalking"]') && document.querySelector('[data-pursuit-position="true"]')`,
    'task, protocol, contract, hunt clues, memory events, and pursuit indicators remain rendered'
  );

  const mirrorLaw = { kind: 'mirror_cycle_city', currentPhase: 'real', pendingPhaseNodeId: null, resolvedPhaseChoices: {}, anchors: { real: false, mirror: false }, bossAnchorSnapshot: null, brokenMirrorShells: 0, entryPassives: { parallaxVisor: false, phaseweaveMantle: false, homecomingPrism: false } };
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'folio_gate'], ['lower_return_portal', 'lower_supply_margin']]) {
    await navigateWithState(makeExploreState({ dungeonId: 'mirror_cycle_city', nodeId: portalNodeId, law: mirrorLaw, inventory: { gate_sigil: 1 } }), `mirror ${portalNodeId} -> Tier 12 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'redaction_scriptorium' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 11 ${portalNodeId} reaches Tier 12`);
  }
  for (const portalNodeId of ['upper_revision_portal', 'lower_revision_portal', 'return_revision_portal']) {
    await navigateWithState(makeRedactionState({
      nodeId: portalNodeId,
      inventory: { gate_sigil: 1 },
      completedDungeonIds: [...AUCTION_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...AUCTION_PRIOR_MAINLINE_TASK_IDS]
    }), `Tier 12 ${portalNodeId} -> Tier 13 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'legacy_auction_court'`, `Tier 12 ${portalNodeId} reaches Tier 13`);
  }
  await navigateWithState(makeExploreState({
    dungeonId: 'legacy_auction_court', nodeId: 'upper_auction_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS], claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'legacy_auction_court', pendingLotNodeId: null, resolvedLotChoices: {}, bossLotSnapshot: null, entryPassives: { legacyGavel: false, anonymousVeil: false, escrowPlate: false, finalLotBell: false } }
  }), 'Tier 13 -> Tier 14 portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'genesis_vault'`, 'Tier 13 portal reaches Tier 14');
  await navigateWithState(makeExploreState({
    dungeonId: 'genesis_vault', nodeId: 'upper_genesis_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...BROADCAST_PRIOR_DUNGEON_IDS], claimedTaskIds: [...BROADCAST_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: [], bossGenomeSnapshot: null, entryGear: {}, entryBloodline: {} }
  }), 'Tier 14 -> Tier 15 portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'silent_broadcast_tower'`, 'Tier 14 portal reaches Tier 15');
  await navigateWithState(makeExploreState({
    dungeonId: 'silent_broadcast_tower', nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 },
    completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS], claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS],
    law: { kind: 'silent_broadcast_tower', noise: 0, pendingRelayNodeId: null, resolvedRelayChoices: {}, bossNoiseSnapshot: null, firstClashMutedUsed: false, entryPassives: { hushblade: false, deadAirHeadset: false, anechoicMantle: false, lastChannelBeacon: false } }
  }), 'Tier 15 -> Tier 16 portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'lost_shelter'`, 'Tier 15 portal reaches Tier 16');
  await navigateWithState(makeLostShelterExploreSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'Tier 16 -> Tier 17 portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'false_testimony_court'`, 'Tier 16 portal reaches Tier 17');
  await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'Tier 17 -> Tier 18 portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.dungeonId === 'combat_replay_stage'`, 'Tier 17 portal reaches Tier 18');

  const malformed = makeRedactionState({ nodeId: 'folio_gate', log: ['redaction malformed local recovery'] });
  malformed.rewardPoints = 5432;
  malformed.run.lawState.law = { kind: 'redaction_scriptorium', pendingClauseNodeId: 'not_a_clause', resolvedClauseChoices: { body_clause_desk: 'certify', memory_clause_desk: 'invalid' }, bossClauseSnapshot: 'bad', entryPassives: { redlineEdge: true, palimpsestMantle: 'yes' } };
  await navigateWithState(malformed, 'malformed redaction law recovers locally');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; const law = saved.run.lawState.law; return saved.rewardPoints === 5432 && saved.log[0] === 'redaction malformed local recovery' && law.kind === 'redaction_scriptorium' && law.pendingClauseNodeId === null && law.resolvedClauseChoices.body_clause_desk === 'certify' && !('memory_clause_desk' in law.resolvedClauseChoices) && law.entryPassives.redlineEdge === true && law.entryPassives.palimpsestMantle === false; })()`, 'malformed Tier-12 law normalizes without resetting the whole save');

  const legacy = makeRedactionState({ nodeId: 'folio_gate', log: ['redaction legacy save recovery'] });
  delete legacy.inventory.redaction_ink;
  delete legacy.run.lawState;
  await navigateWithState(legacy, 'legacy redaction save recovers');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.inventory.redaction_ink === 0 && saved.run.lawState.law.kind === 'redaction_scriptorium' && saved.log[0] === 'redaction legacy save recovery'; })()`, 'legacy missing redaction ink re-saves zero with a local law');

  const invalidFixtures = [
    ['unknown ink ID', (fixture) => { fixture.inventory.unknown_redaction_ink = 1; }],
    ['negative redaction ink', (fixture) => { fixture.inventory.redaction_ink = -1; }],
    ['noninteger redaction ink', (fixture) => { fixture.inventory.redaction_ink = 1.5; }],
    ['unknown equipment ID', (fixture) => { fixture.ownedEquipment.push('unknown_redaction_equipment'); fixture.equipmentLevels.unknown_redaction_equipment = 1; }]
  ];
  for (const [label, mutate] of invalidFixtures) {
    const fixture = makeRedactionState({ nodeId: 'folio_gate', log: [`${label} rejection`] });
    mutate(fixture);
    await navigateWithState(fixture, `${label} fixture falls back`);
    await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, `${label} remains rejected`);
  }

  const restartFixture = makeRedactionState({ nodeId: 'folio_gate', resolvedClauseChoices: allCertified, inventory: { redaction_ink: 7 } });
  await navigateWithState(restartFixture, 'redaction restart fixture renders');
  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[data-redaction-clause-status]') && innerWidth === 1440 && innerHeight === 900`, 'real restart clears Tier-12 law and material state');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[role="dialog"][aria-modal="true"]') && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'redaction smoke finishes on a clean 1440x900 hub');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404'))) });
  if (browserErrors.length > 0) throw new Error(`Redaction smoke should have no browser errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] redaction scriptorium: 19-card asset pixels, 30-node mobile map, real pending choices/focus/sheets, certify/redact routes and HP, one-shot clauses, 8 Boss combinations, frozen snapshots/passives, 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 1 portals, legacy/local recovery, invalid-ID rejection, and clean restart/reload pass');
}

async function runLegacyAuctionCourtPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (state, label) => {
    await injectGameState(cdp, state);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      document.querySelector('.dungeon-card[data-dungeon-id="legacy_auction_court"] .legacy-auction-court-banner')?.complete`,
    'auction smoke starts from a fourteen-chapter hub with its visual asset'
  );
  const hubEvidence = await evaluate(cdp, `(() => {
    const image = document.querySelector('.dungeon-card[data-dungeon-id="legacy_auction_court"] .legacy-auction-court-banner');
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return { loaded: false };
    const canvas = document.createElement('canvas');
    canvas.width = 72;
    canvas.height = 18;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add(pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2] + ',' + pixels[index + 3]);
      if (pixels[index + 3] > 0) opaque += 1;
    }
    return {
      loaded: true,
      natural: [image.naturalWidth, image.naturalHeight],
      colors: colors.size,
      opaque,
      tiers: [12, 13].map((tier) => [...document.querySelectorAll('.dungeon-card')].some((card) => card.textContent.includes('Tier ' + tier)))
    };
  })()`);
  if (!hubEvidence.loaded || hubEvidence.natural?.join('x') !== '720x180' || hubEvidence.colors < 6 || hubEvidence.opaque < 100 || hubEvidence.tiers?.some((value) => !value)) {
    throw new Error(`Tier-13 hub asset and chapter cards should render: ${JSON.stringify(hubEvidence)}`);
  }

  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(cdp, `document.querySelector('.dungeon-map')`, 'auction fixture seed enters a valid modern run');
  const exploreTemplate = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  const defaultPassives = { legacyGavel: false, anonymousVeil: false, escrowPlate: false, finalLotBell: false };
  const makeExploreState = ({
    dungeonId,
    nodeId,
    law,
    clearedNodeIds = [],
    inventory = {},
    lootItems = {},
    completedDungeonIds = [...AUCTION_PRIOR_DUNGEON_IDS],
    claimedTaskIds = [...AUCTION_PRIOR_MAINLINE_TASK_IDS],
    log = ['legacy auction court pointer smoke save']
  }) => {
    const next = JSON.parse(JSON.stringify(exploreTemplate));
    next.phase = 'explore';
    delete next.combat;
    next.inventory = { ...next.inventory, ...inventory };
    next.completedDungeonIds = completedDungeonIds;
    next.claimedTaskIds = claimedTaskIds;
    next.run = {
      ...next.run,
      dungeonId,
      currentNodeId: nodeId,
      clearedNodeIds,
      lootBag: { ...next.run.lootBag, items: { ...lootItems } },
      lawState: makeDungeonLawState(dungeonId, law, { clearedNodeIds })
    };
    next.log = log;
    return next;
  };
  const makeAuctionState = ({
    nodeId = 'estate_gate',
    pendingLotNodeId = null,
    resolvedLotChoices = {},
    bossLotSnapshot = null,
    entryPassives = defaultPassives,
    scrip = 0,
    ...options
  } = {}) => makeExploreState({
    dungeonId: 'legacy_auction_court',
    nodeId,
    law: { kind: 'legacy_auction_court', pendingLotNodeId, resolvedLotChoices, bossLotSnapshot, entryPassives },
    lootItems: { legacy_scrip: scrip },
    ...options
  });

  const getPendingLayout = async () => evaluate(cdp, `(() => {
    const fieldset = document.querySelector('.auction-lot-fieldset');
    const panel = document.querySelector('.node-action-panel');
    const map = document.querySelector('.dungeon-map[data-dungeon-id="legacy_auction_court"]');
    const choices = [...document.querySelectorAll('button.auction-lot-choice[data-auction-lot-choice]')];
    const rects = choices.map((choice) => {
      const rect = choice.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, clipped: choice.scrollWidth > choice.clientWidth + 1 };
    });
    const mapNodes = [...(map?.querySelectorAll('.grid-node') ?? [])];
    const rightColumn = mapNodes.filter((node) => ['guard_claim_vault', 'upper_auction_portal', 'auction_exit', 'lower_auction_portal', 'return_claim_vault'].includes(node.dataset.action?.replace('grid-', '') ?? ''));
    const pointerHits = rightColumn.map((node) => {
      node.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(hit && node.contains(hit));
    });
    const appContent = document.querySelector('.app-content');
    return {
      viewport: [innerWidth, innerHeight],
      insidePanel: Boolean(fieldset && panel?.contains(fieldset)),
      status: fieldset?.dataset.auctionLotStatus ?? '',
      value: fieldset?.dataset.auctionLotValue ?? '',
      node: fieldset?.dataset.auctionLotNode ?? '',
      choice: fieldset?.dataset.auctionLotChoice ?? '',
      activeChoice: document.activeElement?.getAttribute('data-auction-lot-choice') ?? '',
      rects,
      nodeCount: mapNodes.length,
      columns: map ? getComputedStyle(map).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      minimumNodeWidth: mapNodes.length ? Math.min(...mapNodes.map((node) => node.getBoundingClientRect().width)) : 0,
      rightColumnCount: rightColumn.length,
      pointerHits,
      lockKind: document.querySelector('.route-lock-status')?.dataset.routeLockKind ?? '',
      enabledMoves: document.querySelectorAll('.grid-node.movable:not(:disabled)').length,
      dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
      bodyModal: document.body.classList.contains('modal-open'),
      inert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
      pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
      mapOverflow: Boolean(map && map.scrollWidth > map.clientWidth + 1),
      panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth + 1),
      characterEnabled: Boolean(document.querySelector('.character-trigger:not(:disabled)')),
      taskEnabled: Boolean(document.querySelector('.task-trigger:not(:disabled)')),
      companionEnabled: Boolean(document.querySelector('.companion-trigger:not(:disabled)')),
      methodEnabled: Boolean(document.querySelector('.method-trigger:not(:disabled)')),
      retreatEnabled: [...document.querySelectorAll('button')].some((button) => !button.disabled && button.textContent.includes('撤回主神空间'))
    };
  })()`);
  const assertPendingLayout = async (width, height, label) => {
    const layout = await getPendingLayout();
    const mobileColumns = width !== 390 || layout.rects.every((rect, index) => index === 0 || Math.abs(rect.left - layout.rects[0].left) <= 1 && rect.top >= layout.rects[index - 1].bottom - 1);
    const desktopColumns = width !== 1440 || layout.rects.every((rect) => Math.abs(rect.top - layout.rects[0].top) <= 1 && Math.abs(rect.width - layout.rects[0].width) <= 1);
    if (
      layout.viewport.join('x') !== `${width}x${height}` || !layout.insidePanel || layout.status !== 'pending' || layout.node !== 'force_lot_dais' ||
      layout.choice !== 'pending' || layout.rects.length !== 3 || layout.rects.some((rect) => rect.height < 44 || rect.clipped) || !mobileColumns || !desktopColumns ||
      layout.nodeCount !== 30 || layout.columns !== 6 || layout.minimumNodeWidth < 43.5 || layout.rightColumnCount !== 5 || layout.pointerHits.some((hit) => !hit) ||
      layout.lockKind !== 'auction_lot' || layout.enabledMoves !== 0 || layout.dialogCount !== 0 || layout.bodyModal || layout.inert ||
      layout.pageOverflow || layout.mapOverflow || layout.panelOverflow || !layout.characterEnabled || !layout.taskEnabled || !layout.companionEnabled ||
      !layout.methodEnabled || !layout.retreatEnabled
    ) throw new Error(`${label} should expose a non-modal auction fieldset and a pointer-safe six-column map: ${JSON.stringify(layout)}`);
  };

  await navigateWithState(makeAuctionState({ nodeId: 'force_lot_dais', scrip: 3 }), 'force lot real first-clear fixture renders');
  await setViewport(cdp, 390, 844);
  await clickElementByPointer(cdp, '[data-action="reward-current-force_lot_dais"]');
  await waitForPage(
    cdp,
    `document.querySelector('.auction-lot-fieldset[data-auction-lot-status="pending"][data-auction-lot-node="force_lot_dais"][data-auction-lot-choice="pending"]') &&
      document.activeElement === document.querySelector('button.auction-lot-choice[data-auction-lot-choice="bid"]')`,
    'real first-clear opens the force lot and focuses the first enabled choice'
  );
  await assertPendingLayout(390, 844, '390x844 auction lot');
  await pressEscape(cdp);
  let pending = await getPendingLayout();
  if (pending.status !== 'pending' || pending.activeChoice !== 'bid') throw new Error(`Escape must do nothing to the pending auction fieldset: ${JSON.stringify(pending)}`);
  await openCharacterSheet(cdp, 'pending auction lot');
  await assertEscapeClosesCharacterSheet(cdp, 'pending auction lot');
  await openTaskModal(cdp, 'pending auction lot');
  await assertEscapeClosesTaskModal(cdp, 'pending auction lot');
  for (const [trigger, sheet] of [['.companion-trigger', '.companion-sheet'], ['.method-trigger', '.method-sheet']]) {
    await clickElementByPointer(cdp, trigger);
    await waitForPage(cdp, `document.querySelector(${JSON.stringify(sheet + '[role="dialog"]')})`, `${trigger} opens over pending auction`);
    await pressEscape(cdp);
    await waitForPage(cdp, `!document.querySelector(${JSON.stringify(sheet)}) && document.activeElement === document.querySelector(${JSON.stringify(trigger)}) && document.querySelector('.auction-lot-fieldset[data-auction-lot-status="pending"]')`, `${trigger} Escape closes only its sheet and preserves pending auction`);
  }
  await setViewport(cdp, 1440, 900);
  await assertPendingLayout(1440, 900, '1440x900 auction lot');
  await clickElementByPointer(cdp, 'button.auction-lot-choice[data-auction-lot-choice="bid"]');
  await waitForPage(cdp, `document.querySelector('.auction-lot-result[data-auction-lot-choice="bid"][role="status"][aria-live="polite"]')?.textContent.includes('已落定 1/4') && document.activeElement?.classList.contains('grid-node')`, 'bid resolves, announces exact counts, and focuses a legal adjacent move');
  await waitForPage(cdp, `document.querySelector('[data-route-sector="auction_force_claim"][data-open-gates="2"]')`, 'bid opens the matching force vault');

  const costFixture = (entryPassives = defaultPassives) => makeAuctionState({
    nodeId: 'guard_lot_dais', pendingLotNodeId: 'guard_lot_dais', clearedNodeIds: ['guard_lot_dais'],
    resolvedLotChoices: { force_lot_dais: 'bid' }, entryPassives, scrip: 5
  });
  await navigateWithState(costFixture(), 'dynamic bid cost fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-auction-lot-choice="bid"]')?.textContent.includes('消耗 2 枚遗产筹码')`, 'second bid costs two without matching gear');
  await clickElementByPointer(cdp, '[data-auction-lot-choice="bid"]');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lootBag.items.legacy_scrip === 3`, 'dynamic bid consumes exact run loot');
  await navigateWithState(costFixture({ ...defaultPassives, escrowPlate: true }), 'matching bid discount fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-auction-lot-choice="bid"]')?.textContent.includes('消耗 1 枚遗产筹码')`, 'matching entry gear discounts bid by one with minimum one');
  await clickElementByPointer(cdp, '[data-auction-lot-choice="bid"]');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lootBag.items.legacy_scrip === 4`, 'discounted bid consumes exactly one run scrip');

  await navigateWithState(makeAuctionState({ nodeId: 'art_lot_dais', pendingLotNodeId: 'art_lot_dais', clearedNodeIds: ['art_lot_dais'], scrip: 3 }), 'burn exact-cost fixture renders');
  await clickElementByPointer(cdp, '[data-auction-lot-choice="burn"]');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lootBag.items.legacy_scrip === 2 && document.querySelector('[data-route-sector="auction_art_claim"][data-open-gates="0"]')`, 'burn costs exactly one and permanently closes matching vault');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `!document.querySelector('button.auction-lot-choice') && document.querySelector('[data-route-sector="auction_art_claim"][data-open-gates="0"]')`, 'burn remains one-shot and closed after reload');

  await navigateWithState(makeAuctionState({ nodeId: 'return_lot_dais', pendingLotNodeId: 'return_lot_dais', clearedNodeIds: ['return_lot_dais'], scrip: 3 }), 'fold zero-cost fixture renders');
  await clickElementByPointer(cdp, '[data-auction-lot-choice="fold"]');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lootBag.items.legacy_scrip === 3 && document.querySelector('[data-route-sector="auction_return_claim"][data-open-gates="0"]')`, 'fold costs zero, closes matching vault, and gives the Boss projection');

  const insufficient = makeAuctionState({ nodeId: 'force_lot_dais', pendingLotNodeId: 'force_lot_dais', clearedNodeIds: ['force_lot_dais'], scrip: 0, log: ['auction insufficient fixture'] });
  await navigateWithState(insufficient, 'insufficient scrip fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-auction-lot-choice="bid"]:disabled') && document.querySelector('[data-auction-lot-choice="burn"]:disabled') && document.querySelector('[data-auction-lot-choice="fold"]:not(:disabled)')`, 'insufficient scrip disables paid choices only');
  await evaluate(cdp, `document.querySelector('[data-auction-lot-choice="bid"]').click()`);
  const insufficientAfter = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  if (insufficientAfter.run.lootBag.items.legacy_scrip !== 0 || Object.keys(insufficientAfter.run.lawState.law.resolvedLotChoices).length !== 0 || insufficientAfter.run.lawState.law.pendingLotNodeId !== 'force_lot_dais') {
    throw new Error(`Disabled insufficient bid must not mutate state: ${JSON.stringify(insufficientAfter.run)}`);
  }

  const lotNodes = ['force_lot_dais', 'guard_lot_dais', 'art_lot_dais', 'return_lot_dais'];
  const representativeChoices = ['bid', 'burn', 'fold', 'bid'];
  for (let index = 0; index < lotNodes.length; index += 1) {
    const nodeId = lotNodes[index];
    const choice = representativeChoices[index];
    await navigateWithState(makeAuctionState({ nodeId, pendingLotNodeId: nodeId, clearedNodeIds: [nodeId], scrip: 9 }), `${nodeId} one-shot fixture renders`);
    await clickElementByPointer(cdp, `[data-auction-lot-choice="${choice}"]`);
    await waitForPage(cdp, `document.querySelector('.auction-lot-result[data-auction-lot-node="${nodeId}"][data-auction-lot-choice="${choice}"]') && !document.querySelector('button.auction-lot-choice')`, `${nodeId} resolves exactly once`);
  }

  const representativeCombinations = [
    { force_lot_dais: 'bid', guard_lot_dais: 'bid', art_lot_dais: 'bid', return_lot_dais: 'bid' },
    { force_lot_dais: 'burn', guard_lot_dais: 'burn', art_lot_dais: 'burn', return_lot_dais: 'burn' },
    { force_lot_dais: 'fold', guard_lot_dais: 'bid', art_lot_dais: 'burn', return_lot_dais: 'fold' }
  ];
  for (let index = 0; index < representativeCombinations.length; index += 1) {
    await navigateWithState(makeAuctionState({
      nodeId: 'provenance_event_stage',
      clearedNodeIds: ['provenance_event_stage'],
      resolvedLotChoices: representativeCombinations[index],
      scrip: 12
    }), `representative auction combination ${index + 1}/3 renders`);
    await waitForPage(cdp, `document.querySelector('[data-action="grid-estate_auctioneer"][data-route-gate-status="open"]:not(:disabled)')`, `representative auction combination ${index + 1}/3 reaches the Boss gate`);
  }
  const allCombinationEvidence = await evaluate(cdp, `(async () => {
    const laws = await import('/src/dungeon-laws.ts');
    const routes = await import('/src/dungeon-routes.ts');
    const values = ${JSON.stringify(['bid', 'burn', 'fold'])};
    const failures = [];
    let count = 0;
    for (const force of values) for (const guard of values) for (const art of values) for (const returning of values) {
      count += 1;
      const base = laws.createDungeonLawState('legacy_auction_court');
      const lawState = {
        ...base,
        law: {
          ...base.law,
          pendingLotNodeId: null,
          resolvedLotChoices: { force_lot_dais: force, guard_lot_dais: guard, art_lot_dais: art, return_lot_dais: returning }
        }
      };
      const status = routes.getRouteGateStatus('legacy_auction_court', 'provenance_event_stage', 'estate_auctioneer', lawState);
      if (!status?.isOpen) failures.push({ force, guard, art, returning, status });
    }
    return { count, failures };
  })()`);
  if (allCombinationEvidence.count !== 81 || allCombinationEvidence.failures.length > 0) {
    throw new Error(`All 81 auction combinations must reach the Boss: ${JSON.stringify(allCombinationEvidence)}`);
  }

  const allBid = Object.fromEntries(lotNodes.map((nodeId) => [nodeId, 'bid']));
  await navigateWithState(makeAuctionState({ nodeId: 'estate_auctioneer', resolvedLotChoices: allBid, scrip: 8 }), 'auction Boss snapshot fixture renders');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.bossLotSnapshot?.return_lot_dais === 'bid'`, 'Boss entry freezes all four auction lots');
  const awakenedBoss = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  awakenedBoss.combat.bossPhase = 'awakened';
  awakenedBoss.combat.monsterHp = Math.max(1, awakenedBoss.combat.monsterHp);
  await navigateWithState(awakenedBoss, 'awakened auction Boss save renders');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.bossPhase === 'awakened' && JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.bossLotSnapshot.force_lot_dais === 'bid' && document.querySelector('.combat-panel[data-boss-phase="awakened"]')`, 'auction Boss snapshot and awakening persist through reload');

  const passiveCases = [
    ['force_lot_dais', 'legacyGavel', '亡队落槌', ['全属性 +3%', '全属性 +5%']],
    ['guard_lot_dais', 'escrowPlate', '托管契甲', ['防御 +5%', '防御 +9%']],
    ['art_lot_dais', 'anonymousVeil', '无名竞标面', ['术强 +5%', '术强 +9%']],
    ['return_lot_dais', 'finalLotBell', '终场号钟', ['治疗 -5%', '治疗 -9%']]
  ];
  for (const [nodeId, passiveId, gearName, expectedEffects] of passiveCases) {
    const entryPassives = { ...defaultPassives, [passiveId]: true };
    const priorNodeId = lotNodes.find((candidate) => candidate !== nodeId);
    await navigateWithState(makeAuctionState({ nodeId, pendingLotNodeId: nodeId, clearedNodeIds: [nodeId], resolvedLotChoices: { [priorNodeId]: 'bid' }, entryPassives, scrip: 5 }), `${passiveId} matching price fixture renders`);
    await waitForPage(cdp, `document.querySelector('[data-auction-entry-passive="${passiveId}"][data-frozen="true"]')?.textContent.includes(${JSON.stringify(gearName)}) && document.querySelector('[data-auction-lot-choice="bid"]')?.textContent.includes('消耗 1 枚遗产筹码')`, `${passiveId} affects only matching bid price`);
    await navigateWithState(makeAuctionState({ nodeId: 'estate_gate', resolvedLotChoices: { [nodeId]: 'fold' }, entryPassives, scrip: 5 }), `${passiveId} fold projection fixture renders`);
    const projection = await evaluate(cdp, `document.querySelector('.auction-map-status')?.textContent.replace(/\s+/g, ' ').trim() ?? ''`);
    if (expectedEffects.some((effect) => !projection.includes(effect))) throw new Error(`${passiveId} must halve only matching fold projection: ${projection}`);
  }

  const mutation = makeAuctionState({ nodeId: 'force_lot_dais', pendingLotNodeId: 'force_lot_dais', clearedNodeIds: ['force_lot_dais'], resolvedLotChoices: { guard_lot_dais: 'bid' }, scrip: 5 });
  mutation.ownedEquipment = [...new Set([...mutation.ownedEquipment, 'legacy_gavel'])];
  mutation.equipmentLevels = { ...mutation.equipmentLevels, legacy_gavel: 1 };
  mutation.equipped = { ...mutation.equipped, weapon: 'legacy_gavel' };
  await navigateWithState(mutation, 'mid-run hub equipment mutation fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-auction-entry-passive="legacyGavel"][data-frozen="false"]') && document.querySelector('[data-auction-lot-choice="bid"]')?.textContent.includes('消耗 2 枚遗产筹码')`, 'hub equipment mutation cannot rewrite frozen auction snapshot');

  const indicatorFixture = makeAuctionState({ nodeId: 'provenance_event_stage', scrip: 4 });
  indicatorFixture.run.protocol = { id: 'imprint', rulesVersion: 1 };
  indicatorFixture.run.routeContractState = { rulesVersion: 1, contractId: 'legacy_reserve_recharge', dungeonId: 'legacy_auction_court', completedTargetCount: 0, status: 'active' };
  indicatorFixture.run.equipmentHunt = { rulesVersion: 1, dungeonId: 'legacy_auction_court', targetEquipmentId: 'legacy_gavel', clueNodeIds: ['north_scrip_cache', 'south_scrip_cache'], crossedDungeonPortal: false };
  indicatorFixture.run.pursuitState = { rulesVersion: 1, dungeonId: 'legacy_auction_court', status: 'stalking', nodeId: 'inheritance_mimic_alpha', contacts: 0, graceMoves: 0, rewardGranted: false, repelledReason: null };
  await navigateWithState(indicatorFixture, 'Tier-13 task, protocol, contract, hunt, memory, and pursuit indicators render');
  await waitForPage(cdp, `document.querySelector('.task-trigger') && document.querySelector('[data-run-protocol="imprint"]') && document.querySelector('[data-route-contract-selected="legacy_reserve_recharge"]') && document.querySelector('[data-equipment-hunt-clue-id="north_scrip_cache"]') && document.querySelector('[data-equipment-hunt-clue-id="south_scrip_cache"]') && document.querySelector('.dungeon-events')?.textContent.includes('执槌链来源争议') && document.querySelector('[data-run-pursuit-status="stalking"]') && document.querySelector('[data-pursuit-position="true"]')`, 'Tier-13 operational indicators remain rendered');

  const redactionLaw = { kind: 'redaction_scriptorium', pendingClauseNodeId: null, resolvedClauseChoices: {}, bossClauseSnapshot: null, entryPassives: { redlineEdge: false, palimpsestMantle: false, finalProofSeal: false } };
  const redactionPortals = [['upper_revision_portal', 'estate_gate'], ['lower_revision_portal', 'lower_bid_supply'], ['return_revision_portal', 'archive_survey_gallery']];
  for (const [portalNodeId, expectedTarget] of redactionPortals) {
    await navigateWithState(makeExploreState({ dungeonId: 'redaction_scriptorium', nodeId: portalNodeId, law: redactionLaw, inventory: { gate_sigil: 1 } }), `Tier 12 ${portalNodeId} -> Tier 13 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'legacy_auction_court' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 12 ${portalNodeId} reaches Tier 13`);
  }
  const auctionPortals = [['upper_auction_portal', 'genesis_gate'], ['lower_auction_portal', 'lower_serum_supply'], ['return_auction_portal', 'bloodline_survey_archive']];
  for (const [portalNodeId, expectedTarget] of auctionPortals) {
    await navigateWithState(makeAuctionState({
      nodeId: portalNodeId,
      inventory: { gate_sigil: 1 },
      completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS]
    }), `Tier 13 ${portalNodeId} -> Tier 14 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    try {
      await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'genesis_vault' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 13 ${portalNodeId} reaches Tier 14`);
    } catch (error) {
      const evidence = await evaluate(cdp, `(() => {
        const storageValue = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
        const saved = storageValue === null ? undefined : JSON.parse(storageValue)?.state;
        const run = saved?.run;
        const panel = document.querySelector('.node-action-panel');
        return {
          localStorageIsNull: storageValue === null,
          phase: saved?.phase ?? null,
          gateSigil: saved?.inventory?.gate_sigil ?? null,
          run: run ? {
            keys: Object.keys(run),
            dungeonId: run.dungeonId ?? null,
            currentNodeId: run.currentNodeId ?? null,
            clearedNodeIds: run.clearedNodeIds ?? null,
            law: run.lawState?.law ?? null,
            tacticalLoadout: run.tacticalLoadout ?? null,
            protocol: run.protocol ?? null,
            routeContract: {
              state: run.routeContractState ?? null,
              settlement: run.lastRouteContractSettlement ?? null
            },
            relic: {
              state: run.relicState ?? null,
              conduitSources: run.relicConduitSourceEquipmentIds ?? null,
              settlement: run.lastRelicSettlement ?? null
            },
            pursuit: {
              state: run.pursuitState ?? null,
              settlement: run.lastPursuitSettlement ?? null
            },
            pendingEquipmentOffer: run.pendingEquipmentOffer ?? null
          } : null,
          lastOutcome: saved?.lastOutcome ?? run?.lastOutcome ?? null,
          logTail: Array.isArray(saved?.log) ? saved.log.slice(-5) : null,
          nodeActionPanel: panel ? {
            currentNodeId: panel.dataset.currentNodeId ?? null,
            text: panel.textContent.replace(/\\s+/g, ' ').trim().slice(0, 600),
            buttons: [...panel.querySelectorAll('button')].map((button) => ({
              text: button.textContent.replace(/\\s+/g, ' ').trim(),
              action: button.dataset.action ?? null,
              disabled: button.disabled
            }))
          } : null,
          mapCurrentNodes: [...document.querySelectorAll('.dungeon-map .grid-node.current')].map((node) => ({
            action: node.dataset.action ?? null,
            text: node.textContent.replace(/\\s+/g, ' ').trim().slice(0, 240),
            disabled: node.disabled,
            className: node.className
          }))
        };
      })()`);
      throw new Error(`${error instanceof Error ? error.message : String(error)}; auction portal evidence=${JSON.stringify(evidence)}`);
    }
  }
  const genesisPortals = [['upper_genesis_portal', 'north_entry'], ['lower_genesis_portal', 'lower_entry'], ['return_genesis_portal', 'broadcast_gate']];
  for (const [portalNodeId, expectedTarget] of genesisPortals) {
    await navigateWithState(makeExploreState({
      dungeonId: 'genesis_vault', nodeId: portalNodeId, inventory: { gate_sigil: 1 },
      completedDungeonIds: [...BROADCAST_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...BROADCAST_PRIOR_MAINLINE_TASK_IDS],
      law: { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: [], bossGenomeSnapshot: null, entryGear: {}, entryBloodline: {} }
    }), `Tier 14 ${portalNodeId} -> Tier 15 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    try {
      await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'silent_broadcast_tower' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 14 ${portalNodeId} reaches Tier 15`);
    } catch (error) {
      const evidence = await evaluate(cdp, `(() => {
        const stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
        const saved = stored ? JSON.parse(stored).state : null;
        return {
          stored: Boolean(stored), phase: saved?.phase, inventory: saved?.inventory?.gate_sigil,
          run: saved?.run && { dungeonId: saved.run.dungeonId, currentNodeId: saved.run.currentNodeId, law: saved.run.lawState?.law },
          panel: document.querySelector('.node-action-panel')?.textContent?.replace(/\\s+/g, ' ').trim(),
          errors: ${JSON.stringify('captured separately')}
        };
      })()`);
      throw new Error(`${error instanceof Error ? error.message : String(error)}; Tier-14 portal evidence=${JSON.stringify(evidence)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
  }
  const broadcastLaw = {
    kind: 'silent_broadcast_tower', noise: 0, pendingRelayNodeId: null,
    resolvedRelayChoices: {}, bossNoiseSnapshot: null, firstClashMutedUsed: false,
    entryPassives: { hushblade: false, deadAirHeadset: false, anechoicMantle: false, lastChannelBeacon: false }
  };
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_broadcast_portal', 'shelter_gate']]) {
    await navigateWithState(makeExploreState({
      dungeonId: 'silent_broadcast_tower', nodeId: portalNodeId, inventory: { gate_sigil: 1 }, law: broadcastLaw,
      completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS], claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS]
    }), `Tier 15 ${portalNodeId} -> Tier 16 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'lost_shelter' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 15 ${portalNodeId} reaches Tier 16`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_shelter_portal', 'verdict_gate']]) {
    await navigateWithState(makeLostShelterExploreSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 16 ${portalNodeId} -> Tier 17 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'false_testimony_court' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 16 ${portalNodeId} reaches Tier 17`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'upper_entry'], ['lower_return_portal', 'lower_entry'], ['return_testimony_portal', 'stage_gate']]) {
    await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 17 ${portalNodeId} -> Tier 18 portal renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'combat_replay_stage' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 17 ${portalNodeId} reaches Tier 18`);
  }

  const malformed = makeAuctionState({ nodeId: 'estate_gate', scrip: 2, log: ['auction malformed local recovery'] });
  malformed.rewardPoints = 6543;
  malformed.run.lawState.law = { kind: 'legacy_auction_court', pendingLotNodeId: 'not_a_lot', resolvedLotChoices: { force_lot_dais: 'bid', guard_lot_dais: 'invalid' }, bossLotSnapshot: 'bad', entryPassives: { legacyGavel: true, anonymousVeil: 'yes', escrowPlate: false } };
  await navigateWithState(malformed, 'malformed Tier-13 law recovers locally');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; const law = saved.run.lawState.law; return saved.rewardPoints === 6543 && saved.log[0] === 'auction malformed local recovery' && law.kind === 'legacy_auction_court' && law.pendingLotNodeId === null && law.resolvedLotChoices.force_lot_dais === 'bid' && !('guard_lot_dais' in law.resolvedLotChoices) && law.entryPassives.legacyGavel === true && law.entryPassives.anonymousVeil === false; })()`, 'malformed Tier-13 law normalizes without resetting whole save or inferring passives');

  const legacy = makeAuctionState({ nodeId: 'estate_gate', log: ['auction legacy save recovery'] });
  delete legacy.inventory.legacy_scrip;
  delete legacy.run.lawState;
  await navigateWithState(legacy, 'legacy auction save recovers');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.inventory.legacy_scrip === 0 && saved.run.lawState.law.kind === 'legacy_auction_court' && saved.log[0] === 'auction legacy save recovery'; })()`, 'legacy missing scrip re-saves zero and missing law recovers locally');

  const invalidFixtures = [
    ['unknown scrip ID', (fixture) => { fixture.inventory.unknown_legacy_scrip = 1; }],
    ['negative legacy scrip', (fixture) => { fixture.inventory.legacy_scrip = -1; }],
    ['noninteger legacy scrip', (fixture) => { fixture.inventory.legacy_scrip = 1.5; }],
    ['unknown Tier-13 equipment ID', (fixture) => { fixture.ownedEquipment.push('unknown_auction_equipment'); fixture.equipmentLevels.unknown_auction_equipment = 1; }]
  ];
  for (const [label, mutate] of invalidFixtures) {
    const fixture = makeAuctionState({ nodeId: 'estate_gate', log: [`${label} rejection`] });
    mutate(fixture);
    await navigateWithState(fixture, `${label} fixture falls back`);
    await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, `${label} remains rejected`);
  }

  const restartFixture = makeAuctionState({ nodeId: 'estate_gate', resolvedLotChoices: allBid, scrip: 7 });
  await navigateWithState(restartFixture, 'auction restart and reload fixture renders');
  await cdp.send('Page.reload');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.resolvedLotChoices.return_lot_dais === 'bid' &&
      document.querySelector('.quick-actions [data-action="new-run"]')`,
    'auction state survives reload before restart'
  );
  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[data-auction-lot-status]') && innerWidth === 1440 && innerHeight === 900`, 'real restart clears Tier-13 law and material state');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[role="dialog"][aria-modal="true"]') && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'auction smoke finishes on a clean 1440x900 hub');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404'))) });
  if (browserErrors.length > 0) throw new Error(`Auction smoke should have no browser errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] legacy auction court: 19-card asset pixels, 30-node mobile map, non-modal pointer choices/focus/sheets, exact bid/burn/fold costs and vaults, 81 Boss combinations, frozen passives/snapshot, 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 1 portals, indicators, local save recovery, invalid-ID rejection, and clean 1440x900 restart pass');
}

async function runGenesisVaultPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (nextState, label) => {
    await injectGameState(cdp, nextState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };
  const bloodlineSnapshot = (bloodlineId, aspect, rank) => ({
    rulesVersion: 1,
    bloodlineId,
    aspect,
    rank
  });
  const defaultEntryGear = { helixCleaver: false, symbioteCowl: false, carapaceHarness: false, rebirthAmulet: false };
  const makeGenesisState = ({
    nodeId = 'genesis_gate',
    sequence = [],
    pendingSpliceNodeId = null,
    bossGenomeSnapshot = null,
    clearedNodeIds = [],
    serum = 8,
    runSerum = serum,
    entryGear = defaultEntryGear,
    entryBloodline = { aspect: null, rank: 0 },
    activeBloodline,
    bloodlineRanks = {},
    snapshot,
    inventory = {},
    log = ['genesis vault pointer smoke save']
  } = {}) => {
    const next = makeExploreSave({
      dungeonId: 'genesis_vault',
      nodeId,
      clearedNodeIds,
      rewardPoints: 10000,
      lingyun: 30,
      inventory: { genesis_serum: serum, ...inventory },
      lootBag: makeLootBag({ items: { genesis_serum: runSerum } }),
      completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS],
      bloodlineRanks,
      activeBloodline,
      bloodlineSnapshot: snapshot,
      log
    });
    next.run.lawState = makeDungeonLawState(
      'genesis_vault',
      {
        kind: 'genesis_vault',
        pendingSpliceNodeId,
        spliceSequence: sequence,
        bossGenomeSnapshot,
        entryGear,
        entryBloodline
      },
      { clearedNodeIds }
    );
    return next;
  };
  const makeBloodlineHub = () => {
    const next = makeExploreSave({
      dungeonId: 'demon_tower_1',
      nodeId: 'fog_lesser_demon',
      rewardPoints: 10000,
      lingyun: 20,
      inventory: { genesis_serum: 20 },
      log: ['bloodline hub pointer smoke save']
    });
    next.phase = 'hub';
    next.bloodlineRanks = {};
    delete next.activeBloodline;
    delete next.run;
    return next;
  };
  const makeGenesisPrerequisiteHub = () => {
    const next = makeExploreSave({
      dungeonId: 'genesis_vault',
      nodeId: 'genesis_gate',
      completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS],
      log: ['genesis Tier-14 prerequisite hub smoke save']
    });
    next.phase = 'hub';
    delete next.run;
    return next;
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await setViewport(cdp, 1440, 900);
  await navigateWithState(makeGenesisPrerequisiteHub(), 'genesis Tier-14 prerequisite hub renders');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const genesisCard = document.querySelector('.dungeon-card[data-dungeon-id="genesis_vault"]');
      const prerequisiteCard = document.querySelector('.dungeon-card[data-dungeon-id="legacy_auction_court"]');
      const enterButton = genesisCard?.querySelector('[data-action="enter-genesis_vault"]');
      return saved.phase === 'hub' && !saved.run &&
        saved.completedDungeonIds.join(',') === ${JSON.stringify(GENESIS_PRIOR_DUNGEON_IDS.join(','))} &&
        saved.claimedTaskIds.join(',') === ${JSON.stringify(GENESIS_PRIOR_MAINLINE_TASK_IDS.join(','))} &&
        !saved.completedDungeonIds.includes('genesis_vault') &&
        !saved.claimedTaskIds.includes('mainline_clear_genesis_vault') &&
        prerequisiteCard?.classList.contains('gate-completed') &&
        genesisCard?.classList.contains('gate-available') && enterButton && !enterButton.disabled &&
        genesisCard.querySelector('.genesis-vault-banner')?.complete;
    })()`,
    'genesis smoke starts from legal Tier-14 prerequisite progress'
  );
  const hubAsset = await evaluate(cdp, `(() => {
    const image = document.querySelector('.genesis-vault-banner');
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) return { loaded: false };
    const canvas = document.createElement('canvas');
    canvas.width = 72;
    canvas.height = 18;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add(pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2] + ',' + pixels[index + 3]);
      if (pixels[index + 3] > 0) opaque += 1;
    }
    return { loaded: true, natural: [image.naturalWidth, image.naturalHeight], colors: colors.size, opaque };
  })()`);
  if (!hubAsset.loaded || hubAsset.natural?.join('x') !== '720x180' || hubAsset.colors < 8 || hubAsset.opaque < 500) {
    throw new Error(`Tier-14 visual asset must be a rendered 720x180 scene: ${JSON.stringify(hubAsset)}`);
  }

  await navigateWithState(makeBloodlineHub(), 'bloodline hub fixture renders');
  await clickButtonByPointer(cdp, '血统', '.topbar');
  await waitForPage(
    cdp,
    `document.querySelector('.bloodline-sheet[role="dialog"][aria-modal="true"]') &&
      document.body.classList.contains('modal-open') &&
      document.querySelector('.app-content')?.hasAttribute('inert') &&
      document.activeElement?.classList.contains('bloodline-close') &&
      document.querySelectorAll('.bloodline-card').length === 4`,
    'bloodline modal opens with focus and inert side effects'
  );
  await pressEscape(cdp);
  await waitForPage(
    cdp,
    `!document.querySelector('.bloodline-sheet') && !document.body.classList.contains('modal-open') &&
      !document.querySelector('.app-content')?.hasAttribute('inert') && document.activeElement?.classList.contains('bloodline-trigger')`,
    'bloodline Escape closes and restores trigger focus'
  );
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await setViewport(cdp, width, height);
    await clickButtonByPointer(cdp, '血统', '.topbar');
    await waitForPage(cdp, `document.querySelector('.bloodline-sheet')`, `${width}x${height} bloodline sheet opens`);
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.bloodline-sheet',
      targetSelectors: ['.bloodline-sheet', '.bloodline-card', '.bloodline-rank-effects'],
      buttonSelectors: ['.bloodline-close', '[data-action="unlock-bloodline-titan_marrow"]'],
      minimumButtonHeight: 40,
      checkRootOverflow: true,
      label: `${width}x${height} bloodline sheet`
    });
    await pressEscape(cdp);
  }
  await setViewport(cdp, 1440, 900);
  await clickButtonByPointer(cdp, '血统', '.topbar');
  await clickElementByPointer(cdp, '[data-action="unlock-bloodline-titan_marrow"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.bloodlineRanks.titan_marrow === 1 && saved.activeBloodline === 'titan_marrow' && saved.rewardPoints === 9200 && saved.lingyun === 18 && saved.inventory.genesis_serum === 20; })()`, 'R1 awakening deducts exact non-serum cost and auto-activates first bloodline');
  await clickElementByPointer(cdp, '[data-action="upgrade-bloodline-titan_marrow"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.bloodlineRanks.titan_marrow === 2 && saved.rewardPoints === 8000 && saved.lingyun === 15 && saved.inventory.genesis_serum === 19; })()`, 'R2 deducts exact serum and currency cost');
  await clickElementByPointer(cdp, '[data-action="upgrade-bloodline-titan_marrow"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.bloodlineRanks.titan_marrow === 3 && saved.rewardPoints === 6200 && saved.lingyun === 11 && saved.inventory.genesis_serum === 17 && document.querySelector('[data-bloodline-id="titan_marrow"] [data-action="upgrade-bloodline-titan_marrow"]')?.disabled; })()`, 'R3 deducts exact serum and currency cost and becomes max rank');
  await clickElementByPointer(cdp, '[data-action="unlock-bloodline-void_symbiote"]');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.bloodlineRanks.void_symbiote === 1`, 'second bloodline awakens');
  const beforeSwitch = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  await clickElementByPointer(cdp, '[data-action="activate-bloodline-void_symbiote"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.activeBloodline === 'void_symbiote' && saved.rewardPoints === ${beforeSwitch.rewardPoints} && saved.lingyun === ${beforeSwitch.lingyun} && saved.inventory.genesis_serum === ${beforeSwitch.inventory.genesis_serum} && document.querySelector('[data-bloodline-id="void_symbiote"] [data-action="activate-bloodline-void_symbiote"]')?.disabled; })()`, 'activation switches without paying twice');
  await pressEscape(cdp);

  const entryHub = makeBloodlineHub();
  entryHub.bloodlineRanks = { titan_marrow: 3, void_symbiote: 1 };
  entryHub.activeBloodline = 'titan_marrow';
  await navigateWithState(entryHub, 'bloodline entry snapshot fixture renders');
  await clickElementByPointer(cdp, '[data-action="enter-demon_tower_1"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.bloodlineSnapshot?.bloodlineId === 'titan_marrow' && saved.run.bloodlineSnapshot?.rank === 3 && document.querySelector('.bloodline-trigger')?.textContent.includes('本局 巨灵骨髓 R3'); })()`, 'dungeon entry freezes active bloodline snapshot');
  await evaluate(cdp, `(() => { const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})); payload.state.activeBloodline = 'void_symbiote'; payload.state.bloodlineRanks.void_symbiote = 3; localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload)); return true; })()`);
  await cdp.send('Page.reload');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.activeBloodline === 'void_symbiote' && saved.run.bloodlineSnapshot?.bloodlineId === 'titan_marrow' && saved.run.bloodlineSnapshot?.rank === 3 && document.querySelector('.bloodline-trigger')?.textContent.includes('本局 巨灵骨髓 R3'); })()`, 'run bloodline snapshot stays frozen after hub mutation and reload');
  await clickButtonByPointer(cdp, '血统', '.topbar');
  await waitForPage(cdp, `document.querySelector('[data-frozen-bloodline="titan_marrow"][data-frozen-bloodline-rank="3"]') && [...document.querySelectorAll('.bloodline-card button')].every((button) => button.disabled)`, 'run bloodline modal is read-only');
  await pressEscape(cdp);

  const surgeCases = [
    { id: 'titan_marrow', aspect: 'force', hp: 100, expectedMonsterHp: 82, field: 'bloodlineSurgeUsed', value: true },
    { id: 'void_symbiote', aspect: 'art', hp: 100, expectedMonsterHp: 80, field: 'bloodlineSurgeUsed', value: true },
    { id: 'bastion_chitin', aspect: 'guard', hp: 100, expectedMonsterHp: 100, field: 'bloodlineBarrier', value: 20 },
    { id: 'phoenix_ember', aspect: 'renewal', hp: 100, expectedMonsterHp: 100, field: 'bloodlineSurgeUsed', value: true, playerHp: 40 }
  ];
  for (const [index, surgeCase] of surgeCases.entries()) {
    const snapshot = bloodlineSnapshot(surgeCase.id, surgeCase.aspect, 1);
    const combatState = makeCombatSave({
      dungeonId: 'demon_tower_1', nodeId: 'fog_lesser_demon', monsterId: 'fog_lesser_demon', monsterHp: surgeCase.hp,
      bloodlineRanks: { [surgeCase.id]: 1 }, activeBloodline: surgeCase.id, bloodlineSnapshot: snapshot,
      player: surgeCase.playerHp ? { hp: surgeCase.playerHp, maxHp: 100 } : {},
      combatLog: [`${surgeCase.id} surge smoke`], log: [`${surgeCase.id} surge smoke`]
    });
    await navigateWithState(combatState, `${surgeCase.id} surge fixture renders`);
    const hpBefore = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player.hp`);
    const maxHpBefore = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.player.maxHp`);
    await clickElementByPointer(cdp, '[data-action="use-bloodline-surge"]');
    const expectedPlayerHp = surgeCase.id === 'phoenix_ember'
      ? Math.min(maxHpBefore, hpBefore + Math.ceil(maxHpBefore * 0.12))
      : hpBefore;
    await waitForPage(cdp, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.combat.monsterHp === ${surgeCase.expectedMonsterHp} && saved.player.hp === ${expectedPlayerHp} &&
        saved.combat.${surgeCase.field} === ${JSON.stringify(surgeCase.value)} && saved.combat.bloodlineSurgeUsed === true &&
        document.querySelector('[data-action="use-bloodline-surge"]')?.disabled;
    })()`, `${surgeCase.id} applies representative once-per-battle surge effect`);
    if (index === 0) {
      await cdp.send('Page.reload');
      await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.bloodlineSurgeUsed === true && document.querySelector('[data-action="use-bloodline-surge"]')?.disabled`, 'bloodline surge once-per-battle state persists through reload');
    }
  }

  const legacyHub = makeBloodlineHub();
  delete legacyHub.bloodlineRanks;
  delete legacyHub.inventory.genesis_serum;
  legacyHub.log = ['legacy bloodline save recovery'];
  await navigateWithState(legacyHub, 'legacy bloodline save recovers');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.inventory.genesis_serum === 0 && Object.keys(saved.bloodlineRanks).length === 0 && saved.log[0] === 'legacy bloodline save recovery'; })()`, 'legacy save re-saves empty bloodlines and zero serum');

  const genesisEquipmentIds = ['helix_cleaver', 'symbiote_cowl', 'carapace_harness', 'rebirth_amulet'];
  const validContent = makeBloodlineHub();
  validContent.ownedEquipment = [...validContent.ownedEquipment, ...genesisEquipmentIds];
  validContent.equipmentLevels = { ...validContent.equipmentLevels, ...Object.fromEntries(genesisEquipmentIds.map((id) => [id, 1])) };
  validContent.log = ['strict genesis content validator accepts known ids'];
  await navigateWithState(validContent, 'known Tier-14 equipment IDs pass strict save validation');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return ${JSON.stringify(genesisEquipmentIds)}.every((id) => saved.ownedEquipment.includes(id) && saved.equipmentLevels[id] === 1) && saved.log[0] === 'strict genesis content validator accepts known ids'; })()`, 'all four Tier-14 equipment IDs survive strict validation');
  for (const [nodeId, monsterId] of [['gene_stalker_north', 'gene_stalker'], ['mutation_guardian_north', 'mutation_guardian'], ['primal_curator', 'primal_curator']]) {
    const monsterFixture = makeCombatSave({
      dungeonId: 'genesis_vault', nodeId, monsterId, monsterHp: 100,
      completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS], claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS],
      lawState: makeDungeonLawState('genesis_vault', { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: ['force', 'art', 'guard'], bossGenomeSnapshot: null, entryGear: defaultEntryGear, entryBloodline: { aspect: null, rank: 0 } }),
      log: [`known ${monsterId} validator fixture`]
    });
    await navigateWithState(monsterFixture, `known ${monsterId} combat save passes strict validation`);
    await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.monsterId === '${monsterId}' && document.querySelector('.combat-panel')`, `known ${monsterId} remains loaded`);
  }

  const malformedHub = makeBloodlineHub();
  malformedHub.rewardPoints = 4321;
  malformedHub.bloodlineRanks = { titan_marrow: 4, unknown_lineage: 2, void_symbiote: 2 };
  malformedHub.activeBloodline = 'unknown_lineage';
  malformedHub.log = ['malformed bloodline local recovery'];
  await navigateWithState(malformedHub, 'malformed bloodline progress recovers locally');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.rewardPoints === 4321 && saved.bloodlineRanks.void_symbiote === 2 && Object.keys(saved.bloodlineRanks).length === 1 && saved.activeBloodline === undefined && saved.log[0] === 'malformed bloodline local recovery'; })()`, 'malformed bloodline rank and active fields are filtered without resetting save');

  const malformedLaw = makeGenesisState({ nodeId: 'genesis_gate', log: ['malformed genesis law local recovery'] });
  malformedLaw.rewardPoints = 4567;
  malformedLaw.run.lawState.law = {
    kind: 'genesis_vault', pendingSpliceNodeId: 'not_a_console', spliceSequence: ['force', 'unknown_gene'],
    bossGenomeSnapshot: ['force', 'bad', 'guard'], entryGear: { helixCleaver: true, symbioteCowl: 'yes' },
    entryBloodline: { aspect: 'force', rank: 9 }
  };
  malformedLaw.run.lawState.clearedNodeIds = ['first_splice_console'];
  await navigateWithState(malformedLaw, 'malformed genesis law recovers locally');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; const law = saved.run.lawState.law; return saved.rewardPoints === 4567 && saved.log[0] === 'malformed genesis law local recovery' && law.kind === 'genesis_vault' && law.spliceSequence.join(',') === 'force' && law.pendingSpliceNodeId === null && law.bossGenomeSnapshot === null && law.entryGear.helixCleaver === true && law.entryGear.symbioteCowl === false && law.entryBloodline.aspect === null && law.entryBloodline.rank === 0; })()`, 'malformed genesis law normalizes without resetting whole save');

  const legacyRun = makeGenesisState({ nodeId: 'genesis_gate', log: ['legacy genesis run recovery'] });
  delete legacyRun.inventory.genesis_serum;
  delete legacyRun.run.lawState;
  await navigateWithState(legacyRun, 'legacy genesis run recovers');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.inventory.genesis_serum === 0 && saved.run.lawState.law.kind === 'genesis_vault' && saved.run.lawState.law.spliceSequence.length === 0 && saved.log[0] === 'legacy genesis run recovery'; })()`, 'legacy genesis run restores empty law and zero serum locally');

  const malformedRun = makeCombatSave({
    dungeonId: 'demon_tower_1', nodeId: 'fog_lesser_demon', monsterId: 'fog_lesser_demon', monsterHp: 40,
    bloodlineSnapshot: bloodlineSnapshot('titan_marrow', 'force', 1), bloodlineSurgeUsed: false, bloodlineBarrier: 999,
    rewardPoints: 3456, log: ['malformed run bloodline recovery']
  });
  malformedRun.run.bloodlineSnapshot.aspect = 'art';
  await navigateWithState(malformedRun, 'malformed run bloodline snapshot recovers locally');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.rewardPoints === 3456 && saved.run.bloodlineSnapshot === undefined && saved.combat.bloodlineSurgeUsed === undefined && saved.combat.bloodlineBarrier === undefined && document.querySelector('[data-bloodline-surge="legacy_disabled"]'); })()`, 'malformed run snapshot disables only this run and clears combat bloodline fields');

  const clampedCombat = makeCombatSave({
    dungeonId: 'demon_tower_1', nodeId: 'fog_lesser_demon', monsterId: 'fog_lesser_demon', monsterHp: 40,
    bloodlineSnapshot: bloodlineSnapshot('bastion_chitin', 'guard', 1), bloodlineBarrier: 999.8,
    log: ['clamped bloodline combat recovery']
  });
  delete clampedCombat.combat.bloodlineSurgeUsed;
  await navigateWithState(clampedCombat, 'clamped combat bloodline fields recover');
  await waitForPage(cdp, `(() => { const combat = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat; return combat.bloodlineSurgeUsed === false && combat.bloodlineBarrier === 50; })()`, 'valid snapshot defaults surge-used and clamps finite barrier');

  const invalidGenesisFixtures = [
    ['unknown genesis inventory ID', (fixture) => { fixture.inventory.unknown_genesis_serum = 1; }],
    ['unknown Tier-14 equipment ID', (fixture) => { fixture.ownedEquipment.push('unknown_genesis_equipment'); fixture.equipmentLevels.unknown_genesis_equipment = 1; }],
    ['unknown Tier-14 dungeon ID', (fixture) => { fixture.run.dungeonId = 'unknown_genesis_vault'; }],
    ['unknown Tier-14 monster ID', (fixture) => { fixture.combat.monsterId = 'unknown_genesis_monster'; }]
  ];
  for (const [label, mutate] of invalidGenesisFixtures) {
    const fixture = makeCombatSave({
      dungeonId: 'genesis_vault', nodeId: 'gene_stalker_north', monsterId: 'gene_stalker', monsterHp: 100,
      lawState: makeDungeonLawState('genesis_vault', { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: [], bossGenomeSnapshot: null, entryGear: defaultEntryGear, entryBloodline: { aspect: null, rank: 0 } }),
      log: [`${label} rejection`]
    });
    mutate(fixture);
    await assertInjectedSaveResets(cdp, appUrl, fixture, `${label} rejection`, label);
  }

  const consoleCases = [
    { nodeId: 'first_splice_console', startNodeId: 'sample_corridor_guard', sequence: [], cleared: ['sample_corridor_guard'], cost: 0 },
    { nodeId: 'second_splice_console', startNodeId: 'mutation_guardian_north', sequence: ['force'], cleared: ['mutation_guardian_north', 'first_splice_console'], cost: 1 },
    { nodeId: 'third_splice_console', startNodeId: 'lower_serum_supply', sequence: ['force', 'force'], cleared: ['lower_serum_supply', 'first_splice_console', 'second_splice_console'], cost: 2 }
  ];
  for (const consoleCase of consoleCases) {
    const fixture = makeGenesisState({
      nodeId: consoleCase.startNodeId,
      sequence: consoleCase.sequence,
      pendingSpliceNodeId: null,
      clearedNodeIds: consoleCase.cleared,
      serum: 5,
      runSerum: 5
    });
    await navigateWithState(fixture, `${consoleCase.nodeId} unresolved console renders`);
    try {
      await waitForPage(cdp, `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.state;
        const targetButtons = [...document.querySelectorAll('[data-action="grid-${consoleCase.nodeId}"]')];
        return saved?.run?.currentNodeId === '${consoleCase.startNodeId}' &&
          saved.run.lawState?.law?.kind === 'genesis_vault' &&
          saved.run.lawState.law.pendingSpliceNodeId === null &&
          saved.run.lawState.law.spliceSequence.join(',') === '${consoleCase.sequence.join(',')}' &&
          saved.run.clearedNodeIds.join(',') === '${consoleCase.cleared.join(',')}' &&
          saved.log[0] === 'genesis vault pointer smoke save' &&
          targetButtons.length === 1 && !targetButtons[0].disabled &&
          !document.querySelector('.genesis-splice-fieldset');
      })()`, `${consoleCase.nodeId} adjacent fixture survives validation with one enabled target grid action`);
    } catch (error) {
      const evidence = await evaluate(cdp, `(() => {
        const storageValue = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
        const saved = storageValue === null ? undefined : JSON.parse(storageValue)?.state;
        const fieldset = document.querySelector('.genesis-splice-fieldset');
        return {
          localStorageIsNull: storageValue === null,
          phase: saved?.phase,
          currentNodeId: saved?.run?.currentNodeId,
          clearedNodeIds: saved?.run?.clearedNodeIds,
          law: saved?.run?.lawState?.law,
          log: saved?.log,
          nodeActionButtons: [...document.querySelectorAll('.node-action-panel button')].map((button) => ({
            text: button.textContent.replace(/\\s+/g, ' ').trim(),
            action: button.dataset.action,
            disabled: button.disabled
          })),
          targetGridButtons: [...document.querySelectorAll('[data-action="grid-${consoleCase.nodeId}"]')].map((button) => ({
            action: button.dataset.action,
            disabled: button.disabled,
            className: button.className
          })),
          fieldset: fieldset ? {
            console: fieldset.dataset.genesisConsole,
            serum: fieldset.dataset.genesisSerum,
            text: fieldset.textContent.replace(/\\s+/g, ' ').trim()
          } : null
        };
      })()`);
      throw new Error(`${error instanceof Error ? error.message : String(error)}; pre-action evidence=${JSON.stringify(evidence)}`);
    }
    await clickElementByPointer(cdp, `[data-action="grid-${consoleCase.nodeId}"]`);
    await waitForPage(cdp, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.state;
      const rewardButtons = [...document.querySelectorAll('.node-action-panel button')].filter((button) => button.textContent.includes('收取奖励'));
      return saved?.run?.currentNodeId === '${consoleCase.nodeId}' &&
        document.querySelector('.grid-node.current[data-action="grid-${consoleCase.nodeId}"]') &&
        rewardButtons.length === 1 && !rewardButtons[0].disabled &&
        !document.querySelector('.genesis-splice-fieldset');
    })()`, `${consoleCase.nodeId} real grid movement reaches one enabled reward action`);
    await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
    try {
      await waitForPage(cdp, `document.querySelector('.genesis-splice-fieldset[data-genesis-console="${consoleCase.nodeId}"] [data-genesis-gene="force"][data-serum-cost="${consoleCase.cost}"]') && !document.querySelector('[role="dialog"][aria-modal="true"]')`, `${consoleCase.nodeId} shows exact discounted serum cost in non-modal fieldset`);
    } catch (error) {
      const evidence = await evaluate(cdp, `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.state;
        const fieldset = document.querySelector('.genesis-splice-fieldset');
        return {
          currentNodeId: saved?.run?.currentNodeId,
          law: saved?.run?.lawState?.law,
          fieldset: fieldset ? {
            console: fieldset.dataset.genesisConsole,
            serum: fieldset.dataset.genesisSerum,
            modalAncestor: Boolean(fieldset.closest('[role="dialog"][aria-modal="true"]'))
          } : null,
          choices: [...document.querySelectorAll('[data-genesis-gene]')].map((button) => ({
            gene: button.dataset.genesisGene,
            serumCost: button.dataset.serumCost,
            disabled: button.disabled,
            text: button.textContent.replace(/\\s+/g, ' ').trim()
          }))
        };
      })()`);
      throw new Error(`${error instanceof Error ? error.message : String(error)}; DOM evidence=${JSON.stringify(evidence)}`);
    }
    await clickElementByPointer(cdp, '[data-genesis-gene="force"]');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return !document.querySelector('.genesis-splice-fieldset') && saved.run.lawState.law.spliceSequence.length === ${consoleCase.sequence.length + 1} && saved.inventory.genesis_serum === ${6 - consoleCase.cost} && saved.run.lootBag.items.genesis_serum === ${6 - consoleCase.cost}; })()`, `${consoleCase.nodeId} deducts exact run serum and clears pending state`);
  }

  await navigateWithState(makeGenesisState({
    nodeId: 'second_splice_console', sequence: ['force'], pendingSpliceNodeId: 'second_splice_console',
    clearedNodeIds: ['first_splice_console', 'second_splice_console'], serum: 3, runSerum: 3,
    entryGear: { ...defaultEntryGear, helixCleaver: true }
  }), 'matching entry gear discount fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-genesis-gene="force"][data-serum-cost="0"]:not(:disabled)')`, 'matching frozen equipment reduces displayed repeat-gene cost');

  const bankOnly = makeGenesisState({
    nodeId: 'second_splice_console', sequence: ['force'], pendingSpliceNodeId: 'second_splice_console',
    clearedNodeIds: ['first_splice_console', 'second_splice_console'], serum: 8, runSerum: 0
  });
  await navigateWithState(bankOnly, 'bank-only serum fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-genesis-gene="force"]')?.disabled && document.querySelector('[data-genesis-gene="force"]')?.textContent.includes('当前仅有 0 支') && document.querySelector('[data-genesis-serum="0"]')`, 'bank serum cannot pay when run bag has none');

  const representativeChoices = [
    { nodeId: 'first_splice_console', sequence: [], gene: 'force', cleared: ['first_splice_console'] },
    { nodeId: 'second_splice_console', sequence: ['force'], gene: 'art', cleared: ['first_splice_console', 'second_splice_console'] },
    { nodeId: 'third_splice_console', sequence: ['force', 'art'], gene: 'guard', cleared: ['first_splice_console', 'second_splice_console', 'third_splice_console'] }
  ];
  for (const choice of representativeChoices) {
    await navigateWithState(makeGenesisState({ nodeId: choice.nodeId, sequence: choice.sequence, pendingSpliceNodeId: choice.nodeId, clearedNodeIds: choice.cleared }), `${choice.gene} representative button fixture renders`);
    await clickElementByPointer(cdp, `[data-genesis-gene="${choice.gene}"]`);
    await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.spliceSequence.at(-1) === '${choice.gene}'`, `${choice.gene} representative choice uses real page button`);
  }

  const genes = ['force', 'art', 'guard', 'renewal'];
  for (const first of genes) {
    for (const second of genes) {
      for (const third of genes) {
        const sequence = [first, second, third];
        await navigateWithState(makeGenesisState({
          nodeId: 'genesis_gate', sequence, clearedNodeIds: ['first_splice_console', 'second_splice_console', 'third_splice_console']
        }), `genesis route matrix ${sequence.join('-')} renders`);
        const sectors = await evaluate(cdp, `Object.fromEntries([...document.querySelectorAll('[data-route-sector]')].map((sector) => [sector.dataset.routeSector, sector.dataset.routeSectorStatus]))`);
        const counts = Object.fromEntries(genes.map((gene) => [gene, sequence.filter((candidate) => candidate === gene).length]));
        const expected = {
          genesis_force_vault: counts.force >= 2 ? 'open' : 'closed',
          genesis_art_vault: counts.art >= 2 ? 'open' : 'closed',
          genesis_guard_vault: counts.guard >= 2 ? 'open' : 'closed',
          genesis_renewal_vault: counts.renewal >= 2 ? 'open' : 'closed',
          genesis_mosaic_vault: new Set(sequence).size === 3 ? 'open' : 'closed',
          genesis_boss_approaches: 'open'
        };
        for (const [sectorId, status] of Object.entries(expected)) {
          if (sectors[sectorId] !== status) {
            throw new Error(`Genesis route matrix ${sequence.join('/')} expected ${sectorId}=${status}, got ${JSON.stringify(sectors)}`);
          }
        }
      }
    }
  }

  await navigateWithState(makeGenesisState({
    nodeId: 'force_sample_gallery', sequence: ['art', 'guard', 'renewal'], clearedNodeIds: ['first_splice_console', 'second_splice_console', 'third_splice_console', 'force_sample_gallery']
  }), 'specialization and mosaic lock fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-route-gate-id="genesis_force_gallery_vault"][data-route-gate-status="closed"]') && document.querySelector('[data-route-sector="genesis_mosaic_vault"][data-route-sector-status="open"]')`, 'specialization stays locked while three-unique mosaic route opens');

  await navigateWithState(makeGenesisState({
    nodeId: 'mosaic_gene_vault', sequence: ['force', 'art', 'guard'], clearedNodeIds: ['first_splice_console', 'second_splice_console', 'third_splice_console', 'mosaic_gene_vault'],
    activeBloodline: 'titan_marrow', bloodlineRanks: { titan_marrow: 3 }, snapshot: bloodlineSnapshot('titan_marrow', 'force', 3)
  }), 'genesis Boss reachability fixture renders');
  await waitForPage(cdp, `(() => { const targets = [...document.querySelectorAll('[data-action="grid-primal_curator"]')]; return targets.length === 1 && !targets[0].disabled; })()`, 'Boss grid selector resolves to one enabled target');
  await clickElementByPointer(cdp, '[data-action="grid-primal_curator"]');
  await waitForPage(cdp, `(() => { const targets = [...document.querySelectorAll('[data-action="fight-current-primal_curator"]')]; return targets.length === 1 && !targets[0].disabled; })()`, 'Boss is reachable through one enabled fight action after a complete mosaic sequence');
  await clickElementByPointer(cdp, '[data-action="fight-current-primal_curator"]');
  try {
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.phase === 'combat' && saved.run.lawState.law.bossGenomeSnapshot?.join(',') === 'force,art,guard' && document.querySelector('[data-genesis-boss-frozen="true"]'); })()`, 'Boss entry freezes the complete genome snapshot');
  } catch (error) {
    const evidence = await evaluate(cdp, `(() => {
      const storageValue = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = storageValue === null ? undefined : JSON.parse(storageValue)?.state;
      const combatPanel = document.querySelector('.combat-panel');
      return {
        localStorageIsNull: storageValue === null,
        phase: saved?.phase ?? null,
        currentNodeId: saved?.run?.currentNodeId ?? null,
        combat: saved?.combat ? {
          nodeId: saved.combat.nodeId ?? null,
          monsterId: saved.combat.monsterId ?? null,
          phase: saved.combat.phase ?? null,
          bossPhase: saved.combat.bossPhase ?? null
        } : null,
        law: saved?.run?.lawState?.law ?? null,
        frozenElements: [...document.querySelectorAll('[data-genesis-boss-frozen]')].map((element) => ({
          tag: element.tagName.toLowerCase(),
          attr: element.getAttribute('data-genesis-boss-frozen'),
          text: element.textContent.replace(/\\s+/g, ' ').trim()
        })),
        combatPanel: {
          exists: Boolean(combatPanel),
          text: combatPanel?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 600) ?? ''
        }
      };
    })()`);
    throw new Error(`${error instanceof Error ? error.message : String(error)}; Boss evidence=${JSON.stringify(evidence)}`);
  }
  await cdp.send('Page.reload');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.bossGenomeSnapshot?.join(',') === 'force,art,guard' && document.querySelector('[data-genesis-boss-frozen="true"]')`, 'Boss genome snapshot survives reload');

  const auctionLaw = { kind: 'legacy_auction_court', pendingLotNodeId: null, resolvedLotChoices: {}, bossLotSnapshot: null, entryPassives: { legacyGavel: false, anonymousVeil: false, escrowPlate: false, finalLotBell: false } };
  for (const [portalNodeId, expectedTarget] of [['upper_auction_portal', 'genesis_gate'], ['lower_auction_portal', 'lower_serum_supply'], ['return_auction_portal', 'bloodline_survey_archive']]) {
    const portalState = makeExploreSave({
      dungeonId: 'legacy_auction_court', nodeId: portalNodeId, inventory: { gate_sigil: 1 },
      completedDungeonIds: [...GENESIS_PRIOR_DUNGEON_IDS], claimedTaskIds: [...GENESIS_PRIOR_MAINLINE_TASK_IDS]
    });
    portalState.run.lawState = makeDungeonLawState('legacy_auction_court', auctionLaw);
    await navigateWithState(portalState, `Tier 13 ${portalNodeId} -> Tier 14 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'genesis_vault' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 13 ${portalNodeId} reaches Tier 14 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_genesis_portal', 'north_entry'], ['lower_genesis_portal', 'lower_entry'], ['return_genesis_portal', 'broadcast_gate']]) {
    const portalState = makeGenesisState({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } });
    portalState.completedDungeonIds = [...BROADCAST_PRIOR_DUNGEON_IDS];
    portalState.claimedTaskIds = [...BROADCAST_PRIOR_MAINLINE_TASK_IDS];
    await navigateWithState(portalState, `Tier 14 ${portalNodeId} -> Tier 15 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'silent_broadcast_tower' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 14 ${portalNodeId} reaches Tier 15 ${expectedTarget}`);
  }
  const broadcastLaw = {
    kind: 'silent_broadcast_tower', noise: 0, pendingRelayNodeId: null,
    resolvedRelayChoices: {}, bossNoiseSnapshot: null, firstClashMutedUsed: false,
    entryPassives: { hushblade: false, deadAirHeadset: false, anechoicMantle: false, lastChannelBeacon: false }
  };
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_broadcast_portal', 'shelter_gate']]) {
    const next = makeExploreSave({
      dungeonId: 'silent_broadcast_tower', nodeId: portalNodeId, inventory: { gate_sigil: 1 },
      completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS], claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS]
    });
    next.run.lawState = makeDungeonLawState('silent_broadcast_tower', broadcastLaw);
    await navigateWithState(next, `Tier 15 ${portalNodeId} -> Tier 16 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'lost_shelter' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 15 ${portalNodeId} reaches Tier 16 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_shelter_portal', 'verdict_gate']]) {
    await navigateWithState(makeLostShelterExploreSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 16 ${portalNodeId} -> Tier 17 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'false_testimony_court' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 16 ${portalNodeId} reaches Tier 17 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'upper_entry'], ['lower_return_portal', 'lower_entry'], ['return_testimony_portal', 'stage_gate']]) {
    await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 17 ${portalNodeId} -> Tier 18 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'combat_replay_stage' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 17 ${portalNodeId} reaches Tier 18 ${expectedTarget}`);
  }

  await navigateWithState(makeGenesisState({ nodeId: 'genesis_gate' }), 'responsive genesis map fixture renders');
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.dungeon-map[data-dungeon-id="genesis_vault"]',
      targetSelectors: ['.dungeon-map[data-dungeon-id="genesis_vault"]', '.genesis-map-status', '.node-action-panel'],
      buttonSelectors: ['.dungeon-map[data-dungeon-id="genesis_vault"] .grid-node:not(:disabled)'],
      minimumButtonHeight: 40,
      checkRootOverflow: true,
      label: `${width}x${height} Tier-14 map`
    });
    const mapGeometry = await evaluate(cdp, `(() => {
      const pageWidth = document.documentElement.clientWidth;
      const nodes = [...document.querySelectorAll('.dungeon-map[data-dungeon-id="genesis_vault"] .grid-node')];
      const records = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          action: node.dataset.action ?? '',
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
          width: rect.width,
          height: rect.height,
          textOverflow: node.scrollWidth > node.clientWidth + 1
        };
      });
      const overlaps = [];
      for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
          const left = records[leftIndex];
          const right = records[rightIndex];
          const overlapWidth = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
          const overlapHeight = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
          if (overlapWidth > 1 && overlapHeight > 1) overlaps.push([left.action, right.action]);
        }
      }
      return {
        nodeCount: records.length,
        invalidSizes: records.filter((node) => node.width <= 0 || node.height < 40).map((node) => ({ action: node.action, width: node.width, height: node.height })),
        outOfBounds: records.filter((node) => node.rect.left < -1 || node.rect.right > pageWidth + 1).map((node) => ({ action: node.action, left: node.rect.left, right: node.rect.right, pageWidth })),
        textOverflow: records.filter((node) => node.textOverflow).map((node) => node.action),
        overlaps
      };
    })()`);
    if (
      mapGeometry.nodeCount !== 30 ||
      mapGeometry.invalidSizes.length > 0 ||
      mapGeometry.outOfBounds.length > 0 ||
      mapGeometry.textOverflow.length > 0 ||
      mapGeometry.overlaps.length > 0
    ) {
      throw new Error(`Tier-14 map should render 30 stable, bounded, non-overlapping nodes at ${width}x${height}: ${JSON.stringify(mapGeometry)}`);
    }
  }

  const restartFixture = makeGenesisState({
    nodeId: 'genesis_gate', sequence: ['force', 'force', 'force'], clearedNodeIds: ['first_splice_console', 'second_splice_console', 'third_splice_console'],
    activeBloodline: 'titan_marrow', bloodlineRanks: { titan_marrow: 3 }, snapshot: bloodlineSnapshot('titan_marrow', 'force', 3), serum: 9, runSerum: 7
  });
  await navigateWithState(restartFixture, 'genesis restart fixture renders');
  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && document.querySelector('.bloodline-trigger')?.textContent.includes('0/4 已觉醒') && !document.querySelector('.genesis-map-status') && innerWidth === 1440 && innerHeight === 900`, 'new game clears all Tier-14 and bloodline state');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[role="dialog"][aria-modal="true"]') && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'genesis smoke restores clean 1440x900 home');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(
    event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
  )) });
  if (browserErrors.length > 0) throw new Error(`Genesis smoke should have no browser/resource/page errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] genesis vault: bloodline costs/activation/freeze, four once-per-battle surges and barrier reload, save recovery, 19-card asset, 30-node responsive map, three real consoles, 64 law-route sequences, Boss freeze, 13 -> 14 -> 15 -> 16 -> 17 -> 1 portals, and clean restart');
}

async function assertCompanionModalLayout(cdp, width, height, label) {
  await setViewport(cdp, width, height);
  await clickButtonByPointer(cdp, '小队', '.topbar');
  await waitForPage(cdp, `document.querySelector('.companion-sheet[role="dialog"]')`, `${label} companion modal opens`);
  const layout = await evaluate(
    cdp,
    `(() => {
      const sheet = document.querySelector('.companion-sheet');
      const cards = [...document.querySelectorAll('.companion-card')];
      const compactText = (element) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!sheet) throw new Error('Missing companion sheet');
      const sheetRect = sheet.getBoundingClientRect();
      const buttonHits = [...sheet.querySelectorAll('button')].map((button) => {
        button.scrollIntoView({ block: 'center', inline: 'nearest' });
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          action: button.dataset.action,
          width: rect.width,
          height: rect.height,
          pointerTarget: Boolean(hit && button.contains(hit)),
          insideViewport: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1
        };
      });
      return {
        viewport: [innerWidth, innerHeight],
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        sheetInsideViewport: sheetRect.left >= -1 && sheetRect.right <= innerWidth + 1 && sheetRect.top >= -1 && sheetRect.bottom <= innerHeight + 1,
        sheetFits: sheet.scrollWidth <= sheet.clientWidth + 1,
        cardCount: cards.length,
        cardsFit: cards.every((card) => card.scrollWidth <= card.clientWidth + 1),
        costsComplete: cards.every((card) => {
          const text = compactText(card);
          return text.includes('招募') && text.includes('R2 晋升') && text.includes('R3 晋升');
        }),
        assistRanksComplete: cards.every((card) =>
          ['R1', 'R2', 'R3'].every((rank) => compactText(card.querySelector('.companion-rank-effects')).includes(rank))
        ),
        guardingCopyExact: compactText(document.querySelector('[data-companion-id="qin_che"]')).includes('下一次敌方反击前进入守势'),
        buttonHits
      };
    })()`
  );
  if (
    layout.viewport[0] !== width ||
    layout.viewport[1] !== height ||
    layout.pageScrollWidth > layout.pageClientWidth + 1 ||
    !layout.sheetInsideViewport ||
    !layout.sheetFits ||
    layout.cardCount !== 3 ||
    !layout.cardsFit ||
    !layout.costsComplete ||
    !layout.assistRanksComplete ||
    !layout.guardingCopyExact ||
    layout.buttonHits.some((button) => button.height < 41.5 || !button.insideViewport || !button.pointerTarget)
  ) {
    throw new Error(`${label} companion modal should fit without overlap: ${JSON.stringify(layout)}`);
  }
  await clickDialogButton(cdp, '关闭');
  await waitForPage(cdp, `!document.querySelector('.companion-sheet')`, `${label} companion modal closes`);
}

async function assertMethodModalLayout(cdp, width, height, label) {
  await setViewport(cdp, width, height);
  await clickButtonByPointer(cdp, '功法', '.topbar');
  await waitForPage(cdp, `document.querySelector('.method-sheet[role="dialog"]')`, `${label} method sheet opens`);
  const layout = await evaluate(
    cdp,
    `(() => {
      const sheet = document.querySelector('.method-sheet');
      const cards = [...document.querySelectorAll('.method-card')];
      const compactText = (element) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!sheet) throw new Error('Missing method sheet');
      const sheetRect = sheet.getBoundingClientRect();
      const buttonHits = [...sheet.querySelectorAll('button')].map((button) => {
        button.scrollIntoView({ block: 'center', inline: 'nearest' });
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          height: rect.height,
          insideViewport: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
          pointerTarget: Boolean(hit && button.contains(hit))
        };
      });
      return {
        viewport: [innerWidth, innerHeight],
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        sheetWidth: sheetRect.width,
        sheetInsideViewport: sheetRect.left >= -1 && sheetRect.right <= innerWidth + 1 && sheetRect.top >= -1 && sheetRect.bottom <= innerHeight + 1,
        sheetFits: sheet.scrollWidth <= sheet.clientWidth + 1,
        cardCount: cards.length,
        cardsFit: cards.every((card) => card.scrollWidth <= card.clientWidth + 1),
        costsComplete: cards.every((card) => ['学习', 'R2 晋升', 'R3 晋升'].every((label) => compactText(card).includes(label))),
        ranksComplete: cards.every((card) => ['R1', 'R2', 'R3'].every((rank) => compactText(card.querySelector('.method-rank-effects')).includes(rank))),
        techniqueNamesComplete: ['归息', '镇岳', '踏隙', '定门', '纳星', '护主', '空明'].every((name) => compactText(sheet).includes(name)),
        mobileActionColumns: cards.map((card) => {
          const row = card.querySelector('.method-card-footer .button-row');
          return row ? getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
        }),
        buttonHits
      };
    })()`
  );
  if (
    layout.viewport[0] !== width ||
    layout.viewport[1] !== height ||
    layout.pageOverflow ||
    !layout.sheetInsideViewport ||
    !layout.sheetFits ||
    layout.sheetWidth > 761 ||
    (width === 390 && layout.sheetWidth > 371) ||
    layout.cardCount !== 7 ||
    !layout.cardsFit ||
    !layout.costsComplete ||
    !layout.ranksComplete ||
    !layout.techniqueNamesComplete ||
    (width <= 760 && layout.mobileActionColumns.some((columns) => columns !== 1)) ||
    layout.buttonHits.some((button) => button.height < 41.5 || !button.insideViewport || !button.pointerTarget)
  ) {
    throw new Error(`${label} method sheet should fit without overlap: ${JSON.stringify(layout)}`);
  }
  await clickDialogButton(cdp, '关闭');
  await waitForPage(cdp, `!document.querySelector('.method-sheet')`, `${label} method sheet closes`);
}

async function runMethodCultivationSmoke(cdp, appUrl) {
  await injectGameState(cdp, makeMethodHubSave());
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.method-trigger')?.textContent.includes('1/7 已学会') &&
      !document.querySelector('.shop-section [data-method-id]') && innerWidth === 1440 && innerHeight === 900`,
    'funded cultivation hub restores without inline method cards'
  );
  await assertMethodModalLayout(cdp, 1440, 900, '1440x900 cultivation roster');

  await clickButtonByPointer(cdp, '功法', '.topbar');
  await clickCardButtonByPointer(cdp, '.method-card', '吐纳诀', '学习');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const card = document.querySelector('[data-method-id="mist_breathing"]');
      return saved.learnedMethods.includes('mist_breathing') && saved.methodRanks.mist_breathing === 1 &&
        saved.activeMethod === 'mist_breathing' && card?.dataset.methodLearned === 'true' && card?.dataset.methodActive === 'true';
    })()`,
    'pointer learning sets R1 and auto-activates the first newly selected method'
  );
  await clickCardButtonByPointer(cdp, '.method-card', '吐纳诀', '晋升 R2');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.methodRanks.mist_breathing === 2`, 'pointer R2 upgrade');
  await clickCardButtonByPointer(cdp, '.method-card', '吐纳诀', '晋升 R3');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.methodRanks.mist_breathing === 3`, 'pointer R3 upgrade');
  await clickCardButtonByPointer(cdp, '.method-card', '铁衣诀', '设为常用');
  await waitForPage(
    cdp,
    `document.querySelector('[data-method-id="iron_body"]')?.dataset.methodActive === 'true' &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.activeMethod === 'iron_body'`,
    'pointer activation selects Iron Body'
  );
  const upgraded = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return { rewardPoints: saved.rewardPoints, lingyun: saved.lingyun, methodPage: saved.inventory.method_page, rank: saved.methodRanks.mist_breathing, active: saved.activeMethod };
    })()`
  );
  if (upgraded.rewardPoints !== 8520 || upgraded.lingyun !== 17 || upgraded.methodPage !== 17 || upgraded.rank !== 3 || upgraded.active !== 'iron_body') {
    throw new Error(`Cultivation actions should deduct exact learn/R2/R3 costs: ${JSON.stringify(upgraded)}`);
  }
  await clickDialogButton(cdp, '关闭');
  await assertMethodModalLayout(cdp, 390, 844, '390x844 populated cultivation roster');

  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '准备进入');
  await waitForPage(cdp, `document.querySelector('.protocol-sheet[role="dialog"]')`, 'method dungeon preparation opens');
  await clickDialogButton(cdp, '进入普通');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const expectedSnapshots = [
        { rulesVersion: 1, methodId: 'iron_body', rank: 1 },
        { rulesVersion: 1, methodId: 'mist_breathing', rank: 3 }
      ];
      return saved.phase === 'explore' && saved.run?.methodSnapshot?.methodId === 'iron_body' &&
        saved.run?.methodSnapshot?.rank === 1 &&
        JSON.stringify(saved.run?.methodSnapshots) === JSON.stringify(expectedSnapshots) &&
        document.querySelector('[data-run-method="library"][data-run-method-count="2"]');
    })()`,
    'entry freezes every learned method with the preferred method first'
  );
  await clickButtonByPointer(cdp, '功法', '.topbar');
  const frozenSheet = await evaluate(
    cdp,
    `(() => ({
      frozen: document.querySelector('.method-frozen-summary')?.dataset.frozenMethod,
      count: document.querySelector('.method-frozen-summary')?.dataset.frozenMethodCount,
      summary: document.querySelector('.method-frozen-summary')?.textContent?.replace(/\\s+/g, ' ').trim(),
      enabledCardCommands: [...document.querySelectorAll('.method-card button')].filter((button) => !button.disabled).length
    }))()`
  );
  if (
    frozenSheet.frozen !== 'library' ||
    frozenSheet.count !== '2' ||
    !frozenSheet.summary?.includes('铁衣诀 R1') ||
    !frozenSheet.summary?.includes('吐纳诀 R3') ||
    frozenSheet.enabledCardCommands !== 0
  ) {
    throw new Error(`Run cultivation sheet should be frozen and read-only: ${JSON.stringify(frozenSheet)}`);
  }
  await clickDialogButton(cdp, '关闭');

  await evaluate(
    cdp,
    `(() => {
      const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
      payload.state.activeMethod = 'mist_breathing';
      payload.state.methodRanks.iron_body = 3;
      payload.state.methodRanks.mist_breathing = 2;
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload));
      return true;
    })()`
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const expectedSnapshots = [
        { rulesVersion: 1, methodId: 'iron_body', rank: 1 },
        { rulesVersion: 1, methodId: 'mist_breathing', rank: 3 }
      ];
      return saved.activeMethod === 'mist_breathing' && saved.methodRanks.iron_body === 3 &&
        saved.run.methodSnapshot.methodId === 'iron_body' && saved.run.methodSnapshot.rank === 1 &&
        JSON.stringify(saved.run.methodSnapshots) === JSON.stringify(expectedSnapshots) &&
        document.querySelector('[data-run-method="library"][data-run-method-count="2"]');
    })()`,
    'mid-run hub-field mutation cannot rewrite the frozen method library'
  );

  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-method-technique="library"][data-method-technique-count="2"]') &&
      document.querySelector('.method-technique-option[data-method-id="iron_body"].ready') &&
      document.querySelector('.method-technique-option[data-method-id="mist_breathing"].ready')`,
    'every learned method technique is ready in combat'
  );
  const techniqueBefore = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        turn: saved.combat.turn,
        monsterHp: saved.combat.monsterHp,
        playerHp: saved.player.hp,
        focus: saved.combat.weaponFocus,
        damageTaken: saved.run.damageTaken,
        usedItems: JSON.stringify(saved.run.usedItems),
        completed: JSON.stringify(saved.completedDungeonIds),
        effects: JSON.stringify(saved.combat.effects ?? {}),
        lastPlayerAction: saved.combat.effects?.lastPlayerAction
      };
    })()`
  );
  await clickButtonByPointer(cdp, '镇岳', '.method-technique-option[data-method-id="iron_body"]');
  await waitForPage(
    cdp,
    `(() => {
      const combat = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat;
      return document.querySelector('.method-technique-option[data-method-id="iron_body"].already_used') &&
        document.querySelector('.method-technique-option[data-method-id="mist_breathing"].ready') &&
        JSON.stringify(combat.methodTechniqueUsedIds) === JSON.stringify(['iron_body']) &&
        combat.methodTechniqueUsed === true;
    })()`,
    'used method technique is disabled while the other method remains ready'
  );
  const techniqueAfter = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        turn: saved.combat.turn,
        monsterHp: saved.combat.monsterHp,
        playerHp: saved.player.hp,
        focus: saved.combat.weaponFocus,
        guarding: saved.combat.guarding,
        damageTaken: saved.run.damageTaken,
        usedItems: JSON.stringify(saved.run.usedItems),
        completed: JSON.stringify(saved.completedDungeonIds),
        lastPlayerAction: saved.combat.effects?.lastPlayerAction
      };
    })()`
  );
  if (
    techniqueAfter.turn !== techniqueBefore.turn || techniqueAfter.monsterHp !== techniqueBefore.monsterHp ||
    techniqueAfter.playerHp !== techniqueBefore.playerHp || techniqueAfter.focus !== techniqueBefore.focus ||
    techniqueAfter.damageTaken !== techniqueBefore.damageTaken || techniqueAfter.usedItems !== techniqueBefore.usedItems ||
    techniqueAfter.completed !== techniqueBefore.completed || techniqueAfter.lastPlayerAction !== techniqueBefore.lastPlayerAction ||
    techniqueAfter.guarding !== true
  ) {
    throw new Error(`Technique should be immediate, free, and otherwise side-effect free: ${JSON.stringify({ techniqueBefore, techniqueAfter })}`);
  }
  await cdp.send('Page.reload');
  await waitForPage(
    cdp,
    `document.querySelector('.method-technique-option[data-method-id="iron_body"].already_used .method-technique-button')?.disabled &&
      !document.querySelector('.method-technique-option[data-method-id="mist_breathing"].ready .method-technique-button')?.disabled`,
    'per-method technique usage remains isolated after reload'
  );
  await finishActiveCombatByAttack(cdp, 'method technique first combat');
  await clickElementByPointer(cdp, '[data-action="grid-broken_sigil_reward"]');
  await clickElementByPointer(cdp, '[data-action="grid-left_watch_trap"]');
  await clickButtonByPointer(cdp, '冒险检定', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.grid-node.current.cleared')`, 'method route trap resolves');
  await clickElementByPointer(cdp, '[data-action="grid-fog_patrol_pair"]');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(
    cdp,
    `(() => {
      const combat = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat;
      return document.querySelector('.method-technique-option[data-method-id="iron_body"].ready') &&
        document.querySelector('.method-technique-option[data-method-id="mist_breathing"].ready') &&
        JSON.stringify(combat.methodTechniqueUsedIds) === JSON.stringify([]) &&
        combat.methodTechniqueUsed === false;
    })()`,
    'next combat resets every once-per-combat technique'
  );

  const sealedCombat = makeCombatSave({
    dungeonId: 'dream_archive', nodeId: 'hallucination_patrol', monsterId: 'paper_librarian', monsterHp: 80,
    learnedMethods: ['gate_sense'], methodRanks: { gate_sense: 2 }, activeMethod: 'gate_sense',
    methodSnapshot: { rulesVersion: 1, methodId: 'gate_sense', rank: 2 },
    lawState: makeDungeonLawState('dream_archive', { kind: 'dream_archive', sealedFeatures: ['method'] }),
    log: ['method Dream seal fixture'], combatLog: ['method Dream seal fixture']
  });
  await injectGameState(cdp, sealedCombat);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.method-technique-option[data-method-id="gate_sense"].sealed .method-technique-button')?.disabled`,
    'Dream seal disables the frozen technique'
  );

  const petRequired = makeCombatSave({
    dungeonId: 'demon_tower_1', nodeId: 'fog_lesser_demon', monsterHp: 42,
    learnedMethods: ['beast_taming'], methodRanks: { beast_taming: 1 }, activeMethod: 'beast_taming',
    methodSnapshot: { rulesVersion: 1, methodId: 'beast_taming', rank: 1 },
    log: ['method pet requirement fixture'], combatLog: ['method pet requirement fixture']
  });
  await injectGameState(cdp, petRequired);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.method-technique-option[data-method-id="beast_taming"].requires_pet')`,
    'Beast Taming requires an active pet'
  );
  petRequired.ownedPets = ['ash_hound'];
  petRequired.petLevels = { ash_hound: 1 };
  petRequired.activePet = 'ash_hound';
  await injectGameState(cdp, petRequired);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.method-technique-option[data-method-id="beast_taming"].ready')`,
    'active pet enables Beast Taming technique'
  );

  const malformed = makeCombatSave({
    dungeonId: 'demon_tower_1', nodeId: 'fog_lesser_demon', monsterHp: 42, rewardPoints: 4321,
    learnedMethods: ['mist_breathing'], methodRanks: { mist_breathing: 9, iron_body: 2, bad_method: 1 }, activeMethod: 'iron_body',
    methodSnapshot: { rulesVersion: 1, methodId: 'iron_body', rank: 2 }, methodTechniqueUsed: true,
    log: ['method malformed local recovery'], combatLog: ['method malformed local recovery']
  });
  await injectGameState(cdp, malformed);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.rewardPoints === 4321 && saved.log[0] === 'method malformed local recovery' &&
        JSON.stringify(saved.methodRanks) === JSON.stringify({ mist_breathing: 1 }) && saved.activeMethod === undefined &&
        saved.run.methodSnapshot === undefined && saved.combat.methodTechniqueUsed === undefined &&
        document.querySelector('[data-method-technique="legacy_disabled"]');
    })()`,
    'invalid and unlearned method fields recover locally without resetting the save'
  );

  const legacy = makeCombatSave({
    dungeonId: 'demon_tower_1', nodeId: 'fog_lesser_demon', monsterHp: 42,
    learnedMethods: ['mist_breathing'], log: ['method legacy R1 migration'], combatLog: ['method legacy R1 migration']
  });
  delete legacy.methodRanks;
  delete legacy.activeMethod;
  delete legacy.run.methodSnapshot;
  legacy.combat.methodTechniqueUsed = false;
  await injectGameState(cdp, legacy);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.methodRanks.mist_breathing === 1 && saved.activeMethod === undefined &&
        saved.run.methodSnapshot === undefined && saved.combat.methodTechniqueUsed === undefined &&
        document.querySelector('[data-method-technique="legacy_disabled"]');
    })()`,
    'legacy top-level methods migrate to R1 while the legacy run stays disabled'
  );

  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelector('.method-trigger')?.textContent.includes('0/7 已学会') && !document.querySelector('.combat-panel')`,
    'real restart pointer clears cultivation progress and run snapshot'
  );
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.reload');
  await waitForPage(
    cdp,
    `(() => {
      const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const saved = raw ? JSON.parse(raw).state : undefined;
      const cleanSave = !saved || (
        saved.phase === 'hub' &&
        saved.learnedMethods?.length === 0 &&
        saved.completedDungeonIds?.length === 0 &&
        saved.claimedTaskIds?.length === 0 &&
        saved.run === undefined
      );
      return cleanSave && innerWidth === 1440 && innerHeight === 900 &&
        document.querySelector('.method-trigger')?.textContent.includes('0/7 已学会') &&
        !document.querySelector('[role="dialog"]:not(.feature-help-popover)') &&
        !document.querySelector('.combat-panel');
    })()`,
    'restart remains clean after real reload'
  );

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({
    events: cdp.events.filter((event) => !(
      event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
    ))
  });
  if (browserErrors.length > 0) throw new Error(`Method cultivation smoke should have no browser errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] method cultivation: pointer learn/R2/R3/preference, frozen all-method library and hub mutation, per-method once/free/reload/next-combat techniques, Dream seal, pet gate, malformed/unlearned snapshot recovery, legacy R1/no-backfill, restart, and 390x844 + 1440x900 layouts');
}

async function runCompanionSmoke(cdp, appUrl) {
  await injectGameState(cdp, makeCompanionHubSave());
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.companion-trigger')?.textContent.includes('0/3 已招募') && innerWidth === 1440 && innerHeight === 900`,
    'companion funded hub restores'
  );

  await assertCompanionModalLayout(cdp, 1440, 900, '1440x900 empty roster');
  await clickButtonByPointer(cdp, '小队', '.topbar');
  await clickCardButtonByPointer(cdp, '.companion-card', '秦彻', '招募');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.ownedCompanions?.includes('qin_che') && saved.companionRanks?.qin_che === 1 && saved.activeCompanion === 'qin_che';
    })()`,
    'Qin Che recruits and auto-activates'
  );
  await clickCardButtonByPointer(cdp, '.companion-card', '秦彻', '晋升 R2');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.companionRanks?.qin_che === 2`,
    'Qin Che upgrades to R2'
  );
  await clickCardButtonByPointer(cdp, '.companion-card', '周映雪', '招募');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.ownedCompanions?.includes('zhou_yingxue')`,
    'Zhou Yingxue recruits'
  );
  await clickCardButtonByPointer(cdp, '.companion-card', '周映雪', '设为出战');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const card = document.querySelector('[data-companion-id="zhou_yingxue"]');
      return saved.activeCompanion === 'zhou_yingxue' && card?.dataset.companionActive === 'true';
    })()`,
    'Zhou Yingxue activates'
  );
  const rosterState = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return {
        rewardPoints: saved.rewardPoints,
        lingyun: saved.lingyun,
        demonBone: saved.inventory.demon_bone,
        methodPage: saved.inventory.method_page,
        qinRank: saved.companionRanks.qin_che,
        active: saved.activeCompanion
      };
    })()`
  );
  if (
    rosterState.rewardPoints !== 3240 ||
    rosterState.lingyun !== 6 ||
    rosterState.demonBone !== 7 ||
    rosterState.methodPage !== 8 ||
    rosterState.qinRank !== 2 ||
    rosterState.active !== 'zhou_yingxue'
  ) {
    throw new Error(`Companion commands should deduct exact costs and preserve rank/active state: ${JSON.stringify(rosterState)}`);
  }
  await clickDialogButton(cdp, '关闭');
  await assertCompanionModalLayout(cdp, 390, 844, '390x844 populated roster');

  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '选择协议');
  await waitForPage(cdp, `document.querySelector('.protocol-sheet')`, 'companion run protocol opens');
  await clickDialogButton(cdp, '确认标准探索');
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.phase === 'explore' && saved.run?.companionSnapshot?.companionId === 'zhou_yingxue' &&
        saved.run?.companionSnapshot?.rank === 1 && document.querySelector('[data-run-companion="zhou_yingxue"]');
    })()`,
    'entry freezes active companion'
  );
  await clickButtonByPointer(cdp, '小队', '.topbar');
  const frozenModal = await evaluate(
    cdp,
    `(() => ({
      frozen: document.querySelector('.companion-frozen-summary')?.dataset.frozenCompanion,
      enabledCommands: [...document.querySelectorAll('.companion-card button')].filter((button) => !button.disabled).length,
      text: document.querySelector('.companion-frozen-summary')?.textContent.replace(/\s+/g, ' ').trim() ?? ''
    }))()`
  );
  if (frozenModal.frozen !== 'zhou_yingxue' || frozenModal.enabledCommands !== 0 || !frozenModal.text.includes('R1')) {
    throw new Error(`Run companion modal should be frozen and read-only: ${JSON.stringify(frozenModal)}`);
  }
  await clickDialogButton(cdp, '关闭');

  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('[data-companion-assist="ready"]')`, 'companion assist becomes available');
  const assistBefore = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const command = document.querySelector('.companion-assist-command');
      const button = command?.querySelector('button');
      button?.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = button?.getBoundingClientRect();
      const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
      return {
        turn: saved.combat.turn,
        monsterHp: saved.combat.monsterHp,
        focus: saved.combat.weaponFocus ?? 0,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        commandOverflow: command ? command.scrollWidth > command.clientWidth + 1 : true,
        pointerTarget: Boolean(button && hit && button.contains(hit))
      };
    })()`
  );
  if (assistBefore.pageOverflow || assistBefore.commandOverflow || !assistBefore.pointerTarget) {
    throw new Error(`390x844 assist command should fit and remain pointer-targetable: ${JSON.stringify(assistBefore)}`);
  }
  await clickButtonByPointer(cdp, '弱点演算', '.companion-assist-command');
  await waitForPage(
    cdp,
    `document.querySelector('[data-companion-assist="already_used"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat?.companionAssistUsed === true`,
    'assist disables after one pointer use'
  );
  const assistAfter = await evaluate(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const button = document.querySelector('.companion-assist-button');
      return {
        disabled: button?.disabled,
        turn: saved.combat.turn,
        monsterHp: saved.combat.monsterHp,
        focus: saved.combat.weaponFocus,
        log: saved.combat.log[0]
      };
    })()`
  );
  if (
    !assistAfter.disabled ||
    assistAfter.turn !== assistBefore.turn ||
    assistAfter.monsterHp !== assistBefore.monsterHp ||
    assistAfter.focus !== Math.min(3, assistBefore.focus + 1) ||
    !assistAfter.log.includes('周映雪')
  ) {
    throw new Error(`Assist should be immediate, once-only, and logged: ${JSON.stringify({ assistBefore, assistAfter })}`);
  }

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('[data-companion-assist="already_used"]') && document.querySelector('.companion-assist-button')?.disabled`,
    'used assist remains disabled after reload'
  );
  await finishActiveCombatByAttack(cdp, 'companion first combat');
  await clickGridCell(cdp, '断符石盘');
  await clickGridCell(cdp, '窥视符眼');
  await clickButtonByPointer(cdp, '冒险检定', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.grid-node.current.cleared')`, 'companion route trap resolves');
  await clickGridCell(cdp, '双影巡逻');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(
    cdp,
    `document.querySelector('[data-companion-assist="ready"]') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat?.companionAssistUsed === false`,
    'new combat resets companion assist'
  );

  await evaluate(
    cdp,
    `(() => {
      const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
      payload.state.rewardPoints = 4321;
      payload.state.log = ['companion malformed local recovery'];
      payload.state.ownedCompanions = ['qin_che', 'bad_id', 'zhou_yingxue'];
      payload.state.companionRanks = { qin_che: 2, bad_id: 1, zhou_yingxue: 7 };
      payload.state.activeCompanion = 'zhou_yingxue';
      payload.state.run.companionSnapshot = { rulesVersion: 1, companionId: 'qin_che', rank: 4 };
      payload.state.combat.companionAssistUsed = 'broken';
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload));
      return true;
    })()`
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.rewardPoints === 4321 && saved.log[0] === 'companion malformed local recovery' &&
        JSON.stringify(saved.ownedCompanions) === JSON.stringify(['qin_che']) && saved.companionRanks.qin_che === 2 &&
        saved.activeCompanion === undefined && saved.run.companionSnapshot === undefined &&
        saved.combat.companionAssistUsed === undefined && document.querySelector('[data-run-companion="disabled"]');
    })()`,
    'malformed companion fields recover locally'
  );

  await evaluate(
    cdp,
    `(() => {
      const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
      payload.state.ownedCompanions = ['qin_che'];
      payload.state.companionRanks = { qin_che: 2 };
      payload.state.activeCompanion = 'qin_che';
      payload.state.run.companionSnapshot = { rulesVersion: 1, companionId: 'qin_che', rank: 2 };
      payload.state.combat.companionAssistUsed = 'broken';
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload));
      return true;
    })()`
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.run.companionSnapshot?.companionId === 'qin_che' && saved.combat.companionAssistUsed === undefined &&
        document.querySelector('[data-companion-assist="ready"]');
    })()`,
    'malformed assist-used state normalizes without losing valid snapshot'
  );

  await evaluate(
    cdp,
    `(() => {
      const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
      delete payload.state.run.companionSnapshot;
      payload.state.combat.companionAssistUsed = false;
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload));
      return true;
    })()`
  );
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      return saved.activeCompanion === 'qin_che' && saved.run.companionSnapshot === undefined &&
        !document.querySelector('.companion-assist-command') && document.querySelector('[data-run-companion="disabled"]');
    })()`,
    'legacy run stays companion-disabled without backfill'
  );

  await clickButtonByPointer(cdp, '重开', '.quick-actions');
  await waitForPage(
    cdp,
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
      document.querySelector('.companion-trigger')?.textContent.includes('0/3 已招募')`,
    'restart clears companion roster and run snapshot'
  );
  await setViewport(cdp, 1440, 900);
  console.log('[smoke] companion roster: recruit, exact-cost upgrade, activate, frozen entry, once-per-combat assist, reload, next-combat reset, malformed/legacy recovery, restart, and 390x844 + 1440x900 layouts');
}

async function runSilentBroadcastTowerPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (nextState, label) => {
    await injectGameState(cdp, nextState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };
  const relayNodeIds = ['north_relay_console', 'central_relay_console', 'south_relay_console'];
  const defaultPassives = {
    hushblade: false,
    deadAirHeadset: false,
    anechoicMantle: false,
    lastChannelBeacon: false
  };
  const makeBroadcastState = ({
    nodeId = 'broadcast_gate',
    noise = 0,
    pendingRelayNodeId = null,
    resolvedRelayChoices = {},
    bossNoiseSnapshot = null,
    firstClashMutedUsed = false,
    entryPassives = defaultPassives,
    clearedNodeIds = [],
    rewardPoints = 5000,
    runRewardPoints = 0,
    inventory = {},
    log = ['silent broadcast pointer smoke save'],
    ...options
  } = {}) => {
    const next = makeExploreSave({
      dungeonId: 'silent_broadcast_tower',
      nodeId,
      clearedNodeIds,
      rewardPoints,
      inventory: { silence_core: 6, ...inventory },
      lootBag: makeLootBag({ rewardPoints: runRewardPoints, items: { silence_core: 3 } }),
      completedDungeonIds: [...BROADCAST_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...BROADCAST_PRIOR_MAINLINE_TASK_IDS],
      log,
      ...options
    });
    next.run.broadcastEntryPassives = { ...entryPassives };
    next.run.lawState = makeDungeonLawState(
      'silent_broadcast_tower',
      {
        kind: 'silent_broadcast_tower',
        noise,
        pendingRelayNodeId,
        resolvedRelayChoices: { ...resolvedRelayChoices },
        bossNoiseSnapshot,
        entryPassives: { ...entryPassives },
        firstClashMutedUsed
      },
      { clearedNodeIds: [...clearedNodeIds] }
    );
    return next;
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      document.querySelector('.dungeon-card[data-dungeon-id="silent_broadcast_tower"]')?.textContent.includes('Tier 15') &&
      document.querySelector('.dungeon-card[data-dungeon-id="silent_broadcast_tower"]')?.textContent.includes('950') &&
      document.querySelector('.silent-broadcast-tower-banner')?.complete`,
    'broadcast smoke starts from a clean nineteen-chapter hub'
  );
  const assetEvidence = await evaluate(cdp, `(() => {
    const image = document.querySelector('.silent-broadcast-tower-banner');
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) return { loaded: false };
    const canvas = document.createElement('canvas');
    canvas.width = 72; canvas.height = 18;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, 72, 18);
    const pixels = context.getImageData(0, 0, 72, 18).data;
    const colors = new Set(); let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0) opaque += 1;
      colors.add(pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2] + ',' + pixels[index + 3]);
    }
    return { loaded: true, natural: [image.naturalWidth, image.naturalHeight], colors: colors.size, opaque, alt: image.alt };
  })()`);
  if (
    !assetEvidence.loaded ||
    assetEvidence.natural?.join('x') !== '720x180' ||
    assetEvidence.colors < 8 ||
    assetEvidence.opaque < 100 ||
    !assetEvidence.alt?.includes('废弃播音塔') ||
    !assetEvidence.alt?.includes('隔音走廊')
  ) {
    throw new Error(`Tier-15 asset should be original, loaded, nonblank, and accurately described: ${JSON.stringify(assetEvidence)}`);
  }
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await setViewport(cdp, width, height);
    const cardGeometry = await evaluate(cdp, `(() => {
      const card = document.querySelector('.dungeon-card[data-dungeon-id="silent_broadcast_tower"]');
      const image = card?.querySelector('.silent-broadcast-tower-banner');
      card?.scrollIntoView({ block: 'center' });
      const pageWidth = document.documentElement.clientWidth;
      const cardRect = card?.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      return {
        pageWidth,
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > pageWidth + 1,
        card: cardRect && { left: cardRect.left, right: cardRect.right },
        image: imageRect && { left: imageRect.left, right: imageRect.right, width: imageRect.width, height: imageRect.height }
      };
    })()`);
    if (
      cardGeometry.pageOverflow ||
      !cardGeometry.card ||
      !cardGeometry.image ||
      cardGeometry.card.left < -1 ||
      cardGeometry.card.right > cardGeometry.pageWidth + 1 ||
      cardGeometry.image.left < cardGeometry.card.left - 1 ||
      cardGeometry.image.right > cardGeometry.card.right + 1 ||
      Math.abs(cardGeometry.image.width / cardGeometry.image.height - 4) > 0.06
    ) {
      throw new Error(`Tier-15 card should stay bounded at ${width}x${height}: ${JSON.stringify(cardGeometry)}`);
    }
  }

  const entryGearIds = ['hushblade', 'dead_air_headset', 'anechoic_mantle', 'last_channel_beacon'];
  const entryHub = makeBroadcastState();
  entryHub.phase = 'hub';
  delete entryHub.run;
  entryHub.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, ...entryGearIds];
  entryHub.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, ...Object.fromEntries(entryGearIds.map((id) => [id, 1])) };
  entryHub.equipped = {
    ...BASIC_EQUIPPED,
    weapon: 'hushblade',
    head: 'dead_air_headset',
    armor: 'anechoic_mantle',
    charm: 'last_channel_beacon'
  };
  await navigateWithState(entryHub, 'Tier-15 four-equipment entry fixture renders');
  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '[data-action="enter-silent_broadcast_tower"]');
  await waitForPage(cdp, `(() => {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
    const passives = saved.run?.lawState?.law?.entryPassives;
    return saved.run?.dungeonId === 'silent_broadcast_tower' &&
      ['hushblade','deadAirHeadset','anechoicMantle','lastChannelBeacon'].every((id) => passives?.[id] === true) &&
      document.querySelectorAll('[data-broadcast-entry-passive][data-frozen="true"]').length === 4;
  })()`, 'four broadcast equipment passives freeze on real entry');
  await evaluate(cdp, `(() => {
    const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
    payload.state.equipped = ${JSON.stringify(BASIC_EQUIPPED)};
    localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload));
  })()`);
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelectorAll('[data-broadcast-entry-passive][data-frozen="true"]').length === 4`, 'entry passives remain frozen after hub equipment mutation and reload');

  const pending = makeBroadcastState({
    nodeId: 'north_relay_console',
    noise: 3,
    pendingRelayNodeId: 'north_relay_console',
    clearedNodeIds: ['north_relay_console']
  });
  await navigateWithState(pending, 'pending broadcast relay renders');
  await waitForPage(cdp, `(() => {
    const fieldset = document.querySelector('.broadcast-relay-fieldset');
    const mute = document.querySelector('[data-broadcast-relay-choice="mute"]');
    const broadcast = document.querySelector('[data-broadcast-relay-choice="broadcast"]');
    const movable = [...document.querySelectorAll('.dungeon-map .grid-node')].filter((node) => !node.classList.contains('current') && !node.disabled);
    const triggers = ['.character-trigger','.task-trigger','.companion-trigger','.method-trigger','.bloodline-trigger']
      .map((selector) => document.querySelector(selector));
    return fieldset && !fieldset.closest('[role="dialog"][aria-modal="true"]') &&
      mute?.dataset.noiseBefore === '3' && mute.dataset.noiseAfter === '2' && mute.dataset.noiseDelta === '-1' &&
      broadcast?.dataset.noiseAfter === '4' && broadcast.dataset.noiseDelta === '1' && broadcast.dataset.bonusRp === '180' &&
      movable.length === 0 && triggers.every((trigger) => trigger && !trigger.disabled);
  })()`, 'pending relay is non-modal, shows exact choices, locks only map movement, and leaves hub sheets enabled');
  await openCharacterSheet(cdp, 'pending broadcast relay');
  await assertEscapeClosesCharacterSheet(cdp, 'pending broadcast relay');
  await openTaskModal(cdp, 'pending broadcast relay');
  await assertEscapeClosesTaskModal(cdp, 'pending broadcast relay');
  for (const [label, selector] of [['小队', '.companion-sheet'], ['功法', '.method-sheet'], ['血统', '.bloodline-sheet']]) {
    await clickButtonByPointer(cdp, label, '.topbar');
    await waitForPage(cdp, `document.querySelector(${JSON.stringify(selector)})`, `pending relay opens ${label}`);
    await pressEscape(cdp);
    await waitForPage(cdp, `!document.querySelector(${JSON.stringify(selector)})`, `pending relay closes ${label}`);
  }

  const firstClash = makeBroadcastState({
    nodeId: 'static_screen_trap',
    entryPassives: { ...defaultPassives, hushblade: true },
    player: { hp: 200, maxHp: 200 }
  });
  await navigateWithState(firstClash, 'first dangerous clear suppression fixture renders');
  await clickButtonByPointer(cdp, '冒险检定', '.node-action-panel');
  await waitForPage(cdp, `(() => { const law = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law; return law.noise === 0 && law.firstClashMutedUsed === true; })()`, 'hushblade suppresses the first dangerous clear noise exactly once');

  for (const testCase of [
    { headset: false, expected: 2, delta: -1 },
    { headset: true, expected: 1, delta: -2 }
  ]) {
    await navigateWithState(makeBroadcastState({
      nodeId: 'north_relay_console', noise: 3, pendingRelayNodeId: 'north_relay_console',
      clearedNodeIds: ['north_relay_console'],
      entryPassives: { ...defaultPassives, deadAirHeadset: testCase.headset }
    }), `mute ${testCase.delta} fixture renders`);
    await clickElementByPointer(cdp, '[data-broadcast-relay-choice="mute"]');
    await waitForPage(cdp, `(() => {
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
      const result = document.querySelector('[data-broadcast-relay-result="mute"]');
      return saved.run.lawState.law.noise === ${testCase.expected} && saved.rewardPoints === 5000 &&
        saved.run.lootBag.rewardPoints === 0 && result?.dataset.noiseAfter === '${testCase.expected}' && result?.dataset.bonusRp === '0';
    })()`, `mute applies exact ${testCase.delta} noise with no RP`);
  }

  await navigateWithState(makeBroadcastState({
    nodeId: 'central_relay_console', noise: 3, pendingRelayNodeId: 'central_relay_console',
    clearedNodeIds: ['central_relay_console']
  }), 'broadcast +1/+180 fixture renders');
  await clickElementByPointer(cdp, '[data-broadcast-relay-choice="broadcast"]');
  await waitForPage(cdp, `(() => {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
    const result = document.querySelector('[data-broadcast-relay-result="broadcast"]');
    return saved.run.lawState.law.noise === 4 && saved.rewardPoints === 5180 &&
      saved.run.lootBag.rewardPoints === 180 && result?.dataset.noiseAfter === '4' && result?.dataset.bonusRp === '180' &&
      !document.querySelector('[data-broadcast-relay-choice="broadcast"]');
  })()`, 'broadcast applies exact +1 noise, grants +180 run RP once, and removes repeat claim control');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.rewardPoints === 5180 && saved.run.lootBag.rewardPoints === 180 && !document.querySelector('[data-broadcast-relay-choice="broadcast"]'); })()`, 'broadcast reward cannot be reclaimed after reload');

  for (let bits = 0; bits < 8; bits += 1) {
    const sequence = relayNodeIds.map((nodeId, index) => [nodeId, bits & (1 << index) ? 'broadcast' : 'mute']);
    const choices = Object.fromEntries(sequence);
    const broadcastCount = sequence.filter(([, choice]) => choice === 'broadcast').length;
    const noise = broadcastCount * 2;
    await navigateWithState(makeBroadcastState({
      noise,
      resolvedRelayChoices: choices,
      clearedNodeIds: [...relayNodeIds]
    }), `broadcast relay matrix ${bits + 1}/8 renders`);
    const routeState = await evaluate(cdp, `(() => ({
      noise: document.querySelector('.broadcast-map-status')?.dataset.broadcastNoise,
      mute: document.querySelector('.broadcast-map-status')?.dataset.broadcastMuteCount,
      broadcast: document.querySelector('.broadcast-map-status')?.dataset.broadcastCount,
      sectors: Object.fromEntries([...document.querySelectorAll('[data-route-sector]')].map((sector) => [sector.dataset.routeSector, sector.dataset.routeSectorStatus]))
    }))()`);
    const expected = {
      broadcast_silent_archive: broadcastCount === 0 ? 'open' : 'closed',
      broadcast_resonance_vault: broadcastCount >= 2 ? 'open' : 'closed',
      broadcast_balanced_switchboard: broadcastCount === 1 ? 'open' : 'closed',
      broadcast_boss_approach: 'open'
    };
    if (
      routeState.noise !== String(noise) ||
      routeState.mute !== String(3 - broadcastCount) ||
      routeState.broadcast !== String(broadcastCount) ||
      Object.entries(expected).some(([sectorId, status]) => routeState.sectors[sectorId] !== status)
    ) {
      throw new Error(`Broadcast relay matrix ${bits.toString(2).padStart(3, '0')} mismatch: ${JSON.stringify({ routeState, expected })}`);
    }
  }

  const routeCases = [
    { nodeId: 'north_echo_cache', target: 'silent_archive', choices: Object.fromEntries(relayNodeIds.map((id) => [id, 'mute'])), noise: 0 },
    { nodeId: 'broadcast_warden_north', target: 'resonance_vault', choices: Object.fromEntries(relayNodeIds.map((id) => [id, 'broadcast'])), noise: 6 },
    { nodeId: 'soul_recharge_broadcast', target: 'balanced_switchboard', choices: { north_relay_console: 'mute', central_relay_console: 'mute', south_relay_console: 'broadcast' }, noise: 2 }
  ];
  for (const routeCase of routeCases) {
    await navigateWithState(makeBroadcastState({
      nodeId: routeCase.nodeId,
      noise: routeCase.noise,
      resolvedRelayChoices: routeCase.choices,
      clearedNodeIds: [...relayNodeIds, routeCase.nodeId]
    }), `${routeCase.target} representative route renders`);
    await waitForPage(cdp, `document.querySelector('[data-action="grid-${routeCase.target}"]:not(:disabled)')`, `${routeCase.target} real grid button is enabled`);
    await clickElementByPointer(cdp, `[data-action="grid-${routeCase.target}"]`);
    await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === '${routeCase.target}'`, `${routeCase.target} is entered by its real map button`);
  }

  await navigateWithState(makeBroadcastState({
    nodeId: 'last_broadcaster',
    noise: 4,
    resolvedRelayChoices: Object.fromEntries(relayNodeIds.map((id) => [id, 'broadcast'])),
    clearedNodeIds: [...relayNodeIds],
    entryPassives: { ...defaultPassives, lastChannelBeacon: true }
  }), 'broadcast Boss snapshot fixture renders');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `(() => {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
    return saved.phase === 'combat' && saved.run.lawState.law.bossNoiseSnapshot === 3 &&
      document.querySelector('.combat-panel .broadcast-map-status[data-broadcast-boss-snapshot="3"]')?.textContent.includes('noise 3/6');
  })()`, 'Boss entry freezes and renders the beacon-reduced noise snapshot');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.combat-panel .broadcast-map-status[data-broadcast-boss-snapshot="3"]')`, 'Boss noise snapshot remains readable after reload');

  const genesisLaw = { kind: 'genesis_vault', pendingSpliceNodeId: null, spliceSequence: [], bossGenomeSnapshot: null, entryGear: {}, entryBloodline: {} };
  for (const [portalNodeId, expectedTarget] of [['upper_genesis_portal', 'north_entry'], ['lower_genesis_portal', 'lower_entry'], ['return_genesis_portal', 'broadcast_gate']]) {
    const source = makeExploreSave({
      dungeonId: 'genesis_vault', nodeId: portalNodeId, inventory: { gate_sigil: 1 },
      completedDungeonIds: [...BROADCAST_PRIOR_DUNGEON_IDS], claimedTaskIds: [...BROADCAST_PRIOR_MAINLINE_TASK_IDS]
    });
    source.run.lawState = makeDungeonLawState('genesis_vault', genesisLaw);
    await navigateWithState(source, `Tier 14 ${portalNodeId} -> Tier 15 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'silent_broadcast_tower' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 14 ${portalNodeId} reaches Tier 15 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_broadcast_portal', 'shelter_gate']]) {
    await navigateWithState(makeBroadcastState({
      nodeId: portalNodeId,
      inventory: { gate_sigil: 1 },
      completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS]
    }), `Tier 15 ${portalNodeId} -> Tier 16 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'lost_shelter' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 15 ${portalNodeId} reaches Tier 16 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_shelter_portal', 'verdict_gate']]) {
    await navigateWithState(makeLostShelterExploreSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 16 ${portalNodeId} -> Tier 17 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'false_testimony_court' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 16 ${portalNodeId} reaches Tier 17 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'upper_entry'], ['lower_return_portal', 'lower_entry'], ['return_testimony_portal', 'stage_gate']]) {
    await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 17 ${portalNodeId} -> Tier 18 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'combat_replay_stage' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 17 ${portalNodeId} reaches Tier 18 ${expectedTarget}`);
  }

  await navigateWithState(makeBroadcastState(), 'responsive Tier-15 map fixture renders');
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertResponsiveSurface(cdp, {
      width,
      height,
      rootSelector: '.dungeon-map[data-dungeon-id="silent_broadcast_tower"]',
      targetSelectors: ['.dungeon-map[data-dungeon-id="silent_broadcast_tower"]', '.broadcast-map-status', '.node-action-panel'],
      buttonSelectors: ['.dungeon-map[data-dungeon-id="silent_broadcast_tower"] .grid-node:not(:disabled)'],
      minimumButtonHeight: 40,
      checkRootOverflow: true,
      label: `${width}x${height} Tier-15 map`
    });
    const mapGeometry = await evaluate(cdp, `(() => {
      const pageWidth = document.documentElement.clientWidth;
      const nodes = [...document.querySelectorAll('.dungeon-map[data-dungeon-id="silent_broadcast_tower"] .grid-node')];
      const records = nodes.map((node) => { const rect = node.getBoundingClientRect(); return { action: node.dataset.action, left: rect.left, right: rect.right, width: rect.width, height: rect.height, overflow: node.scrollWidth > node.clientWidth + 1 }; });
      const distinct = (values) => [...new Set(values.map((value) => Math.round(value)))];
      const tops = nodes.map((node) => node.getBoundingClientRect().top);
      return {
        count: records.length,
        columns: distinct(records.map((node) => node.left)).length,
        rows: distinct(tops).length,
        bad: records.filter((node) => node.width <= 0 || node.height < 40 || node.left < -1 || node.right > pageWidth + 1 || node.overflow)
      };
    })()`);
    if (mapGeometry.count !== 30 || mapGeometry.columns !== 6 || mapGeometry.rows !== 5 || mapGeometry.bad.length > 0) {
      throw new Error(`Tier-15 map should render 30 bounded 6x5 nodes at ${width}x${height}: ${JSON.stringify(mapGeometry)}`);
    }
  }

  const malformed = makeBroadcastState({ noise: 4, log: ['broadcast malformed local recovery'] });
  malformed.rewardPoints = 6789;
  malformed.run.lawState.law = {
    kind: 'silent_broadcast_tower', noise: 99, pendingRelayNodeId: 'bad_relay',
    resolvedRelayChoices: { north_relay_console: 'invalid' }, bossNoiseSnapshot: 'bad',
    entryPassives: { hushblade: 'yes' }, firstClashMutedUsed: 'no'
  };
  await navigateWithState(malformed, 'malformed Tier-15 law recovers locally');
  await waitForPage(cdp, `(() => {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
    const law = saved.run.lawState.law;
    return saved.rewardPoints === 6789 && saved.log[0] === 'broadcast malformed local recovery' &&
      saved.inventory.silence_core === 6 && law.kind === 'silent_broadcast_tower' && law.noise === 0 &&
      law.pendingRelayNodeId === null && Object.keys(law.resolvedRelayChoices).length === 0;
  })()`, 'malformed broadcast substate resets locally without losing valid save data');

  const legacy = makeBroadcastState({
    entryPassives: { ...defaultPassives, hushblade: true },
    log: ['broadcast legacy local recovery']
  });
  delete legacy.inventory.silence_core;
  delete legacy.run.lawState;
  delete legacy.run.broadcastEntryPassives;
  legacy.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, 'hushblade'];
  legacy.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, hushblade: 1 };
  legacy.equipped = { ...BASIC_EQUIPPED, weapon: 'hushblade' };
  await navigateWithState(legacy, 'legacy Tier-15 save recovers locally');
  await waitForPage(cdp, `(() => {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
    return saved.inventory.silence_core === 0 && saved.log[0] === 'broadcast legacy local recovery' &&
      saved.run.lawState.law.kind === 'silent_broadcast_tower' && saved.run.lawState.law.entryPassives.hushblade === false &&
      document.querySelector('[data-broadcast-entry-passive="hushblade"][data-frozen="false"]');
  })()`, 'legacy run defaults missing material and law locally without hub equipment backfill');

  await navigateWithState(makeBroadcastState({ noise: 5, inventory: { silence_core: 9 } }), 'broadcast restart fixture renders');
  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
    document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('.broadcast-map-status') &&
    innerWidth === 1440 && innerHeight === 900 && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'new game clears Tier-15 law/material state and restores 1440x900 home');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[role="dialog"][aria-modal="true"]')`, 'broadcast smoke keeps a clean home after reload');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(
    event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
  )) });
  if (browserErrors.length > 0) throw new Error(`Broadcast smoke should have no console/resource/page errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] silent broadcast tower: 19-card asset, 30-node 6x5 responsive map, frozen four-gear entry, exact noise/RP relay choices, 8 route sequences, three real route buttons, Boss snapshot reload, 14 -> 15 -> 16 -> 17 -> 1 portals, local save recovery, and clean restart');
}

async function runLostShelterPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (nextState, label) => {
    await injectGameState(cdp, nextState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };
  const checkpointNodeIds = ['north_checkpoint', 'central_checkpoint', 'south_checkpoint'];
  const rescueGearIds = ['rescue_carbine', 'triage_visor', 'evacuation_plate', 'blackbox_beacon'];
  const emptyGear = { rescueCarbine: false, triageVisor: false, evacuationPlate: false, blackboxBeacon: false };
  const fullGear = { rescueCarbine: true, triageVisor: true, evacuationPlate: true, blackboxBeacon: true };
  const makeShelterState = ({
    nodeId = 'shelter_gate',
    survivorHp = 100,
    pendingCheckpointNodeId = null,
    resolvedCheckpointChoices = {},
    bossSurvivorSnapshot = null,
    entryGear = emptyGear,
    companionId = null,
    companionRank = 0,
    firstHazardGuardUsed = false,
    companionAnalysisUsed = false,
    companionTriageUsed = false,
    clearedNodeIds = [],
    runPills = 0,
    inventoryPills = runPills,
    rewardPoints = 5000,
    runRewardPoints = 0,
    inventory = {},
    log = ['lost shelter pointer smoke save'],
    ...options
  } = {}) => {
    const checkpointClears = [...new Set([
      ...clearedNodeIds,
      ...Object.keys(resolvedCheckpointChoices),
      ...(pendingCheckpointNodeId ? [pendingCheckpointNodeId] : [])
    ])];
    const lootItems = { rescue_badge: 3 };
    if (runPills > 0) lootItems.healing_pill = runPills;
    const next = makeExploreSave({
      dungeonId: 'lost_shelter',
      nodeId,
      clearedNodeIds: checkpointClears,
      rewardPoints,
      inventory: { rescue_badge: 6, healing_pill: inventoryPills, ...inventory },
      lootBag: makeLootBag({ rewardPoints: runRewardPoints, items: lootItems }),
      completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS],
      log,
      ...options
    });
    next.run.escortEntryGear = { ...entryGear };
    if (companionId) {
      next.ownedCompanions = [companionId];
      next.companionRanks = { [companionId]: companionRank };
      next.activeCompanion = companionId;
      next.run.companionSnapshot = { rulesVersion: 1, companionId, rank: companionRank };
    } else {
      next.ownedCompanions = [];
      next.companionRanks = {};
      delete next.activeCompanion;
      delete next.run.companionSnapshot;
    }
    next.run.lawState = makeDungeonLawState('lost_shelter', {
      kind: 'lost_shelter',
      survivorHp,
      pendingCheckpointNodeId,
      resolvedCheckpointChoices: { ...resolvedCheckpointChoices },
      bossSurvivorSnapshot,
      entryGear: { ...entryGear },
      entryCompanion: { id: companionId, rank: companionRank },
      firstHazardGuardUsed,
      companionAnalysisUsed,
      companionTriageUsed
    }, { clearedNodeIds: checkpointClears });
    return next;
  };
  const makeShelterHub = (companionId = 'qin_che', companionRank = 2) => {
    const next = makeShelterState({ companionId, companionRank });
    next.phase = 'hub';
    delete next.run;
    next.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, ...rescueGearIds];
    next.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, ...Object.fromEntries(rescueGearIds.map((id) => [id, 3])) };
    next.equipped = {
      ...BASIC_EQUIPPED,
      weapon: 'rescue_carbine',
      head: 'triage_visor',
      armor: 'evacuation_plate',
      charm: 'blackbox_beacon'
    };
    return next;
  };
  const finishShelterMonster = async (fixture, label) => {
    await navigateWithState(fixture, `${label} renders`);
    await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
    await waitForPage(cdp, `document.querySelector('.combat-panel')`, `${label} combat starts`);
    await evaluate(cdp, `(() => {
      const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));
      payload.state.combat.monsterHp = 1;
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload));
    })()`);
    await cdp.send('Page.reload');
    await waitForPage(cdp, `document.querySelector('.combat-panel')`, `${label} one-HP combat reloads`);
    await clickButtonByPointer(cdp, '攻击', '.combat-panel');
    await waitForPage(cdp, `!document.querySelector('.combat-panel')`, `${label} clears`);
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
    document.querySelector('.dungeon-card[data-dungeon-id="lost_shelter"]')?.textContent.includes('Tier 16') &&
    document.querySelector('.dungeon-card[data-dungeon-id="lost_shelter"]')?.textContent.includes('1040') &&
    document.querySelector('.lost-shelter-banner')?.complete && document.body.textContent.includes('救援铭牌')`, 'clean nineteen-chapter shelter hub');
  const catalogEvidence = await evaluate(cdp, `(() => ({
    cards: document.querySelectorAll('.dungeon-card').length,
    matureEquipment: document.querySelectorAll('.shop-card.equipment-card').length,
    rescueGear: ${JSON.stringify(rescueGearIds)}.filter((id) => document.querySelector('[data-equipment-id="' + id + '"]')).length,
    material: document.body.textContent.includes('救援铭牌')
  }))()`);
  if (catalogEvidence.cards !== 19 || catalogEvidence.matureEquipment !== 56 || catalogEvidence.rescueGear !== 4 || !catalogEvidence.material) {
    throw new Error(`Tier-16 hub catalog mismatch: ${JSON.stringify(catalogEvidence)}`);
  }
  const assetEvidence = await evaluate(cdp, `(() => {
    const image = document.querySelector('.lost-shelter-banner');
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) return { loaded: false };
    const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 18;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 72, 18);
    const pixels = context.getImageData(0, 0, 72, 18).data; const colors = new Set(); let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) { if (pixels[index + 3] > 0) opaque += 1; colors.add(pixels.slice(index, index + 4).join(',')); }
    return { loaded: true, natural: [image.naturalWidth, image.naturalHeight], colors: colors.size, opaque, alt: image.alt };
  })()`);
  if (!assetEvidence.loaded || assetEvidence.natural?.join('x') !== '720x180' || assetEvidence.colors < 8 || assetEvidence.opaque < 100 ||
    !assetEvidence.alt?.includes('担架') || !assetEvidence.alt?.includes('三站应急灯') || !assetEvidence.alt?.includes('拟声')) {
    throw new Error(`Tier-16 shelter asset mismatch: ${JSON.stringify(assetEvidence)}`);
  }
  console.log('[smoke:shelter] hub catalog and asset verified');

  for (const companionId of ['qin_che', 'zhou_yingxue', 'lu_guanlan']) {
    for (const rank of [1, 2]) {
      await navigateWithState(makeShelterHub(companionId, rank), `${companionId} R${rank} entry hub renders`);
      await clickElementByPointer(cdp, '[data-action="enter-lost_shelter"]');
      await waitForPage(cdp, `document.querySelectorAll('[data-shelter-entry-gear][data-frozen="true"]').length === 4 &&
        document.querySelector('[data-shelter-companion-role="${companionId}"][data-companion-rank="${rank}"]')`, `${companionId} R${rank} and four gear freeze on real entry`);
    }
  }
  console.log('[smoke:shelter] four gear and companion R1/R2 entry freezes verified');

  const pending = makeShelterState({
    nodeId: 'north_checkpoint', survivorHp: 50, pendingCheckpointNodeId: 'north_checkpoint', runPills: 1
  });
  await navigateWithState(pending, 'pending shelter checkpoint renders');
  await waitForPage(cdp, `(() => {
    const fieldset = document.querySelector('.shelter-checkpoint-fieldset');
    const treat = document.querySelector('[data-shelter-checkpoint-choice="treat"]');
    const push = document.querySelector('[data-shelter-checkpoint-choice="push"]');
    const movable = [...document.querySelectorAll('.dungeon-map .grid-node')].filter((node) => !node.classList.contains('current') && !node.disabled);
    const triggers = ['.character-trigger','.task-trigger','.companion-trigger','.method-trigger','.bloodline-trigger'].map((selector) => document.querySelector(selector));
    const retreat = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('撤回主神空间'));
    return fieldset && !fieldset.closest('[role="dialog"][aria-modal="true"]') &&
      treat?.dataset.survivorHpBefore === '50' && treat.dataset.survivorHpAfter === '75' && treat.dataset.healingPillCost === '1' &&
      push?.dataset.survivorHpAfter === '40' && push.dataset.bonusRp === '200' && movable.length === 0 &&
      triggers.every((trigger) => trigger && !trigger.disabled) && retreat && !retreat.disabled;
  })()`, 'pending checkpoint is exact, non-modal, and locks only map movement');
  await openCharacterSheet(cdp, 'pending shelter checkpoint');
  await assertEscapeClosesCharacterSheet(cdp, 'pending shelter checkpoint');
  await openTaskModal(cdp, 'pending shelter checkpoint');
  await assertEscapeClosesTaskModal(cdp, 'pending shelter checkpoint');
  for (const [label, selector] of [['小队', '.companion-sheet'], ['功法', '.method-sheet'], ['血统', '.bloodline-sheet']]) {
    await clickButtonByPointer(cdp, label, '.topbar');
    await waitForPage(cdp, `document.querySelector(${JSON.stringify(selector)})`, `pending shelter opens ${label}`);
    await pressEscape(cdp);
    await waitForPage(cdp, `!document.querySelector(${JSON.stringify(selector)})`, `pending shelter closes ${label}`);
  }
  console.log('[smoke:shelter] pending checkpoint lock and modal access verified');

  await finishShelterMonster(makeShelterState({ nodeId: 'mimic_survivor' }), 'plain shelter monster hazard');
  await waitForPage(cdp, `document.querySelector('.shelter-map-status')?.dataset.survivorHp === '90'`, 'plain monster costs 10 survivor HP');
  await finishShelterMonster(makeShelterState({ nodeId: 'mimic_survivor', companionId: 'qin_che', companionRank: 2 }), 'Qin R2 first hazard guard');
  await waitForPage(cdp, `document.querySelector('.shelter-map-status')?.dataset.survivorHp === '100' && document.querySelector('[data-shelter-companion-role="qin_che"]')?.dataset.used === 'true'`, 'Qin R2 guards first hazard');
  await finishShelterMonster(makeShelterState({ nodeId: 'mimic_survivor', entryGear: { ...emptyGear, rescueCarbine: true } }), 'rescue carbine monster protection');
  await waitForPage(cdp, `document.querySelector('.shelter-map-status')?.dataset.survivorHp === '94'`, 'rescue carbine reduces monster loss to 6');

  for (const [plate, expected] of [[false, 85], [true, 90]]) {
    await navigateWithState(makeShelterState({
      nodeId: 'collapsed_hall_trap', entryGear: { ...emptyGear, evacuationPlate: plate }, inventory: { armor_patch: 1 }
    }), `shelter trap plate=${plate} renders`);
    await clickButtonByPointer(cdp, '使用 护甲补片', '.node-action-panel');
    await waitForPage(cdp, `document.querySelector('.shelter-map-status')?.dataset.survivorHp === '${expected}'`, `trap survivor loss with plate=${plate}`);
  }
  console.log('[smoke:shelter] monster, trap, Qin, carbine, and plate hazards verified');

  await navigateWithState(makeShelterState({
    nodeId: 'north_checkpoint', survivorHp: 50, pendingCheckpointNodeId: 'north_checkpoint', inventoryPills: 5, runPills: 0
  }), 'bank-only treatment fixture renders');
  await waitForPage(cdp, `(() => { const treat = document.querySelector('[data-shelter-checkpoint-choice="treat"]'); const push = document.querySelector('[data-shelter-checkpoint-choice="push"]'); return treat?.disabled && treat.textContent.includes('当前 run 没有止血丹') && !push?.disabled; })()`, 'bank pills cannot fund current-run treatment');

  await navigateWithState(makeShelterState({
    nodeId: 'north_checkpoint', survivorHp: 50, pendingCheckpointNodeId: 'north_checkpoint', runPills: 1
  }), 'funded treatment fixture renders');
  await clickElementByPointer(cdp, '[data-shelter-checkpoint-choice="treat"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; const result = document.querySelector('[data-shelter-checkpoint-result="treat"]'); return saved.run.lawState.law.survivorHp === 75 && saved.inventory.healing_pill === 0 && saved.run.lootBag.items.healing_pill === undefined && result?.dataset.survivorHpAfter === '75' && !document.querySelector('[data-shelter-checkpoint-choice]'); })()`, 'treat applies +25, costs synchronized run pill, and cannot repeat');

  await navigateWithState(makeShelterState({
    nodeId: 'north_checkpoint', survivorHp: 50, pendingCheckpointNodeId: 'north_checkpoint',
    entryGear: { ...emptyGear, triageVisor: true }, companionId: 'lu_guanlan', companionRank: 2
  }), 'Lu R2 triage stack fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-shelter-checkpoint-choice="treat"]')?.dataset.survivorHpAfter === '95' && document.querySelector('[data-shelter-checkpoint-choice="treat"]')?.dataset.healingPillCost === '0'`, 'Lu R2 plus visor shows free +45');
  await clickElementByPointer(cdp, '[data-shelter-checkpoint-choice="treat"]');
  await waitForPage(cdp, `document.querySelector('.shelter-map-status')?.dataset.survivorHp === '95' && document.querySelector('[data-shelter-companion-role="lu_guanlan"]')?.dataset.used === 'true'`, 'Lu R2 free triage resolves exactly once');

  await navigateWithState(makeShelterState({
    nodeId: 'central_checkpoint', survivorHp: 70, pendingCheckpointNodeId: 'central_checkpoint', companionId: 'zhou_yingxue', companionRank: 2
  }), 'Zhou R2 push fixture renders');
  await waitForPage(cdp, `document.querySelector('[data-shelter-checkpoint-choice="push"]')?.dataset.survivorHpAfter === '70'`, 'Zhou first push projects no HP loss');
  await clickElementByPointer(cdp, '[data-shelter-checkpoint-choice="push"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.rewardPoints === 5200 && saved.run.lootBag.rewardPoints === 200 && saved.run.lawState.law.survivorHp === 70 && saved.run.lawState.law.companionAnalysisUsed === true; })()`, 'Zhou first push is free and grants +200 atomically');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.rewardPoints === 5200 && saved.run.lootBag.rewardPoints === 200 && !document.querySelector('[data-shelter-checkpoint-choice]'); })()`, 'push cannot repeat after reload');
  console.log('[smoke:shelter] bank-only, treat, Lu triage, Zhou push, and repeat guards verified');

  for (let bits = 0; bits < 8; bits += 1) {
    let hp = 35;
    const choices = Object.fromEntries(checkpointNodeIds.map((nodeId, index) => {
      const choice = bits & (1 << index) ? 'push' : 'treat';
      hp = choice === 'treat' ? Math.min(100, hp + 25) : Math.max(0, hp - 10);
      return [nodeId, choice];
    }));
    await navigateWithState(makeShelterState({ survivorHp: hp, resolvedCheckpointChoices: choices }), `shelter choice matrix ${bits + 1}/8 renders`);
    const matrix = await evaluate(cdp, `(() => ({ hp: document.querySelector('.shelter-map-status')?.dataset.survivorHp, resolved: document.querySelector('.shelter-map-status')?.dataset.shelterResolved, choices: [...document.querySelectorAll('[data-shelter-checkpoint]')].filter((node) => node.dataset.checkpointChoice).map((node) => node.dataset.checkpointChoice) }))()`);
    if (matrix.hp !== String(hp) || matrix.resolved !== '3' || matrix.choices.join(',') !== checkpointNodeIds.map((id) => choices[id]).join(',')) {
      throw new Error(`Shelter choice matrix ${bits.toString(2).padStart(3, '0')} mismatch: ${JSON.stringify(matrix)}`);
    }
  }

  for (const routeCase of [
    { hp: 80, nodeId: 'north_supply_cache', target: 'evacuation_cache' },
    { hp: 30, nodeId: 'mimic_survivor_alpha', target: 'desperate_armory' },
    { hp: 60, nodeId: 'lower_return_portal', target: 'balanced_medbay' }
  ]) {
    const choices = { north_checkpoint: 'treat', central_checkpoint: 'push', south_checkpoint: 'treat' };
    await navigateWithState(makeShelterState({ nodeId: routeCase.nodeId, survivorHp: routeCase.hp, resolvedCheckpointChoices: choices, clearedNodeIds: [routeCase.nodeId] }), `${routeCase.target} route fixture renders`);
    await waitForPage(cdp, `document.querySelector('[data-action="grid-${routeCase.target}"]:not(:disabled)')`, `${routeCase.target} real route button enabled`);
    await clickElementByPointer(cdp, `[data-action="grid-${routeCase.target}"]`);
    await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === '${routeCase.target}'`, `${routeCase.target} entered through real map button`);
  }
  console.log('[smoke:shelter] eight choice sequences and three HP route buttons verified');

  await navigateWithState(makeShelterState({
    nodeId: 'shelter_overseer', survivorHp: 70, resolvedCheckpointChoices: { north_checkpoint: 'treat', central_checkpoint: 'push', south_checkpoint: 'treat' }, entryGear: { ...emptyGear, blackboxBeacon: true }
  }), 'shelter Boss snapshot fixture renders');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel .shelter-map-status[data-shelter-boss-snapshot="80"]')?.textContent.includes('幸存者 HP 80/100')`, 'Boss entry freezes beacon-adjusted survivor snapshot');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.combat-panel .shelter-map-status[data-shelter-boss-snapshot="80"]')`, 'Boss survivor snapshot remains readable after reload');
  console.log('[smoke:shelter] Boss snapshot and reload verified');

  const broadcastLaw = { kind: 'silent_broadcast_tower', noise: 0, pendingRelayNodeId: null, resolvedRelayChoices: {}, bossNoiseSnapshot: null, entryPassives: { hushblade: false, deadAirHeadset: false, anechoicMantle: false, lastChannelBeacon: false }, firstClashMutedUsed: false };
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_broadcast_portal', 'shelter_gate']]) {
    const source = makeExploreSave({ dungeonId: 'silent_broadcast_tower', nodeId: portalNodeId, inventory: { gate_sigil: 1 }, completedDungeonIds: [...SHELTER_PRIOR_DUNGEON_IDS], claimedTaskIds: [...SHELTER_PRIOR_MAINLINE_TASK_IDS] });
    source.run.lawState = makeDungeonLawState('silent_broadcast_tower', broadcastLaw);
    await navigateWithState(source, `Tier 15 ${portalNodeId} -> Tier 16 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'lost_shelter' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 15 ${portalNodeId} reaches Tier 16 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_shelter_portal', 'verdict_gate']]) {
    await navigateWithState(makeShelterState({
      nodeId: portalNodeId,
      inventory: { gate_sigil: 1 },
      completedDungeonIds: [...VERDICT_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...VERDICT_PRIOR_MAINLINE_TASK_IDS]
    }), `Tier 16 ${portalNodeId} -> Tier 17 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'false_testimony_court' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 16 ${portalNodeId} reaches Tier 17 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'upper_entry'], ['lower_return_portal', 'lower_entry'], ['return_testimony_portal', 'stage_gate']]) {
    await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 17 ${portalNodeId} -> Tier 18 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'combat_replay_stage' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 17 ${portalNodeId} reaches Tier 18 ${expectedTarget}`);
  }
  console.log('[smoke:shelter] 15 -> 16 -> 17 -> 1 portal chain verified');

  await navigateWithState(makeShelterState(), 'responsive Tier-16 map fixture renders');
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertResponsiveSurface(cdp, {
      width, height,
      rootSelector: '.dungeon-map[data-dungeon-id="lost_shelter"]',
      targetSelectors: ['.dungeon-map[data-dungeon-id="lost_shelter"]', '.shelter-map-status', '.node-action-panel'],
      buttonSelectors: ['.dungeon-map[data-dungeon-id="lost_shelter"] .grid-node:not(:disabled)'],
      minimumButtonHeight: 40, checkRootOverflow: true, label: `${width}x${height} Tier-16 map`
    });
    const geometry = await evaluate(cdp, `(() => { const pageWidth = document.documentElement.clientWidth; const nodes = [...document.querySelectorAll('.dungeon-map[data-dungeon-id="lost_shelter"] .grid-node')]; const records = nodes.map((node) => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, overflow: node.scrollWidth > node.clientWidth + 1 }; }); const distinct = (values) => [...new Set(values.map((value) => Math.round(value)))]; return { count: records.length, columns: distinct(records.map((node) => node.left)).length, rows: distinct(nodes.map((node) => node.getBoundingClientRect().top)).length, bad: records.filter((node) => node.width <= 0 || node.height < 40 || node.left < -1 || node.right > pageWidth + 1 || node.overflow) }; })()`);
    if (geometry.count !== 30 || geometry.columns !== 6 || geometry.rows !== 5 || geometry.bad.length) throw new Error(`Tier-16 map geometry mismatch at ${width}x${height}: ${JSON.stringify(geometry)}`);
  }
  console.log('[smoke:shelter] 390/1440 map geometry verified');

  const effects = makeShelterState({ nodeId: 'mimic_survivor', rewardPoints: 6543, log: ['shelter effects roundtrip'] });
  effects.phase = 'combat';
  effects.combat = { nodeId: 'mimic_survivor', monsterId: 'mimic_survivor', monsterHp: 100, turn: 2, guarding: false, weaponFocus: 1, effects: { mimicHesitation: true, shelterWardKind: 'art', evacuationPanicStacks: 2 }, log: ['shelter effects roundtrip'] };
  await navigateWithState(effects, 'valid shelter combat effects roundtrip');
  await waitForPage(cdp, `(() => { const effects = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.effects; return effects.mimicHesitation === true && effects.shelterWardKind === 'art' && effects.evacuationPanicStacks === 2; })()`, 'valid shelter effects survive v1 roundtrip');
  await evaluate(cdp, `(() => { const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})); payload.state.combat.effects.mimicHesitation = 'true'; payload.state.combat.effects.shelterWardKind = ['physical']; payload.state.combat.effects.evacuationPanicStacks = 3; payload.state.run.escortEntryGear = ['rescueCarbine']; localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload)); })()`);
  await cdp.send('Page.reload');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; const effects = saved.combat.effects; return saved.rewardPoints === 6543 && saved.log[0] === 'shelter effects roundtrip' && saved.run.escortEntryGear === undefined && saved.run.lawState.law.kind === 'lost_shelter' && effects.mimicHesitation === undefined && effects.shelterWardKind === undefined && effects.evacuationPanicStacks === undefined; })()`, 'malformed shelter effects and array pseudo-enums recover locally');

  const legacy = makeShelterState({ log: ['shelter legacy local recovery'] });
  delete legacy.inventory.rescue_badge;
  delete legacy.run.lawState;
  delete legacy.run.escortEntryGear;
  delete legacy.run.companionSnapshot;
  legacy.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, ...rescueGearIds];
  legacy.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, ...Object.fromEntries(rescueGearIds.map((id) => [id, 1])) };
  legacy.equipped = { ...BASIC_EQUIPPED, weapon: 'rescue_carbine', head: 'triage_visor', armor: 'evacuation_plate', charm: 'blackbox_beacon' };
  legacy.ownedCompanions = ['lu_guanlan']; legacy.companionRanks = { lu_guanlan: 2 }; legacy.activeCompanion = 'lu_guanlan';
  await navigateWithState(legacy, 'legacy shelter save local recovery');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.inventory.rescue_badge === 0 && saved.log[0] === 'shelter legacy local recovery' && saved.run.lawState.law.kind === 'lost_shelter' && Object.values(saved.run.lawState.law.entryGear).every((value) => value === false) && saved.run.lawState.law.entryCompanion.id === null && document.querySelectorAll('[data-shelter-entry-gear][data-frozen="false"]').length === 4 && document.querySelector('[data-shelter-companion-role="none"]'); })()`, 'legacy shelter run defaults locally without hub backfill');
  console.log('[smoke:shelter] v1 effects and legacy local recovery verified');

  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('.shelter-map-status') && innerWidth === 1440 && innerHeight === 900 && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'restart clears shelter state and restores empty 1440x900 home');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[role="dialog"][aria-modal="true"]')`, 'shelter smoke keeps clean home after reload');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(
    event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
  )) });
  if (browserErrors.length > 0) throw new Error(`Lost shelter smoke should have no console/resource/page errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] lost shelter: 19-card asset/material, 30-node 6x5 responsive map, four gear plus all companion R1/R2 freezes, hazard protection, exact treat/push atomics, 8 choice sequences, three HP routes, Boss snapshot reload, 15 -> 16 -> 17 -> 1 portals, strict v1 effects/recovery, and clean restart');
}

async function runFalseTestimonyCourtPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (nextState, label) => {
    await injectGameState(cdp, nextState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };
  const loadSavedStateAtNode = async (nodeId, label) => {
    const next = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
    next.phase = 'explore';
    delete next.combat;
    next.run.currentNodeId = nodeId;
    await navigateWithState(next, label);
    return next;
  };
  const evidenceIds = ['voice_evidence', 'timeline_evidence', 'residue_evidence'];
  const trapByEvidence = {
    voice_evidence: 'voice_filter_trap',
    timeline_evidence: 'timeline_checksum_trap',
    residue_evidence: 'residue_sterility_trap'
  };
  const counterByTrap = {
    voice_filter_trap: '定神香',
    timeline_checksum_trap: '破禁符',
    residue_sterility_trap: '护甲补片'
  };
  const eliminatedByEvidence = {
    voice_evidence: 'field_medic',
    timeline_evidence: 'security_chief',
    residue_evidence: 'records_keeper'
  };
  const suspects = ['records_keeper', 'field_medic', 'security_chief', 'route_surveyor'];
  const verdictGearIds = ['cross_examiner_sabre', 'forensic_visor', 'custody_shell', 'appeal_seal'];
  const emptyGear = { crossExaminerSabre: false, forensicVisor: false, custodyShell: false, appealSeal: false };
  const fullGear = { crossExaminerSabre: true, forensicVisor: true, custodyShell: true, appealSeal: true };
  const makeVerdictState = ({
    nodeId = 'verdict_gate',
    revealedEvidenceIds = [],
    contaminatedEvidenceIds = [],
    pendingVerdictNodeId = null,
    accusedSuspect = null,
    accusationCorrect = accusedSuspect === null ? null : accusedSuspect === 'route_surveyor',
    accusationTrustedCount = accusedSuspect === null ? 0 : revealedEvidenceIds.filter((id) => !contaminatedEvidenceIds.includes(id)).length,
    appealUsed = false,
    bossVerdictSnapshot = null,
    entryGear = emptyGear,
    custodyProtectionUsed = false,
    clearedNodeIds = [],
    rewardPoints = 5000,
    runRewardPoints = 0,
    inventory = {},
    log = ['false testimony pointer smoke save'],
    ...options
  } = {}) => {
    const requiredClears = [
      ...clearedNodeIds,
      ...revealedEvidenceIds,
      ...contaminatedEvidenceIds.map((id) => trapByEvidence[id]),
      ...(pendingVerdictNodeId ? [pendingVerdictNodeId] : [])
    ];
    const lawClears = [...new Set(requiredClears)];
    const next = makeExploreSave({
      dungeonId: 'false_testimony_court',
      nodeId,
      clearedNodeIds: lawClears,
      rewardPoints,
      inventory: {
        truth_fragment: 6,
        focus_incense: 9,
        dispel_talisman: 9,
        armor_patch: 9,
        gate_sigil: 9,
        ...inventory
      },
      lootBag: makeLootBag({ rewardPoints: runRewardPoints, items: { truth_fragment: 3 } }),
      completedDungeonIds: [...VERDICT_PRIOR_DUNGEON_IDS],
      claimedTaskIds: [...VERDICT_PRIOR_MAINLINE_TASK_IDS],
      player: { hp: 5100, maxHp: 5100, base: { body: 500, spirit: 2, agility: 2, luck: 1 } },
      log,
      ...options
    });
    next.run.falseTestimonyEntryGear = { ...entryGear };
    next.run.lawState = makeDungeonLawState('false_testimony_court', {
      kind: 'false_testimony_court',
      revealedEvidenceIds: [...revealedEvidenceIds],
      contaminatedEvidenceIds: [...contaminatedEvidenceIds],
      pendingVerdictNodeId,
      accusedSuspect,
      accusationCorrect,
      accusationTrustedCount,
      appealUsed,
      bossVerdictSnapshot: bossVerdictSnapshot ? structuredClone(bossVerdictSnapshot) : null,
      entryGear: { ...entryGear },
      custodyProtectionUsed
    }, { clearedNodeIds: lawClears });
    return next;
  };
  const makeVerdictHub = () => {
    const next = makeVerdictState();
    next.phase = 'hub';
    delete next.run;
    next.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, ...verdictGearIds];
    next.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, ...Object.fromEntries(verdictGearIds.map((id) => [id, 3])) };
    next.equipped = {
      ...BASIC_EQUIPPED,
      weapon: 'cross_examiner_sabre',
      head: 'forensic_visor',
      armor: 'custody_shell',
      charm: 'appeal_seal'
    };
    return next;
  };
  const makePendingVerdict = (trustedCount, { suspect = null, entryGear = emptyGear, appeal = false } = {}) => {
    const revealedEvidenceIds = evidenceIds.slice(0, trustedCount);
    return makeVerdictState({
      nodeId: appeal ? 'appeal_desk' : 'verdict_chamber',
      revealedEvidenceIds,
      pendingVerdictNodeId: appeal ? 'appeal_desk' : 'verdict_chamber',
      accusedSuspect: suspect,
      accusationCorrect: suspect === null ? null : suspect === 'route_surveyor',
      accusationTrustedCount: suspect === null ? 0 : trustedCount,
      entryGear
    });
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
    document.querySelector('.dungeon-card[data-dungeon-id="false_testimony_court"]')?.textContent.includes('Tier 17') &&
    document.querySelector('.dungeon-card[data-dungeon-id="false_testimony_court"]')?.textContent.includes('1140') &&
    document.querySelector('.false-testimony-court-banner')?.complete && document.body.textContent.includes('真证碎片')`, 'clean Tier-17 verdict hub');
  const catalog = await evaluate(cdp, `(() => ({
    cards: document.querySelectorAll('.dungeon-card').length,
    matureEquipment: document.querySelectorAll('.shop-card.equipment-card').length,
    verdictGear: ${JSON.stringify(verdictGearIds)}.filter((id) => document.querySelector('[data-equipment-id="' + id + '"]')).length,
    material: document.body.textContent.includes('真证碎片')
  }))()`);
  if (catalog.cards !== 19 || catalog.matureEquipment !== 56 || catalog.verdictGear !== 4 || !catalog.material) {
    throw new Error(`Tier-17 catalog mismatch: ${JSON.stringify(catalog)}`);
  }
  const asset = await evaluate(cdp, `(() => {
    const image = document.querySelector('.false-testimony-court-banner');
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) return { loaded: false };
    const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 18;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 72, 18);
    const pixels = context.getImageData(0, 0, 72, 18).data; const colors = new Set(); let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) { if (pixels[index + 3] > 0) opaque += 1; colors.add(pixels.slice(index, index + 4).join(',')); }
    return { loaded: true, natural: [image.naturalWidth, image.naturalHeight], colors: colors.size, opaque, alt: image.alt };
  })()`);
  if (!asset.loaded || asset.natural?.join('x') !== '720x180' || asset.colors < 8 || asset.opaque < 100 ||
    !asset.alt?.includes('三座证据灯箱') || !asset.alt?.includes('四名嫌疑人') || !asset.alt?.includes('主审席')) {
    throw new Error(`Tier-17 verdict asset mismatch: ${JSON.stringify(asset)}`);
  }
  console.log('[smoke:verdict] 19-card catalog, 56 mature equipment, material, four gear, and original 720x180 asset verified');

  await navigateWithState(makeVerdictHub(), 'full verdict gear hub renders');
  await clickElementByPointer(cdp, '[data-action="enter-false_testimony_court"]');
  await waitForPage(cdp, `document.querySelectorAll('[data-verdict-entry-gear][data-frozen="true"]').length === 4 &&
    document.querySelector('.verdict-map-status')?.dataset.verdictCustodyUsed === 'false'`, 'four verdict gear freeze through real entry');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelectorAll('[data-verdict-entry-gear][data-frozen="true"]').length === 4`, 'four verdict gear remain frozen after reload');

  await navigateWithState(makeVerdictState(), 'responsive verdict map fixture renders');
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await assertResponsiveSurface(cdp, {
      width, height,
      rootSelector: '.dungeon-map[data-dungeon-id="false_testimony_court"]',
      targetSelectors: ['.dungeon-map[data-dungeon-id="false_testimony_court"]', '.verdict-map-status', '.node-action-panel'],
      buttonSelectors: ['.dungeon-map[data-dungeon-id="false_testimony_court"] .grid-node:not(:disabled)'],
      minimumButtonHeight: 40, checkRootOverflow: true, label: `${width}x${height} Tier-17 map`
    });
    const geometry = await evaluate(cdp, `(() => { const pageWidth = document.documentElement.clientWidth; const nodes = [...document.querySelectorAll('.dungeon-map[data-dungeon-id="false_testimony_court"] .grid-node')]; const records = nodes.map((node) => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, overflow: node.scrollWidth > node.clientWidth + 1 }; }); const distinct = (values) => [...new Set(values.map((value) => Math.round(value)))]; return { count: records.length, columns: distinct(records.map((node) => node.left)).length, rows: distinct(nodes.map((node) => node.getBoundingClientRect().top)).length, bad: records.filter((node) => node.width <= 0 || node.height < 40 || node.left < -1 || node.right > pageWidth + 1 || node.overflow) }; })()`);
    if (geometry.count !== 30 || geometry.columns !== 6 || geometry.rows !== 5 || geometry.bad.length) {
      throw new Error(`Tier-17 map geometry mismatch at ${width}x${height}: ${JSON.stringify(geometry)}`);
    }
  }
  console.log('[smoke:verdict] 30-node 6x5 geometry verified at 390 and 1440');

  for (const evidenceId of evidenceIds) {
    const trapId = trapByEvidence[evidenceId];
    await navigateWithState(makeVerdictState({ nodeId: trapId }), `${trapId} counter fixture renders`);
    await clickButtonByPointer(cdp, `使用 ${counterByTrap[trapId]}`, '.node-action-panel');
    await waitForPage(cdp, `(() => { const law = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law; return !law.contaminatedEvidenceIds.includes('${evidenceId}'); })()`, `${trapId} counter preserves clean evidence`);

    await navigateWithState(makeVerdictState({ nodeId: trapId }), `${trapId} risk fixture renders`);
    await clickButtonByPointer(cdp, '冒险检定', '.node-action-panel');
    await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.contaminatedEvidenceIds.includes('${evidenceId}')`, `${trapId} risk contaminates evidence`);
  }
  await navigateWithState(makeVerdictState({ nodeId: 'voice_filter_trap', entryGear: { ...emptyGear, custodyShell: true } }), 'custody first protection fixture renders');
  await clickButtonByPointer(cdp, '冒险检定', '.node-action-panel');
  await waitForPage(cdp, `(() => { const law = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law; return law.custodyProtectionUsed && law.contaminatedEvidenceIds.length === 0; })()`, 'custody shell protects first contamination');
  await loadSavedStateAtNode('timeline_checksum_trap', 'custody second trap renders');
  await clickButtonByPointer(cdp, '冒险检定', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.contaminatedEvidenceIds.includes('timeline_evidence')`, 'custody shell does not protect second contamination');
  await navigateWithState(makeVerdictState({ entryGear: { ...emptyGear, forensicVisor: true } }), 'forensic visor baseline fixture renders');
  await waitForPage(cdp, `document.querySelector('.verdict-map-status [data-verdict-eliminated]')?.dataset.verdictEliminated.includes('field_medic') && document.querySelector('.verdict-map-status')?.dataset.verdictTrustedCount === '0'`, 'forensic visor baseline excludes field medic without adding trusted evidence');
  console.log('[smoke:verdict] all three counter/risk contaminations, custody first protection, and visor baseline exclusion verified');

  const permutations = [
    ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
    ['voice_evidence', 'residue_evidence', 'timeline_evidence'],
    ['timeline_evidence', 'voice_evidence', 'residue_evidence'],
    ['timeline_evidence', 'residue_evidence', 'voice_evidence'],
    ['residue_evidence', 'voice_evidence', 'timeline_evidence'],
    ['residue_evidence', 'timeline_evidence', 'voice_evidence']
  ];
  for (const [permutationIndex, order] of permutations.entries()) {
    await navigateWithState(makeVerdictState(), `evidence permutation ${permutationIndex + 1} starts`);
    for (const [index, evidenceId] of order.entries()) {
      const trapId = trapByEvidence[evidenceId];
      await loadSavedStateAtNode(trapId, `permutation ${permutationIndex + 1} ${trapId} renders`);
      await clickButtonByPointer(cdp, `使用 ${counterByTrap[trapId]}`, '.node-action-panel');
      await loadSavedStateAtNode(evidenceId, `permutation ${permutationIndex + 1} ${evidenceId} renders`);
      await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
      await waitForPage(cdp, `document.querySelector('[data-verdict-evidence="${evidenceId}"][data-evidence-state="trusted"]') && document.querySelector('.verdict-map-status')?.dataset.verdictTrustedCount === '${index + 1}'`, `permutation ${permutationIndex + 1} reveals ${evidenceId}`);
    }
    const orderEvidence = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.lawState.law.revealedEvidenceIds`);
    if (orderEvidence.join(',') !== order.join(',')) throw new Error(`Evidence order mismatch: ${JSON.stringify({ order, orderEvidence })}`);
  }
  console.log('[smoke:verdict] all six evidence orders resolve through real trap and reward buttons');

  const baseRewards = { 1: 480, 2: 320, 3: 160 };
  for (const trustedCount of [1, 2, 3]) {
    for (const withSabre of [false, true]) {
      const entryGear = { ...emptyGear, crossExaminerSabre: withSabre };
      await navigateWithState(makePendingVerdict(trustedCount, { entryGear }), `${trustedCount}-trusted sabre=${withSabre} verdict renders`);
      const expectedReward = baseRewards[trustedCount] + (withSabre ? 120 : 0);
      await waitForPage(cdp, `document.querySelector('.verdict-choice-fieldset[data-verdict-correct-reward="${expectedReward}"]') && document.querySelectorAll('[data-verdict-choice]').length === 4`, `${trustedCount}-trusted projected reward is exact`);
      await clickElementByPointer(cdp, '[data-verdict-choice="route_surveyor"]');
      await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.rewardPoints === ${5000 + expectedReward} && saved.run.lootBag.rewardPoints === ${expectedReward} && saved.run.lawState.law.accusationTrustedCount === ${trustedCount} && !document.querySelector('.verdict-choice-fieldset'); })()`, `${trustedCount}-trusted correct verdict pays exact frozen reward`);
    }
  }
  for (const suspect of suspects) {
    await navigateWithState(makePendingVerdict(1), `${suspect} verdict fixture renders`);
    await clickElementByPointer(cdp, `[data-verdict-choice="${suspect}"]`);
    const expectedCorrect = suspect === 'route_surveyor';
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.lawState.law.accusationCorrect === ${expectedCorrect} && saved.rewardPoints === ${expectedCorrect ? 5480 : 5000}; })()`, `${suspect} verdict result is exact`);
  }
  console.log('[smoke:verdict] 1/2/3 frozen rewards, sabre bonus, and all four suspects verified');

  const branchCases = [
    {
      label: 'truth', target: 'truth_archive', source: 'voice_evidence',
      state: makeVerdictState({ revealedEvidenceIds: [...evidenceIds], accusedSuspect: 'route_surveyor', accusationTrustedCount: 3, clearedNodeIds: ['voice_evidence'] })
    },
    {
      label: 'swift', target: 'swift_judgment_armory', source: 'archive_censor_alpha',
      state: makeVerdictState({ revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'], accusedSuspect: 'route_surveyor', accusationTrustedCount: 1, clearedNodeIds: ['archive_censor_alpha'] })
    },
    {
      label: 'false', target: 'false_verdict_vault', source: 'soul_recharge_verdict',
      state: makeVerdictState({ revealedEvidenceIds: ['voice_evidence'], accusedSuspect: 'records_keeper', accusationTrustedCount: 1, clearedNodeIds: ['soul_recharge_verdict'] })
    }
  ];
  for (const branch of branchCases) {
    branch.state.run.currentNodeId = branch.source;
    await navigateWithState(branch.state, `${branch.label} specialization route renders`);
    await waitForPage(cdp, `document.querySelector('[data-action="grid-${branch.target}"]:not(:disabled)')`, `${branch.label} specialization real map button enabled`);
    await clickElementByPointer(cdp, `[data-action="grid-${branch.target}"]`);
    await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === '${branch.target}'`, `${branch.label} specialization entered through real map button`);
  }

  const frozenOne = makeVerdictState({ revealedEvidenceIds: [...evidenceIds], accusedSuspect: 'route_surveyor', accusationTrustedCount: 1 });
  frozenOne.run.currentNodeId = 'truth_archive';
  await navigateWithState(frozenOne, 'one-frozen truth archive fixture renders');
  await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.lawState.law.accusationTrustedCount === 1 && saved.run.lawState.law.revealedEvidenceIds.length === 3 && !saved.run.clearedNodeIds.includes('truth_archive'); })()`, 'later evidence does not reroute frozen one-trusted verdict into truth archive');
  frozenOne.run.currentNodeId = 'swift_judgment_armory';
  await navigateWithState(frozenOne, 'one-frozen swift armory fixture renders');
  await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
  await waitForPage(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.clearedNodeIds.includes('swift_judgment_armory')`, 'frozen one-trusted verdict enters swift armory after later evidence');
  console.log('[smoke:verdict] truth/swift/false specializations and original frozen-count routing verified');

  const appealGear = { ...emptyGear, appealSeal: true };
  await navigateWithState(makePendingVerdict(1, { suspect: 'records_keeper', entryGear: appealGear, appeal: true }), 'appeal verdict fixture renders');
  await waitForPage(cdp, `document.querySelector('.verdict-choice-fieldset[data-verdict-choice-node="appeal_desk"]')?.textContent.includes('翻案资格：可用')`, 'appeal seal exposes one non-modal appeal');
  await clickElementByPointer(cdp, '[data-verdict-choice="route_surveyor"]');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; const law = saved.run.lawState.law; return saved.rewardPoints === 5000 && law.accusationCorrect === true && law.accusationTrustedCount === 1 && law.appealUsed === true && document.querySelector('.verdict-map-status')?.dataset.verdictAppealUsed === 'true'; })()`, 'appeal corrects verdict without reward or frozen-count rewrite');

  const wrongBeforeVault = makeVerdictState({ nodeId: 'false_verdict_vault', revealedEvidenceIds: ['voice_evidence'], accusedSuspect: 'records_keeper', accusationTrustedCount: 1, entryGear: appealGear });
  await navigateWithState(wrongBeforeVault, 'false vault first fixture renders');
  await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
  await loadSavedStateAtNode('appeal_desk', 'appeal desk after false vault renders');
  await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.clearedNodeIds.includes('false_verdict_vault') && saved.run.lawState.law.pendingVerdictNodeId === null && !document.querySelector('.verdict-choice-fieldset'); })()`, 'taking false vault first permanently blocks appeal');
  console.log('[smoke:verdict] appeal seal and false-vault-first exclusion verified');

  const bossFixture = makeVerdictState({ nodeId: 'false_testimony_judge', revealedEvidenceIds: [...evidenceIds], accusedSuspect: 'route_surveyor', accusationTrustedCount: 3 });
  await navigateWithState(bossFixture, 'verdict Boss snapshot fixture renders');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel .verdict-map-status[data-verdict-boss-snapshot="route_surveyor:3:false"]') && document.querySelector('.boss-combat-status')`, 'Boss combat freezes verdict snapshot');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.combat-panel .verdict-map-status[data-verdict-boss-snapshot="route_surveyor:3:false"]')`, 'Boss verdict snapshot remains readable after reload');
  await evaluate(cdp, `(() => { const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})); payload.state.combat.effects = { witnessContradiction: true, censorSealKind: 'art', perjuryPressureStacks: 2 }; localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload)); })()`);
  await cdp.send('Page.reload');
  await waitForPage(cdp, `(() => { const effects = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.combat.effects; return effects.witnessContradiction === true && effects.censorSealKind === 'art' && effects.perjuryPressureStacks === 2; })()`, 'valid verdict combat effects survive v1 reload');
  await evaluate(cdp, `(() => { const payload = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})); payload.state.combat.effects.witnessContradiction = [true]; payload.state.combat.effects.censorSealKind = ['attack']; payload.state.combat.effects.perjuryPressureStacks = [2]; payload.state.run.falseTestimonyEntryGear = ['crossExaminerSabre']; payload.state.rewardPoints = 7654; payload.state.log = ['verdict malformed local recovery']; localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(payload)); })()`);
  await cdp.send('Page.reload');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; const effects = saved.combat.effects; return saved.rewardPoints === 7654 && saved.log[0] === 'verdict malformed local recovery' && saved.run.lawState.law.kind === 'false_testimony_court' && saved.run.falseTestimonyEntryGear === undefined && effects.witnessContradiction === undefined && effects.censorSealKind === undefined && effects.perjuryPressureStacks === undefined; })()`, 'malformed verdict effects and array pseudo-enums recover locally');

  const legacy = makeVerdictState({ log: ['verdict legacy local recovery'] });
  delete legacy.inventory.truth_fragment;
  delete legacy.run.lawState;
  delete legacy.run.falseTestimonyEntryGear;
  legacy.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, ...verdictGearIds];
  legacy.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, ...Object.fromEntries(verdictGearIds.map((id) => [id, 1])) };
  legacy.equipped = { ...BASIC_EQUIPPED, weapon: 'cross_examiner_sabre', head: 'forensic_visor', armor: 'custody_shell', charm: 'appeal_seal' };
  await navigateWithState(legacy, 'legacy verdict save local recovery');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.inventory.truth_fragment === 0 && saved.log[0] === 'verdict legacy local recovery' && saved.run.lawState.law.kind === 'false_testimony_court' && Object.values(saved.run.lawState.law.entryGear).every((value) => value === false) && document.querySelectorAll('[data-verdict-entry-gear][data-frozen="false"]').length === 4; })()`, 'legacy verdict run defaults locally without hub equipment backfill');
  console.log('[smoke:verdict] Boss snapshot, strict combat effects, malformed save recovery, and legacy no-backfill verified');

  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'north_entry'], ['lower_return_portal', 'lower_entry'], ['return_shelter_portal', 'verdict_gate']]) {
    await navigateWithState(makeLostShelterExploreSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 16 ${portalNodeId} to Tier 17 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'false_testimony_court' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 16 ${portalNodeId} reaches Tier 17 ${expectedTarget}`);
  }
  for (const [portalNodeId, expectedTarget] of [['upper_return_portal', 'upper_entry'], ['lower_return_portal', 'lower_entry'], ['return_testimony_portal', 'stage_gate']]) {
    await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: portalNodeId, inventory: { gate_sigil: 1 } }), `Tier 17 ${portalNodeId} to Tier 18 renders`);
    await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
    await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'combat_replay_stage' && saved.run.currentNodeId === '${expectedTarget}'; })()`, `Tier 17 ${portalNodeId} reaches Tier 18 ${expectedTarget}`);
  }

  await navigateWithState(makePendingVerdict(1), 'pending verdict access fixture renders');
  await waitForPage(cdp, `(() => { const fieldset = document.querySelector('.verdict-choice-fieldset'); const movable = [...document.querySelectorAll('.dungeon-map .grid-node')].filter((node) => !node.classList.contains('current') && !node.disabled); const triggers = ['.character-trigger','.task-trigger','.companion-trigger','.method-trigger','.bloodline-trigger'].map((selector) => document.querySelector(selector)); const retreat = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('撤回主神空间')); return fieldset && !fieldset.closest('[role="dialog"][aria-modal="true"]') && document.querySelectorAll('[data-verdict-choice]').length === 4 && fieldset.textContent.includes('三证状态') && fieldset.textContent.includes('已排除者') && fieldset.textContent.includes('当前裁决') && fieldset.textContent.includes('正确奖励预估') && fieldset.textContent.includes('维持原判') && movable.length === 0 && triggers.every((trigger) => trigger && !trigger.disabled) && retreat && !retreat.disabled; })()`, 'pending verdict is non-modal and locks only map movement');
  await openCharacterSheet(cdp, 'pending verdict');
  await assertEscapeClosesCharacterSheet(cdp, 'pending verdict');
  await openTaskModal(cdp, 'pending verdict');
  await assertEscapeClosesTaskModal(cdp, 'pending verdict');
  for (const [label, selector] of [['小队', '.companion-sheet'], ['功法', '.method-sheet'], ['血统', '.bloodline-sheet']]) {
    await clickButtonByPointer(cdp, label, '.topbar');
    await waitForPage(cdp, `document.querySelector(${JSON.stringify(selector)})`, `pending verdict opens ${label}`);
    await pressEscape(cdp);
    await waitForPage(cdp, `!document.querySelector(${JSON.stringify(selector)})`, `pending verdict closes ${label}`);
  }

  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('.verdict-map-status') && innerWidth === 1440 && innerHeight === 900 && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'restart clears verdict state and restores empty 1440x900 home');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('[role="dialog"][aria-modal="true"]')`, 'verdict smoke keeps clean home after reload');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(
    event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
  )) });
  if (browserErrors.length > 0) throw new Error(`False testimony smoke should have no console/resource/page errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] false testimony court: 19-card asset/material, 30-node 6x5 map, four frozen gear, strict three-evidence verdicts, original-count rewards/routes, appeal exclusion, Boss reload, 16 -> 17 -> 1 portals, v1 recovery, and clean restart');
}

async function runCombatReplayStagePointerSmoke(cdp, appUrl) {
  const navigateWithState = async (nextState, label) => {
    await injectGameState(cdp, nextState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };
  const loadSavedStateAtNode = async (nodeId, label) => {
    const next = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
    next.phase = 'explore';
    delete next.combat;
    next.run.currentNodeId = nodeId;
    await navigateWithState(next, label);
  };
  const replayGearIds = ['frame_engraver', 'cue_visor', 'buffer_plate', 'thaw_metronome'];
  const fullGear = { frameEngraver: true, cueVisor: true, bufferPlate: true, thawMetronome: true };
  const completeRecordings = {
    take_alpha: { action: 'attack', observedValue: 312 },
    take_beta: { action: 'art', observedValue: 286 },
    take_gamma: { action: 'guard', observedValue: 144 }
  };
  const makeReplayHub = () => {
    const next = makeCombatReplayExploreSave({
      rewardPoints: 12000,
      lingyun: 30,
      inventory: { combat_reel: 6, gate_sigil: 6 },
      player: { hp: 6000, maxHp: 6000, base: { body: 500, spirit: 500, agility: 40, luck: 5 } }
    });
    next.phase = 'hub';
    delete next.run;
    next.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, ...replayGearIds];
    next.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, ...Object.fromEntries(replayGearIds.map((id) => [id, 3])) };
    next.equipped = {
      ...BASIC_EQUIPPED,
      weapon: 'frame_engraver',
      head: 'cue_visor',
      armor: 'buffer_plate',
      charm: 'thaw_metronome'
    };
    return next;
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
    document.querySelector('.dungeon-card[data-dungeon-id="combat_replay_stage"]')?.textContent.includes('Tier 18') &&
    document.querySelector('.dungeon-card[data-dungeon-id="combat_replay_stage"]')?.textContent.includes('1240') &&
    document.querySelector('.combat-replay-stage-banner')?.complete && document.body.textContent.includes('战斗母带')`, 'clean Tier-18 replay hub');
  const catalog = await evaluate(cdp, `(() => ({
    cards: document.querySelectorAll('.dungeon-card').length,
    matureEquipment: document.querySelectorAll('.shop-card.equipment-card').length,
    replayGear: ${JSON.stringify(replayGearIds)}.filter((id) => document.querySelector('[data-equipment-id="' + id + '"]')).length,
    material: document.body.textContent.includes('战斗母带')
  }))()`);
  if (catalog.cards !== 19 || catalog.matureEquipment !== 56 || catalog.replayGear !== 4 || !catalog.material) {
    throw new Error(`Tier-18 replay catalog mismatch: ${JSON.stringify(catalog)}`);
  }
  const asset = await evaluate(cdp, `(async () => {
    const image = document.querySelector('.combat-replay-stage-banner');
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) return { loaded: false };
    const svg = await fetch(image.src).then((response) => response.text());
    const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 18;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 72, 18);
    const pixels = context.getImageData(0, 0, 72, 18).data; const colors = new Set(); let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) { if (pixels[index + 3] === 255) opaque += 1; colors.add(pixels.slice(index, index + 4).join(',')); }
    return { loaded: true, natural: [image.naturalWidth, image.naturalHeight], colors: colors.size, opaque, alt: image.alt, exactViewBox: /viewBox="0 0 720 180"/.test(svg) };
  })()`);
  if (!asset.loaded || asset.natural?.join('x') !== '720x180' || !asset.exactViewBox || asset.colors < 8 || asset.opaque < 100 ||
    !asset.alt?.includes('战痕复演场') || !asset.alt?.includes('母带')) {
    throw new Error(`Tier-18 replay asset mismatch: ${JSON.stringify(asset)}`);
  }
  console.log('[smoke:replay] 19-card catalog, 56 mature equipment, replay material, and original 720x180 asset verified');

  await navigateWithState(makeReplayHub(), 'full replay gear hub renders');
  await clickElementByPointer(cdp, '[data-action="enter-combat_replay_stage"]');
  await waitForPage(cdp, `document.querySelectorAll('[data-replay-entry-gear][data-frozen="true"]').length === 4 &&
    document.querySelector('.combat-replay-map-status')?.dataset.replayRecordedCount === '0'`, 'four replay gear freeze through real entry');
  let recordingState = await evaluate(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state`);
  recordingState.player = { ...recordingState.player, hp: 6000, maxHp: 6000, base: { body: 500, spirit: 500, agility: 40, luck: 5 } };
  recordingState.run.currentNodeId = 'take_alpha';
  await navigateWithState(recordingState, 'take alpha recording renders');

  const recordTake = async (nodeId, actionLabel, count, action) => {
    await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
    await waitForPage(cdp, `document.querySelector('.combat-panel')`, `${nodeId} combat starts`);
    await clickButtonByPointer(cdp, actionLabel, '.combat-panel');
    await waitForPage(cdp, `document.querySelector('.combat-replay-map-status')?.dataset.replayRecordedCount === '${count}' &&
      document.querySelector('[data-replay-take="${nodeId}"][data-replay-action="${action}"][data-replay-observed-value]:not([data-replay-observed-value="none"])')`, `${nodeId} records ${action}`);
    if (await evaluate(cdp, `Boolean(document.querySelector('.combat-panel'))`)) {
      await finishActiveCombatByAttack(cdp, `${nodeId} recording`);
    }
  };
  await recordTake('take_alpha', '攻击', 1, 'attack');
  await loadSavedStateAtNode('take_beta', 'take beta recording renders');
  await recordTake('take_beta', '功法', 2, 'art');
  await loadSavedStateAtNode('take_gamma', 'take gamma recording renders');
  await recordTake('take_gamma', '防御', 3, 'guard');
  await waitForPage(cdp, `document.querySelectorAll('[data-replay-route-choice]').length === 3`, 'three replay routes appear after recording');
  await clickElementByPointer(cdp, '[data-replay-route-choice="sequence"]');
  await waitForPage(cdp, `document.querySelector('.combat-replay-map-status')?.dataset.replayRoute === 'sequence' &&
    document.querySelector('[data-replay-route-result="sequence"]')`, 'sequence route locks through real pointer');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.combat-replay-map-status[data-replay-recorded-count="3"][data-replay-route="sequence"]')`, 'three recordings and route survive reload');
  console.log('[smoke:replay] three action/value recordings, three route choices, route lock, and reload verified');

  await loadSavedStateAtNode('final_cut_director', 'replay Boss node renders');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel .combat-replay-map-status[data-replay-boss-snapshot="frozen"]') &&
    document.querySelector('.boss-combat-status')`, 'replay Boss freezes snapshot');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.combat-panel .combat-replay-map-status[data-replay-boss-snapshot="frozen"]')`, 'replay Boss snapshot survives reload');
  await finishActiveCombatByAttack(cdp, 'replay Boss');
  if (await evaluate(cdp, `Boolean(document.querySelector('.equipment-loot-offer'))`)) {
    await clickButtonByPointer(cdp, '放弃', '.node-action-panel');
  }
  await loadSavedStateAtNode('theater_exit', 'replay exit renders');
  await clickButtonByPointer(cdp, '完成副本', '.node-action-panel');
  await waitForPage(cdp, `document.body.textContent.includes('结算') && document.body.textContent.includes('战斗母带')`, 'replay exit settles');
  console.log('[smoke:replay] Boss snapshot reload and exit settlement verified');

  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await navigateWithState(makeCombatReplayExploreSave({ recordings: completeRecordings, route: 'sequence', entryGear: fullGear }), `${width}x${height} replay map fixture renders`);
    await assertResponsiveSurface(cdp, {
      width, height,
      rootSelector: '.dungeon-map[data-dungeon-id="combat_replay_stage"]',
      targetSelectors: ['.dungeon-map[data-dungeon-id="combat_replay_stage"]', '.combat-replay-map-status', '.node-action-panel'],
      buttonSelectors: ['.dungeon-map[data-dungeon-id="combat_replay_stage"] .grid-node:not(:disabled)'],
      minimumButtonHeight: 40, checkRootOverflow: true, label: `${width}x${height} Tier-18 replay map`
    });
    const geometry = await evaluate(cdp, `(() => {
      const pageWidth = document.documentElement.clientWidth;
      const nodes = [...document.querySelectorAll('.dungeon-map[data-dungeon-id="combat_replay_stage"] .grid-node')];
      const records = nodes.map((node) => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, overflow: node.scrollWidth > node.clientWidth + 1 }; });
      const distinct = (values) => [...new Set(values.map((value) => Math.round(value)))];
      const widths = records.map((node) => node.width);
      return { count: records.length, columns: distinct(records.map((node) => node.left)).length, rows: distinct(nodes.map((node) => node.getBoundingClientRect().top)).length, minWidth: Math.min(...widths), widthDelta: Math.max(...widths) - Math.min(...widths), minHeight: Math.min(...records.map((node) => node.height)), overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > pageWidth + 1, bad: records.filter((node) => node.left < -1 || node.right > pageWidth + 1 || node.overflow) };
    })()`);
    const minimumHeight = width === 390 ? 86 : 40;
    if (geometry.count !== 30 || geometry.columns !== 6 || geometry.rows !== 5 || geometry.minWidth < 44 || geometry.widthDelta > 1 || geometry.minHeight < minimumHeight || geometry.overflowX || geometry.bad.length) {
      throw new Error(`Tier-18 replay geometry mismatch at ${width}x${height}: ${JSON.stringify(geometry)}`);
    }
  }
  console.log('[smoke:replay] 390x844 and 1440x900 six-column geometry verified');

  await navigateWithState(makeFalseTestimonyReplayPortalSave({ nodeId: 'return_testimony_portal', inventory: { gate_sigil: 1 } }), 'Tier 17 to Tier 18 portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'combat_replay_stage' && saved.run.currentNodeId === 'stage_gate' && document.querySelector('.combat-replay-map-status'); })()`, 'Tier 17 portal reaches replay stage');
  await navigateWithState(makeCombatReplayPanopticonPortalSave({ nodeId: 'return_rehearsal_portal', inventory: { gate_sigil: 1 } }), 'Tier 18 to Tier 19 portal renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'panopticon_city' && saved.run.currentNodeId === 'panopticon_gate' && document.querySelector('.panopticon-law-status'); })()`, 'Tier 18 portal reaches Tier 19 panopticon city');

  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('.combat-replay-map-status') && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'restart clears replay state');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'replay smoke keeps clean home after reload');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(
    event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
  )) });
  if (browserErrors.length > 0) throw new Error(`Combat replay smoke should have no console/resource/page errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] combat replay stage: 19-card/56-gear catalog, original asset, three recordings, route, Boss/exit, reload/restart, 17 -> 18 -> 19 portals, and responsive geometry pass');
}

async function runPanopticonCityPointerSmoke(cdp, appUrl) {
  const navigateWithState = async (nextState, label) => {
    await injectGameState(cdp, nextState);
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForPage(cdp, `document.querySelector('.shell')`, label);
  };
  const panopticonGearIds = ['blindline_cutter', 'predictive_visor', 'matte_shell', 'inverse_prism'];
  const fullGear = { blindlineCutter: true, predictiveVisor: true, matteShell: true, inversePrism: true };
  const allRelays = { north_blind_relay: true, central_blind_relay: true, south_blind_relay: true };
  const makePanopticonHub = () => {
    const next = makePanopticonExploreSave({
      rewardPoints: 16000,
      lingyun: 40,
      inventory: { observation_shard: 6, gate_sigil: 8, healing_pill: 8, focus_incense: 4, dispel_talisman: 4, armor_patch: 4 },
      player: { hp: 7000, maxHp: 7000, base: { body: 560, spirit: 560, agility: 48, luck: 6 } }
    });
    next.phase = 'hub';
    delete next.run;
    next.ownedEquipment = [...BASIC_OWNED_EQUIPMENT, ...panopticonGearIds];
    next.equipmentLevels = { ...BASIC_EQUIPMENT_LEVELS, ...Object.fromEntries(panopticonGearIds.map((id) => [id, 3])) };
    next.equipped = {
      ...BASIC_EQUIPPED,
      weapon: 'blindline_cutter',
      head: 'predictive_visor',
      armor: 'matte_shell',
      charm: 'inverse_prism'
    };
    return next;
  };
  const collectCurrentReward = async (label) => {
    await clickButtonByPointer(cdp, '收取奖励', '.node-action-panel');
    await waitForPage(cdp, `document.querySelector('.grid-node.current.cleared')`, `${label} reward clears`);
  };
  const moveToReward = async (title, label) => {
    await clickGridCell(cdp, title);
    await waitForPage(cdp, `document.querySelector('.grid-node.current')?.textContent.includes(${JSON.stringify(title)})`, `${label} movement lands`);
    await collectCurrentReward(label);
  };

  cdp.events.length = 0;
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await setViewport(cdp, 1440, 900);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
    document.querySelector('.dungeon-card[data-dungeon-id="panopticon_city"]')?.textContent.includes('Tier 19') &&
    document.querySelector('.dungeon-card[data-dungeon-id="panopticon_city"]')?.textContent.includes('1350') &&
    document.querySelector('.panopticon-city-banner')?.complete && document.body.textContent.includes('观测棱片')`, 'clean Tier-19 panopticon hub');
  const catalog = await evaluate(cdp, `(() => ({
    cards: document.querySelectorAll('.dungeon-card').length,
    matureEquipment: document.querySelectorAll('.shop-card.equipment-card').length,
    panopticonGear: ${JSON.stringify(panopticonGearIds)}.filter((id) => document.querySelector('[data-equipment-id="' + id + '"]')).length,
    material: document.body.textContent.includes('观测棱片')
  }))()`);
  if (catalog.cards !== 19 || catalog.matureEquipment !== 56 || catalog.panopticonGear !== 4 || !catalog.material) {
    throw new Error(`Tier-19 panopticon catalog mismatch: ${JSON.stringify(catalog)}`);
  }
  const asset = await evaluate(cdp, `(async () => {
    const image = document.querySelector('.panopticon-city-banner');
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) return { loaded: false };
    const svg = await fetch(image.src).then((response) => response.text());
    const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const svgRoot = svgDocument.documentElement;
    const title = svgDocument.querySelector('title')?.textContent ?? '';
    const description = svgDocument.querySelector('desc')?.textContent ?? '';
    const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 18;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 72, 18);
    const pixels = context.getImageData(0, 0, 72, 18).data; const colors = new Set(); let opaque = 0;
    for (let index = 0; index < pixels.length; index += 4) { if (pixels[index + 3] === 255) opaque += 1; colors.add(pixels.slice(index, index + 4).join(',')); }
    return {
      loaded: true,
      natural: [image.naturalWidth, image.naturalHeight],
      colors: colors.size,
      opaque,
      alt: image.alt,
      exactViewBox: svgRoot.getAttribute('viewBox') === '0 0 720 180',
      hasTitle: title.includes('天幕监察城'),
      hasDesc: description.includes('扫描') && description.includes('中继') && description.includes('监察者'),
      hasGradient: Boolean(svgDocument.querySelector('linearGradient, radialGradient'))
    };
  })()`);
  if (!asset.loaded || asset.natural?.join('x') !== '720x180' || !asset.exactViewBox || asset.colors < 8 || asset.opaque < 100 ||
    !asset.alt?.includes('天幕监察城') || !asset.alt?.includes('万目监察者') || !asset.hasTitle || !asset.hasDesc || asset.hasGradient) {
    throw new Error(`Tier-19 panopticon asset mismatch: ${JSON.stringify(asset)}`);
  }
  console.log('[smoke:panopticon] 19-card catalog, 56 mature equipment, four chapter gear, material, and original 720x180 asset verified');

  await navigateWithState(makePanopticonHub(), 'legal Tier-18 mainline-complete hub renders');
  await clickElementByPointer(cdp, '[data-action="enter-panopticon_city"]');
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-map[data-dungeon-id="panopticon_city"] .grid-node').length === 30 &&
    document.querySelector('.panopticon-law-status[data-panopticon-state="tracking"][data-panopticon-entry-gear-frozen-count="4"]') &&
    document.querySelectorAll('[data-panopticon-zone]').length === 30`, 'real pointer entry freezes gear and renders the 30-node map');
  await collectCurrentReward('panopticon gate');
  await clickGridCell(cdp, '监镜秘藏');
  await waitForPage(cdp, `(() => {
    const status = document.querySelector('.panopticon-law-status');
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
    return status?.dataset.panopticonScanPhase === '1' && status?.dataset.panopticonExposureCount === '1' &&
      saved.run.lawState.law.moveCount === 1 && saved.run.lawState.law.exposureCount === 1;
  })()`, 'real movement rotates scan and records exposure');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.panopticon-law-status[data-panopticon-scan-phase="1"][data-panopticon-exposure-count="1"]')`, 'scan phase and exposure survive reload');
  await collectCurrentReward('watchglass cache');
  await moveToReward('盲区剧场', 'blindspot theater');
  await clickGridCell(cdp, '扫描晶格阱');
  await clickElementByPointer(cdp, '[data-action="trap-risk-scan_lattice_trap"]');
  await waitForPage(cdp, `document.querySelector('.grid-node.current.cleared')?.textContent.includes('扫描晶格阱')`, 'scan lattice clears through pointer risk');
  await moveToReward('北部盲区中继', 'north relay');
  await waitForPage(cdp, `document.querySelector('.panopticon-law-status')?.dataset.panopticonRelayCount === '1' && document.querySelector('[data-action="grid-north_blind_relay"]')?.dataset.panopticonRelayStatus === 'completed'`, 'north relay activates');
  await moveToReward('上层入场口', 'upper entry');
  await moveToReward('中央盲区中继', 'central relay');
  await waitForPage(cdp, `document.querySelector('.panopticon-law-status')?.dataset.panopticonRelayCount === '2'`, 'central relay activates');
  await moveToReward('南部盲区中继', 'south relay');
  await waitForPage(cdp, `document.querySelector('.panopticon-law-status[data-panopticon-state="choice-ready"][data-panopticon-relay-count="3"]') &&
    document.querySelectorAll('[data-panopticon-route-choice]').length === 3 &&
    document.querySelectorAll('.dungeon-map .grid-node:not(:disabled).movable').length === 0 &&
    !document.querySelector('[role="dialog"][aria-modal="true"]')`, 'third relay opens non-modal route choice and only locks map movement');

  await openCharacterSheet(cdp, 'pending panopticon route');
  await assertEscapeClosesCharacterSheet(cdp, 'pending panopticon route');
  await openTaskModal(cdp, 'pending panopticon route');
  await assertEscapeClosesTaskModal(cdp, 'pending panopticon route');
  await clickElementByPointer(cdp, '[data-panopticon-route-choice="refraction"]');
  await waitForPage(cdp, `document.querySelector('.panopticon-law-status[data-panopticon-state="routed"][data-panopticon-route="refraction"]') &&
    document.querySelector('[data-panopticon-route-result="refraction"]') &&
    document.querySelectorAll('[data-panopticon-route-choice]').length === 0 &&
    document.querySelector('[data-panopticon-route-node="refraction"][data-panopticon-route-selected="true"]') &&
    document.querySelectorAll('[data-panopticon-route-node][data-panopticon-route-selected="true"]').length === 1 &&
    !document.querySelector('[role="dialog"][aria-modal="true"]') &&
    document.activeElement !== document.querySelector('[data-panopticon-route-result="refraction"]')`, 'refraction route locks once without stealing focus');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.panopticon-law-status[data-panopticon-route="refraction"]') && document.querySelector('[data-panopticon-route-result="refraction"]')`, 'selected route survives reload');

  await clickGridCell(cdp, '万目监察者');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel .panopticon-law-status[data-panopticon-boss-snapshot="frozen"]')`, 'all-sight warden freezes the Boss snapshot');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `document.querySelector('.combat-panel .panopticon-law-status[data-panopticon-boss-snapshot="frozen"]')`, 'Boss snapshot survives reload');
  await finishActiveCombatByAttack(cdp, 'all-sight warden');
  await waitForPage(cdp, `document.querySelector('[data-panopticon-boss-state="defeated"]') && document.querySelector('.panopticon-law-status[data-panopticon-state="resolved"][data-panopticon-boss-snapshot="defeated"]')`, 'defeated Boss state returns to the map');
  if (await evaluate(cdp, `Boolean(document.querySelector('.equipment-loot-offer'))`)) {
    await clickButtonByPointer(cdp, '放弃', '.node-action-panel');
  }
  await clickGridCell(cdp, '盲晓离城门');
  await clickButtonByPointer(cdp, '完成副本', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.result-panel') && document.body.textContent.includes('观测棱片')`, 'Tier-19 exit settles observation shards');
  console.log('[smoke:panopticon] scan/exposure reload, three real relay clears, pending modal access, route lock, Boss snapshot, and exit verified');

  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await navigateWithState(makePanopticonExploreSave({
      nodeId: 'south_blind_relay',
      clearedNodeIds: ['north_blind_relay', 'central_blind_relay', 'south_blind_relay'],
      scanPhase: 2,
      moveCount: 11,
      exposureCount: 3,
      relays: allRelays,
      route: 'refraction',
      refractionCharges: 2,
      entryGear: fullGear
    }), `${width}x${height} panopticon map fixture renders`);
    await assertResponsiveSurface(cdp, {
      width, height,
      rootSelector: '.dungeon-map[data-dungeon-id="panopticon_city"]',
      targetSelectors: ['.dungeon-map[data-dungeon-id="panopticon_city"]', '.panopticon-law-status', '.node-action-panel'],
      buttonSelectors: ['.dungeon-map[data-dungeon-id="panopticon_city"] .grid-node:not(:disabled)'],
      minimumButtonHeight: 44, checkRootOverflow: true, label: `${width}x${height} Tier-19 panopticon map`
    });
    const geometry = await evaluate(cdp, `(() => {
      const pageWidth = document.documentElement.clientWidth;
      const nodes = [...document.querySelectorAll('.dungeon-map[data-dungeon-id="panopticon_city"] .grid-node')];
      const records = nodes.map((node) => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, overflow: node.scrollWidth > node.clientWidth + 1 }; });
      const distinct = (values) => [...new Set(values.map((value) => Math.round(value)))];
      const widths = records.map((node) => node.width);
      const status = document.querySelector('.panopticon-law-status'); const statusRect = status.getBoundingClientRect();
      return {
        count: records.length,
        columns: distinct(records.map((node) => node.left)).length,
        rows: distinct(nodes.map((node) => node.getBoundingClientRect().top)).length,
        minWidth: Math.min(...widths),
        widthDelta: Math.max(...widths) - Math.min(...widths),
        minHeight: Math.min(...records.map((node) => node.height)),
        statusHeight: statusRect.height,
        statusColumns: distinct([...status.children].map((cell) => cell.getBoundingClientRect().left)).length,
        overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > pageWidth + 1,
        bad: records.filter((node) => node.left < -1 || node.right > pageWidth + 1 || node.overflow)
      };
    })()`);
    const expectedStatusColumns = width === 390 ? 2 : 4;
    if (geometry.count !== 30 || geometry.columns !== 6 || geometry.rows !== 5 || geometry.minWidth < 44 || geometry.widthDelta > 1 || geometry.minHeight < 44 ||
      geometry.statusHeight > 116 || geometry.statusColumns !== expectedStatusColumns || geometry.overflowX || geometry.bad.length) {
      throw new Error(`Tier-19 panopticon geometry mismatch at ${width}x${height}: ${JSON.stringify(geometry)}`);
    }
  }
  console.log('[smoke:panopticon] 390x844 and 1440x900 six-column geometry, compact 2x2/4x1 law rail, touch targets, and overflow verified');

  await navigateWithState(makeCombatReplayPanopticonPortalSave({ nodeId: 'return_rehearsal_portal', inventory: { gate_sigil: 1 } }), 'Tier 18 to Tier 19 portal fixture renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'panopticon_city' && saved.run.currentNodeId === 'panopticon_gate' && document.querySelector('.panopticon-law-status'); })()`, 'Tier 18 stable portal reaches Tier 19');
  await navigateWithState(makePanopticonExploreSave({ nodeId: 'upper_return_portal', inventory: { gate_sigil: 1 } }), 'Tier 19 to Tier 1 portal fixture renders');
  await clickButtonByPointer(cdp, '稳定传送', '.node-action-panel');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.run.dungeonId === 'demon_tower_1' && saved.run.currentNodeId === 'sealed_cache' && !document.querySelector('.panopticon-law-status'); })()`, 'Tier 19 stable portal reaches Tier 1');

  const legacyMaterial = makePanopticonHub();
  delete legacyMaterial.inventory.observation_shard;
  legacyMaterial.log = ['legacy observation shard fixture'];
  await navigateWithState(legacyMaterial, 'legacy observation shard save renders');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.inventory.observation_shard === 0 && saved.log.includes('legacy observation shard fixture'); })()`, 'missing observation shard normalizes to zero without resetting the save');
  const malformedLaw = makePanopticonExploreSave({ rewardPoints: 12345, scanPhase: 99 });
  malformedLaw.log = ['malformed panopticon law fixture'];
  await navigateWithState(malformedLaw, 'malformed panopticon law fixture renders');
  await waitForPage(cdp, `(() => { const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state; return saved.rewardPoints === 12345 && saved.log.includes('malformed panopticon law fixture') && saved.run.lawState.law.kind === 'panopticon_city' && saved.run.lawState.law.scanPhase === 0 && document.querySelector('.panopticon-law-status'); })()`, 'malformed panopticon law recovers locally');

  await setViewport(cdp, 1440, 900);
  await clickElementByPointer(cdp, '.quick-actions [data-action="new-run"]');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} && !document.querySelector('.panopticon-law-status') && Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1`, 'restart clears panopticon state');
  await cdp.send('Page.reload');
  await waitForPage(cdp, `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null && document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'panopticon smoke keeps clean home after reload');

  const faviconUrl = new URL('/favicon.ico', appUrl).href;
  const browserErrors = collectBrowserErrorEvents({ events: cdp.events.filter((event) => !(
    event.method === 'Log.entryAdded' && event.params?.entry?.url === faviconUrl && event.params.entry.text.includes('404')
  )) });
  if (browserErrors.length > 0) throw new Error(`Panopticon smoke should have no console/resource/page errors: ${JSON.stringify(browserErrors)}`);
  console.log('[smoke] panopticon city: legal Tier 18 prerequisite -> Tier 19 entry, asset/catalog/map, scan/exposure reload, three relays, pending modal access, one-shot route, Boss/exit, Tier 18 -> 19 -> 1 portals, v1 recovery, responsive geometry, and clean restart');
}

async function runHubSurfaceSmoke(cdp, appUrl) {
  const hubControlSelectors = [
    '.hub-station:nth-child(1)',
    '.hub-station:nth-child(2)',
    '.hub-station:nth-child(3)',
    '.hub-station:nth-child(4)',
    '.hub-station:nth-child(5)',
    '.hub-station:nth-child(6)',
    '.hub-gate',
    '.hub-codex-trigger'
  ];
  const replaceSearchByPointer = async (text) => {
    await clickElementByPointer(cdp, '.codex-search');
    await evaluate(
      cdp,
      `(() => {
        const input = document.querySelector('.codex-search');
        if (!(input instanceof HTMLInputElement)) throw new Error('Missing codex search input');
        input.select();
        return true;
      })()`
    );
    await cdp.send('Input.insertText', { text });
  };
  const closeDirectoryByPointer = async (actionId, label) => {
    await clickElementByPointer(cdp, '.hub-directory-close');
    await waitForPage(
      cdp,
      `(() => {
        const appContent = document.querySelector('.app-content');
        return !document.querySelector('.hub-directory-modal') &&
          !document.body.classList.contains('modal-open') &&
          !Boolean(appContent?.hasAttribute('inert') || appContent?.inert) &&
          document.activeElement === document.querySelector('[data-action="${actionId}"]');
      })()`,
      `${label} closes, unlocks the page, and restores trigger focus`
    );
  };

  await setViewport(cdp, 1440, 900);
  await waitForPage(cdp, `document.querySelector('.shell')`, 'hub smoke initial shell');
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.hub-stage') && document.querySelectorAll('.hub-station').length === 6`,
    'clean hub stage'
  );

  const desktopHub = await evaluate(
    cdp,
    `(() => {
      const selectors = ${JSON.stringify(hubControlSelectors)};
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      const controls = selectors.map((selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
        return {
          selector,
          exists: Boolean(element),
          visible: isVisible(element),
          insideViewport: Boolean(rect && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1),
          width: rect?.width ?? 0,
          height: rect?.height ?? 0,
          pointerTarget: Boolean(element && hit && element.contains(hit))
        };
      });
      const elements = selectors.map((selector) => document.querySelector(selector));
      const overlaps = [];
      for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
          const left = elements[leftIndex];
          const right = elements[rightIndex];
          if (!left || !right) continue;
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          const overlapX = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
          const overlapY = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
          if (overlapX > 1 && overlapY > 1) overlaps.push([selectors[leftIndex], selectors[rightIndex]]);
        }
      }
      return {
        viewport: [innerWidth, innerHeight],
        hubVisible: isVisible(document.querySelector('.hub-stage')),
        directoryCount: document.querySelectorAll('.hub-directory-modal').length,
        legacyVisible: [...document.querySelectorAll('.dungeon-card, .shop-card, .pet-card')].filter(isVisible).length,
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        controls,
        overlaps
      };
    })()`
  );
  if (
    desktopHub.viewport[0] !== 1440 ||
    desktopHub.viewport[1] !== 900 ||
    !desktopHub.hubVisible ||
    desktopHub.directoryCount !== 0 ||
    desktopHub.legacyVisible !== 0 ||
    desktopHub.pageOverflow ||
    desktopHub.controls.some((control) =>
      !control.exists || !control.visible || !control.insideViewport || control.width <= 0 || control.height < 43.5 || !control.pointerTarget
    ) ||
    desktopHub.overlaps.length > 0
  ) {
    throw new Error(`1440x900 clean hub should expose only eight collision-free hub controls: ${JSON.stringify(desktopHub)}`);
  }

  await clickElementByPointer(cdp, '[data-action="open-hub-codex"]');
  await waitForPage(cdp, `document.querySelector('.hub-directory-sheet[role="dialog"][aria-modal="true"]')`, 'codex dialog opens');
  const codexOpen = await evaluate(
    cdp,
    `(() => {
      const dialog = document.querySelector('.hub-directory-sheet[role="dialog"][aria-modal="true"]');
      const closeButton = document.querySelector('.hub-directory-close');
      const appContent = document.querySelector('.app-content');
      const count = Number(document.querySelector('.codex-count')?.textContent.match(/\\d+/)?.[0] ?? -1);
      return {
        dialog: Boolean(dialog),
        bodyModalOpen: document.body.classList.contains('modal-open'),
        appContentInert: Boolean(appContent?.hasAttribute('inert') || appContent?.inert),
        focusOnClose: document.activeElement === closeButton,
        count,
        entries: document.querySelectorAll('.codex-entry').length
      };
    })()`
  );
  if (!codexOpen.dialog || !codexOpen.bodyModalOpen || !codexOpen.appContentInert || !codexOpen.focusOnClose || codexOpen.count <= 1 || codexOpen.entries !== codexOpen.count) {
    throw new Error(`Codex should open as a focused modal with a populated count: ${JSON.stringify(codexOpen)}`);
  }
  await replaceSearchByPointer('妖塔');
  await waitForPage(cdp, `document.querySelector('.codex-count')?.textContent !== '结果 ${codexOpen.count}'`, 'codex search result count updates');
  const filteredCodex = await evaluate(
    cdp,
    `(() => {
      const entries = [...document.querySelectorAll('.codex-entry')];
      return {
        count: Number(document.querySelector('.codex-count')?.textContent.match(/\\d+/)?.[0] ?? -1),
        entries: entries.length,
        onlyMatches: entries.every((entry) => entry.textContent.includes('妖塔')),
        searchValue: document.querySelector('.codex-search')?.value ?? ''
      };
    })()`
  );
  if (filteredCodex.searchValue !== '妖塔' || filteredCodex.count <= 0 || filteredCodex.count >= codexOpen.count || filteredCodex.entries !== filteredCodex.count || !filteredCodex.onlyMatches) {
    throw new Error(`Codex search should show only 妖塔 matches and update its count: ${JSON.stringify(filteredCodex)}`);
  }
  await pressEscape(cdp);
  await waitForPage(
    cdp,
    `(() => {
      const appContent = document.querySelector('.app-content');
      return !document.querySelector('.hub-directory-modal') &&
        !document.body.classList.contains('modal-open') &&
        !Boolean(appContent?.hasAttribute('inert') || appContent?.inert) &&
        document.activeElement === document.querySelector('[data-action="open-hub-codex"]');
    })()`,
    'Escape closes codex and restores trigger focus'
  );

  await clickElementByPointer(cdp, '[data-action="open-hub-dungeons"]');
  await waitForPage(
    cdp,
    `(() => {
      const isVisible = (element) => Boolean(element?.getClientRects().length) && getComputedStyle(element).visibility !== 'hidden';
      return [...document.querySelectorAll('.dungeon-card')].filter(isVisible).length === ${DUNGEON_COUNT};
    })()`,
    `all ${DUNGEON_COUNT} dungeon cards become visible`
  );
  await closeDirectoryByPointer('open-hub-dungeons', 'dungeon directory');

  const directoryChecks = [
    { actionId: 'open-hub-supplies', title: '补给商人', selector: '.shop-card:not(.equipment-card)' },
    { actionId: 'open-hub-equipment', title: '装备商人', selector: '.equipment-card, .empty-copy' },
    { actionId: 'open-hub-forge', title: '锻造商人', selector: '.equipment-card, .forge-directory-note', forge: true },
    { actionId: 'open-hub-pets', title: '宠物商人', selector: '.pet-card' }
  ];
  for (const check of directoryChecks) {
    await clickElementByPointer(cdp, `[data-action="${check.actionId}"]`);
    await waitForPage(
      cdp,
      `(() => {
        const dialog = document.querySelector('.hub-directory-sheet[role="dialog"][aria-modal="true"]');
        const isVisible = (element) => Boolean(element?.getClientRects().length) && getComputedStyle(element).visibility !== 'hidden';
        return dialog?.textContent.includes(${JSON.stringify(check.title)}) && [...document.querySelectorAll(${JSON.stringify(check.selector)})].some(isVisible);
      })()`,
      `${check.title} content becomes visible`
    );
    if (check.forge) {
      const forgeState = await evaluate(
        cdp,
        `(() => {
          const isVisible = (element) => Boolean(element?.getClientRects().length) && getComputedStyle(element).visibility !== 'hidden';
          const cards = [...document.querySelectorAll('.equipment-card')].filter(isVisible);
          const ownedCards = cards.filter((card) => card.querySelector('.card-topline small')?.textContent.includes('已拥有'));
          const previewCards = cards.filter((card) => card.classList.contains('is-forge-preview'));
          return {
            count: cards.length,
            ownedCount: ownedCards.length,
            previewCount: previewCards.length,
            ownedFirst: ownedCards.every((card, index) => cards[index] === card),
            previewsLocked: previewCards.every((card) =>
              card.querySelector('.card-topline small')?.textContent.includes('锁定预览') &&
              [...card.querySelectorAll('button')].every((button) => button.disabled)
            ),
            hasDirectoryNote: Boolean(document.querySelector('.forge-directory-note')),
            hasPurchaseAction: cards.some((card) => [...card.querySelectorAll('button')].some((button) => button.textContent.includes('兑换入架')))
          };
        })()`
      );
      if (
        forgeState.count !== 0 ||
        forgeState.previewCount !== 0 ||
        !forgeState.ownedFirst ||
        !forgeState.previewsLocked ||
        !forgeState.hasDirectoryNote ||
        forgeState.hasPurchaseAction
      ) {
        throw new Error(`Fresh forge should stay empty until chapter equipment is owned: ${JSON.stringify(forgeState)}`);
      }
    }
    await closeDirectoryByPointer(check.actionId, check.title);
  }

  await assertResponsiveSurface(cdp, {
    width: 390,
    height: 844,
    rootSelector: '.hub-stage',
    targetSelectors: hubControlSelectors,
    buttonSelectors: hubControlSelectors,
    minimumButtonHeight: 43.5,
    checkRootOverflow: true,
    label: 'mobile hub stage'
  });
  await clickElementByPointer(cdp, '[data-action="open-hub-codex"]');
  await waitForPage(cdp, `document.querySelector('.hub-directory-sheet[role="dialog"][aria-modal="true"]')`, 'mobile codex sheet opens');
  const mobileSheet = await evaluate(
    cdp,
    `(() => {
      const sheet = document.querySelector('.hub-directory-sheet');
      const search = document.querySelector('.codex-search');
      const filter = document.querySelector('[data-action="filter-codex-dungeons"]');
      const sheetRect = sheet?.getBoundingClientRect();
      const searchRect = search?.getBoundingClientRect();
      const filterRect = filter?.getBoundingClientRect();
      const searchHit = searchRect ? document.elementFromPoint(searchRect.left + searchRect.width / 2, searchRect.top + searchRect.height / 2) : null;
      const filterHit = filterRect ? document.elementFromPoint(filterRect.left + filterRect.width / 2, filterRect.top + filterRect.height / 2) : null;
      return {
        viewport: [innerWidth, innerHeight],
        sheetInsideViewport: Boolean(sheetRect && sheetRect.left >= -1 && sheetRect.right <= innerWidth + 1 && sheetRect.top >= -1 && sheetRect.bottom <= innerHeight + 1),
        searchVisible: Boolean(searchRect && searchRect.width > 0 && searchRect.height > 0 && searchHit && search.contains(searchHit)),
        filterVisible: Boolean(filterRect && filterRect.width > 0 && filterRect.height >= 43.5 && filterHit && filter.contains(filterHit)),
        pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1
      };
    })()`
  );
  if (mobileSheet.viewport[0] !== 390 || mobileSheet.viewport[1] !== 844 || !mobileSheet.sheetInsideViewport || !mobileSheet.searchVisible || !mobileSheet.filterVisible || mobileSheet.pageOverflow) {
    throw new Error(`390x844 codex sheet should fit with pointer-usable search and filters: ${JSON.stringify(mobileSheet)}`);
  }
  await clickElementByPointer(cdp, '[data-action="filter-codex-dungeons"]');
  await waitForPage(cdp, `document.querySelector('[data-action="filter-codex-dungeons"]')?.getAttribute('aria-pressed') === 'true'`, 'mobile dungeon codex filter applies');
  await replaceSearchByPointer('星坠');
  await waitForPage(cdp, `document.querySelector('.codex-search')?.value === '星坠'`, 'mobile codex search updates');
  const mobileCodex = await evaluate(
    cdp,
    `(() => {
      const entries = [...document.querySelectorAll('.codex-entry')];
      return {
        count: Number(document.querySelector('.codex-count')?.textContent.match(/\\d+/)?.[0] ?? -1),
        entries: entries.length,
        onlyDungeons: entries.every((entry) => entry.dataset.codexCategory === 'dungeons'),
        onlyMatches: entries.every((entry) => entry.textContent.includes('星坠'))
      };
    })()`
  );
  if (mobileCodex.count <= 0 || mobileCodex.entries !== mobileCodex.count || !mobileCodex.onlyDungeons || !mobileCodex.onlyMatches) {
    throw new Error(`Mobile codex category and search should combine correctly: ${JSON.stringify(mobileCodex)}`);
  }
  await closeDirectoryByPointer('open-hub-codex', 'mobile codex directory');
  console.log('[smoke] hub surface: desktop stage, modal lifecycle, directories, forge ownership, and 390x844 codex controls pass');
}

async function runSmoke(cdp, appUrl) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: appUrl });
  if (process.env.SMOKE_SUITE === 'hub') {
    await runHubSurfaceSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'deep') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'deep-only smoke shell');
    await runDeepProtocolPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'entropy') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'entropy-only smoke shell');
    await runEntropyArkPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'mirror') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'mirror-only smoke shell');
    await runMirrorCycleCityPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'redaction') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'redaction-only smoke shell');
    await runRedactionScriptoriumPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'auction') {
    try {
      await waitForPage(cdp, `document.querySelector('.shell')`, 'auction-only smoke shell');
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
    await runLegacyAuctionCourtPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'genesis') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'genesis-only smoke shell');
    await runGenesisVaultPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'broadcast') {
    try {
      await waitForPage(cdp, `document.querySelector('.shell')`, 'broadcast-only smoke shell');
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
    await runSilentBroadcastTowerPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'shelter') {
    try {
      await waitForPage(cdp, `document.querySelector('.shell')`, 'shelter-only smoke shell');
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
    await runLostShelterPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'verdict') {
    try {
      await waitForPage(cdp, `document.querySelector('.shell')`, 'verdict-only smoke shell');
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
    await runFalseTestimonyCourtPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'replay') {
    try {
      await waitForPage(cdp, `document.querySelector('.shell')`, 'replay-only smoke shell');
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
    await runCombatReplayStagePointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'panopticon') {
    try {
      await waitForPage(cdp, `document.querySelector('.shell')`, 'panopticon-only smoke shell');
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}; browser=${JSON.stringify(collectBrowserErrorEvents(cdp))}`);
    }
    await runPanopticonCityPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'causal') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'causal-only smoke shell');
    await runCausalClearinghousePointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'dungeon-law') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'dungeon-law-only smoke shell');
    await runDungeonLawPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'route-gate') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'route-gate-only smoke shell');
    await runDirectionalRouteGatePointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'route-contract') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'route-contract-only smoke shell');
    await runRouteContractPointerSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'companion') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'companion-only smoke shell');
    await runCompanionSmoke(cdp, appUrl);
    return;
  }
  if (process.env.SMOKE_SUITE === 'method') {
    await waitForPage(cdp, `document.querySelector('.shell')`, 'method-only smoke shell');
    await runMethodCultivationSmoke(cdp, appUrl);
    return;
  }

  await waitForPage(
    cdp,
    `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT} &&
      document.querySelector('.task-trigger')?.textContent.includes('任务') &&
      document.body.textContent.includes('宠物馆') &&
      document.querySelector('.directive-card')?.textContent.includes('主神指令') &&
      document.querySelector('.growth-planner')?.textContent.includes('${DUNGEON_COUNT} 阶成长规划')`,
    'first screen task trigger, dungeon gates, main god directive, growth plan, and pet house'
  );
  const firstScreen = await evaluate(
    cdp,
    `(() => {
      const isVisible = (element) =>
        Boolean(element?.getClientRects().length) &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden';
      return {
      dungeons: document.querySelectorAll('.dungeon-card').length,
      hasTaskTrigger: document.querySelector('.task-trigger')?.textContent.includes('任务') ?? false,
      visibleMainlineTasks: [...document.querySelectorAll('.mainline-task-panel')].filter(isVisible).length,
      visibleChapterSideTasks: [...document.querySelectorAll('.chapter-side-task-panel')].filter(isVisible).length,
      visibleSideTaskCards: [...document.querySelectorAll('.side-task-card')].filter(isVisible).length,
      hasPetHouse: document.body.textContent.includes('宠物馆'),
      hasDirective: Boolean(document.querySelector('.directive-card')),
      bossSealRows: document.querySelectorAll('.dungeon-card .boss-seal-progress[data-boss-seal="sealed"]').length,
      bossSealTitlesComplete: [...document.querySelectorAll('.dungeon-card .boss-seal-progress')].every((row) =>
        Boolean(row.querySelector('strong')?.textContent.trim()) && row.textContent.includes('出口封印 0/1')
      ),
      growthStages: document.querySelectorAll('.growth-stage').length,
      hasShopAdvice: /战力 \\+|推荐用于|捕获路线|资源足够/.test(document.body.textContent),
      hasTopRecommendations:
        Boolean(document.querySelector('.top-recommendations')) &&
        document.body.textContent.includes('主神推荐补强') &&
        document.querySelectorAll('.recommendation-row').length >= 3
      };
    })()`
  );
  if (!firstScreen.hasShopAdvice) {
    throw new Error('First screen shop should show purchase advice such as power delta, recommendations, capture routes, or affordability.');
  }
  if (!firstScreen.hasTopRecommendations) {
    throw new Error('First screen shop should show a Top 3 main-god recommendation panel.');
  }
  if (!firstScreen.hasTaskTrigger) {
    throw new Error(`First screen should show a compact task trigger, got ${JSON.stringify(firstScreen)}`);
  }
  if (firstScreen.bossSealRows !== DUNGEON_COUNT || !firstScreen.bossSealTitlesComplete) {
    throw new Error(`Each dungeon entrance should show one compact, sealed Boss objective: ${JSON.stringify(firstScreen)}`);
  }
  if (firstScreen.visibleMainlineTasks || firstScreen.visibleChapterSideTasks || firstScreen.visibleSideTaskCards) {
    throw new Error(`First screen should keep task details out of the page body, got ${JSON.stringify(firstScreen)}`);
  }
  await assertTaskModalClosed(cdp, 'first screen');
  await openTaskModal(cdp, 'first screen backdrop');
  await assertTaskBackdropCloses(cdp, 'first screen');
  await openTaskModal(cdp, 'first screen Escape');
  await assertEscapeClosesTaskModal(cdp, 'first screen');

  await openTaskModal(cdp, 'task to character switch');
  await closeTaskModal(cdp, 'task to character switch');
  const switchedCharacterSheet = await openCharacterSheet(cdp, 'task to character switch');
  if (!switchedCharacterSheet.dialogText.includes('背包为空')) {
    throw new Error(`Switched character sheet inventory should be empty, got ${JSON.stringify(switchedCharacterSheet)}`);
  }
  await closeCharacterSheet(cdp, 'character to task switch');
  await openTaskModal(cdp, 'character to task switch');
  await closeTaskModal(cdp, 'character to task switch');

  await assertCharacterSheetClosed(cdp, 'first screen');
  const initialCharacterSheet = await openCharacterSheet(cdp, 'first screen backdrop');
  if (
    !initialCharacterSheet.dialogText.includes('背包为空') ||
    !initialCharacterSheet.dialogText.includes('暂无2件套') ||
    !initialCharacterSheet.dialogText.includes('暂无3件精通')
  ) {
    throw new Error(`Initial character sheet should show an empty backpack and compact empty set states, got ${JSON.stringify(initialCharacterSheet)}`);
  }
  await assertCharacterBackdropCloses(cdp, 'first screen');
  await openCharacterSheet(cdp, 'first screen Escape');
  await assertEscapeClosesCharacterSheet(cdp, 'first screen');
  console.log('[smoke] first screen keeps character stats, loadout, pet, and empty backpack inside a closeable sheet');

  await runEquipmentCommissionSmoke(cdp, appUrl);
  await runCompanionSmoke(cdp, appUrl);
  await runCycleErosionPointerSmoke(cdp, appUrl);
  await runEquipmentDecisionSmoke(cdp, appUrl);
  await runMobileDungeonMapSmoke(cdp, appUrl);
  await runBossFlowSmoke(cdp, appUrl);
  await runCausalClearinghousePointerSmoke(cdp, appUrl);
  await runEntropyArkPointerSmoke(cdp, appUrl);
  await runMirrorCycleCityPointerSmoke(cdp, appUrl);
  await runRedactionScriptoriumPointerSmoke(cdp, appUrl);
  await runLegacyAuctionCourtPointerSmoke(cdp, appUrl);
  await runGenesisVaultPointerSmoke(cdp, appUrl);
  await runSilentBroadcastTowerPointerSmoke(cdp, appUrl);
  await runFalseTestimonyCourtPointerSmoke(cdp, appUrl);
  await runRelicSmoke(cdp, appUrl);
  await runEquipmentSoulSmoke(cdp, appUrl);

  const routeReadStateBefore = await getFirstScreenStateSnapshot(cdp);
  const campaignRoute = await evaluate(
    cdp,
    `(() => {
      const expectedNames = ${JSON.stringify(CAMPAIGN_ROUTE_DUNGEON_NAMES)};
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const panel = document.querySelector('.campaign-route-panel');
      const text = compactText(panel);
      const summaryText = compactText(panel?.querySelector('.campaign-route-summary strong'));
      const rows = panel
        ? [...panel.querySelectorAll('.campaign-route-row')].map((row, index) => {
            const rowText = compactText(row);
            const title = compactText(row.querySelector('.route-copy h3'));
            const stageText = compactText(row.querySelector('.route-stage'));
            const progressText = compactText(row.querySelector('.card-topline small'));
            const routeSummaryText = compactText(row.querySelector('.route-plan'));
            const routePlanItems = [...row.querySelectorAll('.route-plan span')].map((item) => compactText(item));
            const resultText = compactText(row.querySelector('.route-result'));
            return {
              index: index + 1,
              expectedName: expectedNames[index],
              title,
              stageText,
              progressText,
              routeSummaryText,
              resultText,
              hasExpectedName: title === expectedNames[index] && rowText.includes(expectedNames[index]),
              hasReachableOrRecommendationStatus: /(可达|推演通关|锁定|推荐|READY|HARD|DEADLY)/.test(stageText),
              hasCompletionCount: new RegExp('推演进度\\\\s*' + (index + 1) + '\\\\/${DUNGEON_COUNT}').test(progressText),
              hasAfterPower: /通关后战力/.test(resultText) && /\\d+\\s*->\\s*\\d+/.test(resultText),
              hasRouteSummary:
                routePlanItems.length >= 4 &&
                ['装备', '升级', '功法', '宠物'].every((label) => routeSummaryText.includes(label))
            };
          })
        : [];
      return {
        exists: Boolean(panel),
        hasRouteTitle: text.includes('主神推演') && text.includes('战役路线'),
        routeRows: rows.length,
        finalProgressText: summaryText,
        hasFinalProgress: /^推演终局\\s*${DUNGEON_COUNT}\\/${DUNGEON_COUNT}$/.test(summaryText),
        hasZeroFinalProgress: /^推演终局\\s*0\\/${DUNGEON_COUNT}$/.test(summaryText),
        hasNoRealCompletionCopy: !/终局完成|已完成|完成\\s+\\d\\/${DUNGEON_COUNT}/.test(text),
        rows,
        invalidRows: rows.filter(
          (row) =>
            !row.hasExpectedName ||
            !row.hasReachableOrRecommendationStatus ||
            !row.hasCompletionCount ||
            !row.hasAfterPower ||
            !row.hasRouteSummary
        ),
        missingNames: expectedNames.filter((name, index) => rows[index]?.title !== name),
        hasEquipmentCoverage: /装备\\s*已覆盖/.test(text),
        hasUpgradeCoverage: /升级\\s*已覆盖/.test(text),
        hasMethodCoverage: /功法\\s*已覆盖/.test(text),
        hasPetCoverage: /宠物\\s*已覆盖/.test(text)
      };
    })()`
  );
  const routeReadStateAfter = await getFirstScreenStateSnapshot(cdp);
  const changedRouteReadStateKeys = Object.keys(routeReadStateBefore).filter(
    (key) => JSON.stringify(routeReadStateBefore[key]) !== JSON.stringify(routeReadStateAfter[key])
  );
  if (
    routeReadStateBefore.storageValue !== null ||
    !routeReadStateBefore.resourceText.includes('850') ||
    !routeReadStateBefore.petRosterText.includes('宠物栏为空') ||
    routeReadStateBefore.completedDungeonCards !== 0 ||
    !routeReadStateBefore.dungeonCards.some((text) => text.includes('妖塔一层') && text.includes('已解锁') && !text.includes('已完成')) ||
    !routeReadStateBefore.dungeonCards.some((text) => text.includes('虚界城') && text.includes('锁定'))
  ) {
    throw new Error(`Campaign route panel should render without mutating the initial first-screen state: ${JSON.stringify(routeReadStateBefore)}`);
  }
  if (changedRouteReadStateKeys.length > 0) {
    throw new Error(
      `Reading the campaign route panel should be read-only; changed keys: ${changedRouteReadStateKeys.join(', ')} ` +
        `before=${JSON.stringify(routeReadStateBefore)} after=${JSON.stringify(routeReadStateAfter)}`
    );
  }
  if (
    !campaignRoute.exists ||
    !campaignRoute.hasRouteTitle ||
    campaignRoute.routeRows !== DUNGEON_COUNT ||
    !campaignRoute.hasFinalProgress ||
    campaignRoute.hasZeroFinalProgress ||
    !campaignRoute.hasNoRealCompletionCopy ||
    campaignRoute.missingNames.length > 0 ||
    campaignRoute.invalidRows.length > 0 ||
    !campaignRoute.hasEquipmentCoverage ||
    !campaignRoute.hasUpgradeCoverage ||
    !campaignRoute.hasMethodCoverage ||
    !campaignRoute.hasPetCoverage
  ) {
    throw new Error(
      `First screen campaign route panel should show route title, ${DUNGEON_COUNT} stage rows, final ${DUNGEON_COUNT}/${DUNGEON_COUNT} route simulation, and equipment/upgrade/method/pet coverage without real-completion wording: ${JSON.stringify(
        campaignRoute
      )}`
    );
  }
	  console.log(`[smoke] campaign route panel shows strict ${DUNGEON_COUNT}/${DUNGEON_COUNT} simulated progress, all ${DUNGEON_COUNT} route rows, summaries, and read-only state`);
  console.log(
    `[smoke] first screen: ${firstScreen.dungeons} dungeons, pet house=${firstScreen.hasPetHouse}, ` +
      `directive=${firstScreen.hasDirective}, growth stages=${firstScreen.growthStages}, shop advice=${firstScreen.hasShopAdvice}, ` +
      `top recommendations=${firstScreen.hasTopRecommendations}, task trigger=${firstScreen.hasTaskTrigger}`
  );
  const firstDungeonGate = await getCardButtonState(cdp, '.dungeon-card', '妖塔一层', '进入副本');
  const finalDungeonGate = await getCardButtonState(cdp, '.dungeon-card', '虚界城', '进入副本');
  if (firstDungeonGate.disabled) throw new Error('妖塔一层 should be enterable on the first screen.');
  if (!finalDungeonGate.disabled || !finalDungeonGate.cardText.includes('锁定')) {
    throw new Error('虚界城 should be visibly locked on the first screen.');
  }
  console.log('[smoke] campaign gates lock later dungeons while leaving the first dungeon enterable');

  await clickCardButton(cdp, '.pet-card', '契约小灵', '签约');
  await waitForPage(cdp, `document.body.textContent.includes('已拥有宠物') && document.body.textContent.includes('出战宠物')`, 'shop pet purchase');
  console.log('[smoke] bought shop pet and roster updated');

  await clickCardButton(cdp, '.shop-card', '缚灵网', '兑换');
  await assertCharacterSheetClosed(cdp, 'after capture item purchase');
  const captureItemSheet = await openCharacterSheet(cdp, 'after capture item purchase');
  if (!captureItemSheet.dialogText.includes('缚灵网')) {
    throw new Error(`Character sheet inventory should include bought 缚灵网, got ${JSON.stringify(captureItemSheet)}`);
  }
  await closeCharacterSheet(cdp, 'after capture item purchase');
  console.log('[smoke] bought capture item and verified it inside the character sheet');

  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.pet-roster .pet-card.owned')?.textContent.includes('契约小灵')`,
    'local save restores pet and capture item after reload'
  );
  const restoredSheet = await openCharacterSheet(cdp, 'local save restore');
  if (!restoredSheet.dialogText.includes('契约小灵') || !restoredSheet.dialogText.includes('缚灵网')) {
    throw new Error(`Reloaded character sheet should restore active pet and capture item, got ${JSON.stringify(restoredSheet)}`);
  }
  await clickDialogButton(cdp, '重开');
  await waitForPage(
    cdp,
    `(() => {
      const appContent = document.querySelector('.app-content');
      const characterTrigger = document.querySelector('.character-trigger');
      return !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        !document.body.classList.contains('modal-open') &&
        !Boolean(appContent?.hasAttribute('inert') || appContent?.inert) &&
        document.activeElement === characterTrigger &&
        localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
        !document.querySelector('.pet-roster .pet-card.owned') &&
      document.querySelector('.pet-roster')?.textContent.includes('宠物栏为空') &&
        document.querySelector('.resource-strip')?.textContent.includes('850');
    })()`,
    'restart from open character sheet returns to initial state'
  );
  console.log('[smoke] reload restored character-sheet inventory and restart from the open character sheet cleared progress');

  const restartedSheet = await openCharacterSheet(cdp, 'restart');
  if (!restartedSheet.dialogText.includes('背包为空')) {
    throw new Error(`Restarted character sheet should show empty backpack, got ${JSON.stringify(restartedSheet)}`);
  }
  await closeCharacterSheet(cdp, 'restart');
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `!document.querySelector('.pet-roster .pet-card.owned') &&
      document.querySelector('.pet-roster')?.textContent.includes('宠物栏为空') &&
      document.querySelector('.resource-strip')?.textContent.includes('850')`,
    'restart clears local save after reload'
  );
  const restartedReloadSheet = await openCharacterSheet(cdp, 'restart reload');
  if (!restartedReloadSheet.dialogText.includes('背包为空')) {
    throw new Error(`Restart reload character sheet should show empty backpack, got ${JSON.stringify(restartedReloadSheet)}`);
  }
  await closeCharacterSheet(cdp, 'restart reload');
  console.log('[smoke] restart cleared local save and reload stayed initial');

  await runLegacyRunMigrationSmoke(cdp, appUrl);
  await runBadRunLootRecoverySmoke(cdp, appUrl);
  await runProtocolAndAttunementSaveValidationSmoke(cdp, appUrl);
  await runDungeonLawSaveValidationSmoke(cdp, appUrl);
  await runFocusAndTemperSaveValidationSmoke(cdp, appUrl);
  await runRouteContractPointerSmoke(cdp, appUrl);
  await runProtocolAndAttunementPointerSmoke(cdp, appUrl);
  await runDeepProtocolPointerSmoke(cdp, appUrl);
  await runEquipmentTemperPointerSmoke(cdp, appUrl);
  await runDungeonLawPointerSmoke(cdp, appUrl);
  await runDirectionalRouteGatePointerSmoke(cdp, appUrl);
  await runTemporalObservatoryPointerSmoke(cdp, appUrl);
  await runCombatIntentPointerSmoke(cdp, appUrl);
  await runDreamArchiveLawPointerSmoke(cdp, appUrl);
  await runWeaponResonancePointerSmoke(cdp, appUrl);

  await injectLegacyTaskSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(
    cdp,
    `document.querySelector('.resource-strip')?.textContent.includes('777') &&
      document.querySelector('.task-trigger')?.textContent.includes('任务') &&
      document.querySelectorAll('.equipment-card[data-equipment-id^="chronal_"]').length === 3 &&
      document.body.textContent.includes('legacy task save without claimedTaskIds')`,
    'legacy save without claimedTaskIds loads'
  );
  const legacyCharacterSheet = await openCharacterSheet(cdp, 'legacy save with three-slot equipment');
  if (!legacyCharacterSheet.dialogText.includes('头部') || !legacyCharacterSheet.dialogText.includes('手部')) {
    throw new Error(`Legacy save character sheet should show normalized armor slots, got ${JSON.stringify(legacyCharacterSheet)}`);
  }
  await closeCharacterSheet(cdp, 'legacy save with three-slot equipment');
  const legacyTaskModal = await openTaskModal(cdp, 'legacy save without claimedTaskIds');
  if (!legacyTaskModal.dialogText.includes('主线任务')) {
    throw new Error(`Legacy save task modal should still show mainline tasks, got ${JSON.stringify(legacyTaskModal)}`);
  }
  await closeTaskModal(cdp, 'legacy save without claimedTaskIds');
  await clickCardButton(cdp, '.pet-card', '契约小灵', '签约');
  const legacyResavedState = await evaluate(
    cdp,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state)()`
  );
  const requiredLegacyEquipment = {
    head: 'patched_headwrap',
    armor: 'patched_coat',
    hands: 'patched_gloves',
    feet: 'patched_boots',
    waist: 'patched_belt'
  };
  const missingLegacySlots = Object.entries(requiredLegacyEquipment).filter(
    ([slot, equipmentId]) => legacyResavedState.equipped?.[slot] !== equipmentId
  );
  const missingLegacyOwned = Object.values(requiredLegacyEquipment).filter(
    (equipmentId) => !legacyResavedState.ownedEquipment?.includes(equipmentId)
  );
  const missingLegacyLevels = Object.values(requiredLegacyEquipment).filter(
    (equipmentId) => legacyResavedState.equipmentLevels?.[equipmentId] !== 1
  );
  if (!Array.isArray(legacyResavedState.claimedTaskIds) || legacyResavedState.claimedTaskIds.length !== 0) {
    throw new Error(`Legacy save should normalize and re-save claimedTaskIds=[], got ${JSON.stringify(legacyResavedState.claimedTaskIds)}`);
  }
  if (
    legacyResavedState.inventory?.cycle_imprint !== 0 ||
    legacyResavedState.inventory?.chronal_glass !== 0 ||
    legacyResavedState.inventory?.phase_glass !== 0 ||
    legacyResavedState.inventory?.redaction_ink !== 0 ||
    legacyResavedState.inventory?.legacy_scrip !== 0 ||
    Object.keys(legacyResavedState.equipmentAttunements ?? {}).length !== 0 ||
    Object.keys(legacyResavedState.equipmentTemperRanks ?? {}).length !== 0
  ) {
    throw new Error(
      `Legacy save should normalize cycle_imprint=0, chronal_glass=0, phase_glass=0, redaction_ink=0, legacy_scrip=0, equipmentAttunements={}, and equipmentTemperRanks={}, got ${JSON.stringify(legacyResavedState)}`
    );
  }
  if (missingLegacySlots.length > 0 || missingLegacyOwned.length > 0 || missingLegacyLevels.length > 0) {
    throw new Error(
      `Legacy save should re-save new armor slots, ownership, and levels, got slots=${JSON.stringify(
        missingLegacySlots
      )}, owned=${JSON.stringify(missingLegacyOwned)}, levels=${JSON.stringify(missingLegacyLevels)}`
    );
  }
  await clickButton(cdp, '重开');
  await waitForPage(cdp, `document.querySelector('.resource-strip')?.textContent.includes('850')`, 'restart after legacy save normalization');
  console.log('[smoke] legacy save re-saves chronal_glass=0, phase_glass=0, redaction_ink=0, legacy_scrip=0, default equipment maps, normalized armor slots, and an empty claimedTaskIds array');

  await injectBadEquipmentLevelSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.resource-strip')`, 'bad equipment-level save reload renders');
  const badSaveRecovery = await evaluate(
    cdp,
    `(() => ({
      hasSavedKey: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null,
      resourceText: document.querySelector('.resource-strip')?.textContent ?? '',
      bodyText: document.body.textContent
    }))()`
  );
  if (
    badSaveRecovery.hasSavedKey ||
    !badSaveRecovery.resourceText.includes('850') ||
    badSaveRecovery.resourceText.includes('777') ||
    badSaveRecovery.bodyText.includes('bad equipment level smoke save')
  ) {
    throw new Error(
      `Bad equipment-level save should reset and clear storage: key=${badSaveRecovery.hasSavedKey}, resources=${badSaveRecovery.resourceText}`
    );
  }
  console.log('[smoke] bad equipment-level save reset to initial state and cleared storage');

  await injectUnownedEquipmentLevelSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.resource-strip')`, 'unowned equipment-level save reload renders');
  const unownedLevelRecovery = await evaluate(
    cdp,
    `(() => ({
      hasSavedKey: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null,
      resourceText: document.querySelector('.resource-strip')?.textContent ?? '',
      bodyText: document.body.textContent
    }))()`
  );
  if (
    unownedLevelRecovery.hasSavedKey ||
    !unownedLevelRecovery.resourceText.includes('850') ||
    unownedLevelRecovery.resourceText.includes('777') ||
    unownedLevelRecovery.bodyText.includes('unowned equipment level smoke save')
  ) {
    throw new Error(
      `Unowned equipment-level save should reset and clear storage: key=${unownedLevelRecovery.hasSavedKey}, resources=${unownedLevelRecovery.resourceText}`
    );
  }
  console.log('[smoke] unowned equipment-level save reset to initial state and cleared storage');

  await injectBadCombatNodeSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.resource-strip')`, 'bad combat node save reload renders');
  const badCombatNodeRecovery = await evaluate(
    cdp,
    `(() => ({
      hasSavedKey: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null,
      resourceText: document.querySelector('.resource-strip')?.textContent ?? '',
      bodyText: document.body.textContent
    }))()`
  );
  if (
    badCombatNodeRecovery.hasSavedKey ||
    !badCombatNodeRecovery.resourceText.includes('850') ||
    badCombatNodeRecovery.resourceText.includes('777') ||
    badCombatNodeRecovery.bodyText.includes('bad combat node smoke save')
  ) {
    throw new Error(
      `Bad combat-node save should reset and clear storage: key=${badCombatNodeRecovery.hasSavedKey}, resources=${badCombatNodeRecovery.resourceText}`
    );
  }
  console.log('[smoke] bad combat-node save reset to initial state and cleared storage');

  await injectBadBossPhaseSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'bad boss phase save falls back');
  const badBossPhaseRecovery = await evaluate(
    cdp,
    `(() => ({
      hasSavedKey: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null,
      resourceText: document.querySelector('.resource-strip')?.textContent ?? '',
      bodyText: document.body.textContent
    }))()`
  );
  if (
    badBossPhaseRecovery.hasSavedKey ||
    !badBossPhaseRecovery.resourceText.includes('850') ||
    badBossPhaseRecovery.resourceText.includes('777') ||
    badBossPhaseRecovery.bodyText.includes('bad boss phase smoke save')
  ) {
    throw new Error(`Invalid bossPhase should clear storage and restore the initial state: ${JSON.stringify(badBossPhaseRecovery)}`);
  }
  console.log('[smoke] bossPhase accepts legacy missing/sealed/awakened states and rejects unknown values');

  await injectBadWeaponSkillUsedSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'bad weaponSkillUsed save falls back');
  const badWeaponSkillUsedRecovery = await evaluate(
    cdp,
    `(() => ({
      hasSavedKey: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== null,
      resourceText: document.querySelector('.resource-strip')?.textContent ?? '',
      bodyText: document.body.textContent
    }))()`
  );
  if (
    badWeaponSkillUsedRecovery.hasSavedKey ||
    !badWeaponSkillUsedRecovery.resourceText.includes('850') ||
    badWeaponSkillUsedRecovery.resourceText.includes('777') ||
    badWeaponSkillUsedRecovery.bodyText.includes('bad weapon skill used smoke save')
  ) {
    throw new Error(`Invalid weaponSkillUsed should clear storage and restore the initial state: ${JSON.stringify(badWeaponSkillUsedRecovery)}`);
  }
  console.log('[smoke] weaponSkillUsed accepts legacy missing/boolean states and rejects non-boolean values');

  await injectCloudStepCombatSave(cdp);
  await cdp.send('Page.navigate', { url: appUrl });
  await waitForPage(cdp, `document.querySelector('.combat-panel')?.textContent.includes('云隙步')`, 'cloud step combat save renders');
  const escapeButtonText = await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent.includes('撤离'));
      if (!button) throw new Error('Missing cloud step escape button.');
      return button.textContent;
    })()`
  );
  if (!escapeButtonText.includes('成功后代价 2') || escapeButtonText.includes('云隙步撤离代价 2')) {
    throw new Error(`Cloud step escape hint should describe successful escape cost, got: ${escapeButtonText}`);
  }
  console.log('[smoke] cloud step escape hint describes the success-only cost');

  await runMidgameCombatSmoke(cdp, appUrl);

  await clickButton(cdp, '重开');
  await waitForPage(cdp, `document.querySelectorAll('.dungeon-card').length === ${DUNGEON_COUNT}`, 'restart after cloud step combat hint check');

  await clickCardButton(cdp, '.dungeon-card', '妖塔一层', '进入副本');
  await waitForPage(
    cdp,
    `document.body.textContent.includes('副本探索') &&
      document.querySelector('.dungeon-map') &&
      JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.run.currentNodeId === 'fog_lesser_demon' &&
      document.querySelector('.grid-node.current')?.textContent.includes('当前位置') &&
      ![...document.querySelectorAll('.grid-node.current')].some((node) => node.classList.contains('movable') || node.classList.contains('distant')) &&
      document.querySelector('.route-lock-status')?.textContent.includes('先处理当前怪物') &&
      document.querySelector('.grid-node.route-blocked')?.disabled &&
      !document.querySelector('.grid-node.movable') &&
      [...document.querySelectorAll('.grid-node.distant')].some((node) => node.disabled && node.textContent.includes('未相邻')) &&
      document.querySelector('.grid-node.current .node-type-label')?.textContent.includes('怪物') &&
      document.querySelector('.directive-card')?.textContent.includes('妖塔试炼令') &&
      !document.body.textContent.includes('血字阶梯的呼吸')`,
    'enter first dungeon with directive before node-bound event appears'
  );
  await assertRouteLocked(cdp, 'first dungeon starting node', '先处理当前怪物', '进入战斗');
  await clearCurrentMonsterByAttack(cdp, 'first dungeon starting node');
  await assertRouteUnlocked(cdp, 'cleared first dungeon starting node');
  await clickGridCell(cdp, '血字阶梯');
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current')?.textContent.includes('血字阶梯') &&
      !document.querySelector('.node-action-panel.panel') &&
      document.querySelector('[data-action="trap-risk-blood_rune_trap"]:not(:disabled)') &&
      document.querySelector('.route-lock-status')?.textContent.includes('先处理当前陷阱') &&
      document.querySelector('.grid-node.route-blocked')?.disabled &&
      document.querySelector('.dungeon-event-card')?.textContent.includes('血字阶梯的呼吸') &&
      document.querySelector('.dungeon-event-card')?.textContent.includes('风险')`,
    'move to adjacent grid cell and reveal its event'
  );
  await assertRouteLocked(cdp, 'blood rune trap before event', '先处理当前陷阱', '冒险检定');
  console.log('[smoke] cleared the starting monster through real combat and moved after the route unlocked');

  await clickCardButtonByPointer(cdp, '.dungeon-event-card', '血字阶梯的呼吸', '让灵宠先探阶');
  await waitForPage(
    cdp,
    `document.body.textContent.includes('血字阶梯误判为安全路线') &&
      !document.body.textContent.includes('血字阶梯的呼吸') &&
      document.querySelector('.grid-node.current:not(.cleared)')?.textContent.includes('血字阶梯') &&
      document.querySelector('.route-lock-status')?.textContent.includes('先处理当前陷阱') &&
      document.querySelector('.grid-node.route-blocked')?.disabled`,
    'event resolves without clearing the trap or route lock'
  );
  const repeatedEventButtons = await getEnabledButtonCount(cdp, '让灵宠先探阶');
  if (repeatedEventButtons !== 0) {
    throw new Error(`Resolved dungeon event still has ${repeatedEventButtons} enabled claim button(s).`);
  }
  await assertRouteLocked(cdp, 'blood rune trap after event', '先处理当前陷阱', '冒险检定');
  await clickElementByPointer(cdp, '[data-action="trap-risk-blood_rune_trap"]');
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.cleared')?.textContent.includes('血字阶梯') &&
      !document.querySelector('.route-lock-status') &&
      document.querySelector('.grid-node.movable:not(:disabled)')`,
    'real trap handling clears the route lock'
  );
  await assertRouteUnlocked(cdp, 'handled blood rune trap');
  console.log('[smoke] event resolution leaves the trap locked until the real trap action clears it');

  await clickButton(cdp, '撤回主神空间');
  await waitForPage(
    cdp,
    `document.body.textContent.includes('结算') &&
      document.body.textContent.includes('中途撤回') &&
      document.body.textContent.includes('奖励倍率') &&
      document.querySelector('.next-action-panel')?.textContent.includes('下一步行动')`,
    'retreat settlement'
  );
  await clickButton(cdp, '返回主神空间');
  await waitForPage(
    cdp,
    `[...document.querySelectorAll('.dungeon-card')].some((card) =>
      card.textContent.includes('妖塔一层') &&
      card.textContent.includes('已解锁') &&
      !card.textContent.includes('已完成')
    )`,
    'retreat returns to hub without completing first dungeon'
  );
  console.log('[smoke] retreat settles as partial result and returns without campaign completion');

  // Re-enter with real armor and recovery counters so the legacy route survives the strengthened Boss phases.
  await clickCardButtonByPointer(cdp, '.equipment-card', '破甲剑', '兑换入架');
  await waitForPage(
    cdp,
    `document.querySelector('[data-equipment-id="armor_piercing_sword"] button[data-action="equip-armor_piercing_sword"]')`,
    'mainline boss counter enters the equipment rack'
  );
  await clickCardButtonByPointer(cdp, '.equipment-card', '破甲剑', '装备');
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.equipped.weapon === 'armor_piercing_sword'`,
    'mainline boss counter equips through the real button'
  );
  for (let purchase = 0; purchase < 3; purchase += 1) {
    await clickCardButtonByPointer(cdp, '.shop-card', '止血丹', '兑换');
  }
  await waitForPage(
    cdp,
    `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.inventory.healing_pill >= 3`,
    'mainline boss recovery items purchased through real buttons'
  );

  await clickCardButtonByPointer(cdp, '.dungeon-card', '妖塔一层', '进入副本');
  await waitForPage(cdp, `document.body.textContent.includes('副本探索') && document.querySelectorAll('.grid-node').length >= 30`, 're-enter first dungeon after retreat');
  await assertRouteLocked(cdp, 're-entered first dungeon starting node', '先处理当前怪物', '进入战斗');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel')`, 'advanced weapon regular combat starts');
  const regularSkillBefore = await getWeaponSkillControlState(cdp);
  if (
    !regularSkillBefore.exists ||
    !regularSkillBefore.disabled ||
    regularSkillBefore.statusState !== 'charging' ||
    !regularSkillBefore.text.includes('断岳破甲') ||
    !regularSkillBefore.text.includes('战意未满（0/3）') ||
    !regularSkillBefore.statusText.includes('持久战可重复充能') ||
    regularSkillBefore.weaponFocus !== 0 ||
    regularSkillBefore.hasLegacyWeaponSkillUsed ||
    !regularSkillBefore.pointerTarget ||
    regularSkillBefore.pageScrollWidth > regularSkillBefore.pageClientWidth + 1
  ) {
    throw new Error(`A new advanced-weapon encounter should expose a stable 0/3 charging command: ${JSON.stringify(regularSkillBefore)}`);
  }
  await finishActiveCombatByAttack(cdp, 're-entered first dungeon starting node');
  console.log('[smoke] new encounters start at explicit 0/3 focus while the prior real-pointer route clear remains intact');
  await assertRouteUnlocked(cdp, 're-entered cleared starting node');
  await clickGridCell(cdp, '血字阶梯');
  await assertRouteLocked(cdp, 're-entered blood rune trap', '先处理当前陷阱', '冒险检定');
  await clickElementByPointer(cdp, '[data-action="trap-risk-blood_rune_trap"]');
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.cleared')?.textContent.includes('血字阶梯') &&
      !document.querySelector('.route-lock-status')`,
    'blood rune trap clears before leaving'
  );
  await assertRouteUnlocked(cdp, 're-entered cleared blood rune trap');
  await clickGridCell(cdp, '裂缝石门');
  await assertRouteUnlocked(cdp, 'portal node stays unlocked', false);
  await clickGridCell(cdp, '雾后暗格');
  await assertRouteUnlocked(cdp, 'reward node stays unlocked', false);
  await clickGridCell(cdp, '白光裂口');
  await assertRouteUnlocked(cdp, 'exit node stays unlocked', false);
  const sealedMainlineExit = await getButtonState(cdp, '完成副本');
  if (
    !sealedMainlineExit.disabled ||
    !sealedMainlineExit.text.includes('封印中') ||
    !sealedMainlineExit.text.includes('雾塔剔骨监斩官')
  ) {
    throw new Error(`Mainline exit should remain sealed until its unique Boss is cleared: ${JSON.stringify(sealedMainlineExit)}`);
  }
  await clickGridCell(cdp, '骨巷塔卒');
  await waitForPage(
    cdp,
    `document.querySelector('.grid-node.current.boss-node[data-boss-node="true"]')?.textContent.includes('骨巷塔卒')`,
    'mainline route reaches the unique boss node'
  );
  await assertRouteLocked(cdp, 'mainline boss before combat', '先处理当前怪物', '进入战斗');
  await clickButtonByPointer(cdp, '进入战斗', '.node-action-panel');
  await waitForPage(cdp, `document.querySelector('.combat-panel[data-boss-phase="sealed"]')`, 'mainline boss combat starts');
  const mainlineBossSkillBefore = await getWeaponSkillControlState(cdp);
  if (
    !mainlineBossSkillBefore.exists ||
    !mainlineBossSkillBefore.disabled ||
    mainlineBossSkillBefore.statusState !== 'charging' ||
    mainlineBossSkillBefore.weaponFocus !== 0 ||
    mainlineBossSkillBefore.hasLegacyWeaponSkillUsed ||
    mainlineBossSkillBefore.bossPhase !== 'sealed'
  ) {
    throw new Error(`A new legal Boss battle should start at explicit 0/3 focus: ${JSON.stringify(mainlineBossSkillBefore)}`);
  }
  let mainlineBossAwakened = false;
  for (let actionCount = 0; actionCount < 20; actionCount += 1) {
    const combatState = await evaluate(
      cdp,
      `(() => {
        const saved = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state;
        const healButton = [...document.querySelectorAll('.combat-panel button')].find((button) =>
          button.textContent.includes('止血丹')
        );
        return {
          active: Boolean(document.querySelector('.combat-panel')),
          playerHp: saved.player.hp,
          playerMaxHp: saved.player.maxHp,
          canHeal: Boolean(healButton && !healButton.disabled),
          bossPhase: saved.combat?.bossPhase
        };
      })()`
    );
    if (!combatState.active) break;
    if (combatState.bossPhase === 'awakened') mainlineBossAwakened = true;

    const shouldHeal = combatState.canHeal && combatState.playerHp <= combatState.playerMaxHp * 0.45;
    await clickButtonByPointer(cdp, shouldHeal ? '止血丹' : '攻击', '.combat-panel');
  }
  await waitForPage(
    cdp,
    `!document.querySelector('.combat-panel') &&
      document.querySelector('.grid-node.current.boss-node.cleared[data-boss-node="true"]')`,
    'mainline strengthened boss clears through pointer combat'
  );
  if (!mainlineBossAwakened) {
    throw new Error('Mainline Boss should reach its half-health awakened phase during real pointer combat.');
  }
  await waitForPage(cdp, `document.querySelector('.equipment-loot-offer')`, 'mainline boss equipment offer');
  await clickButtonByPointer(cdp, '放弃', '.node-action-panel');
  await waitForPage(
    cdp,
    `!document.querySelector('.equipment-loot-offer') &&
      document.querySelector('.boss-seal-progress[data-boss-seal="cleared"]')?.textContent.includes('出口封印 1/1')`,
    'mainline boss clears the exit seal after loot handling'
  );
  await assertRouteUnlocked(cdp, 'mainline boss cleared');
  await clickGridCell(cdp, '白光裂口');
  await waitForPage(cdp, `document.querySelector('.grid-node.current')?.textContent.includes('白光裂口')`, 'return to unsealed exit');
  await clickButtonByPointer(cdp, '完成副本', '.node-action-panel');
  await waitForPage(
    cdp,
    `document.body.textContent.includes('结算') &&
      document.body.textContent.includes('奖励倍率') &&
      document.querySelector('.next-action-panel')?.textContent.includes('下一步行动')`,
    'first dungeon settlement'
  );
  await clickButton(cdp, '返回主神空间');
  await waitForPage(
    cdp,
    `document.querySelector('.dungeon-card')?.textContent.includes('已完成') &&
      [...document.querySelectorAll('.dungeon-card')].some((card) =>
        card.textContent.includes('镜潮地铁') && card.textContent.includes('锁定')
      ) &&
      document.querySelector('.task-trigger')?.textContent.includes('妖塔一层') &&
      document.querySelector('.task-trigger')?.textContent.includes('可领取')`,
    'first clear returns to hub but next chapter stays locked before claiming mainline'
  );
  const clearedTaskModal = await openTaskModal(cdp, 'first clear');
  if (!clearedTaskModal.dialogText.includes('妖塔一层') || !clearedTaskModal.dialogText.includes('可领取')) {
    throw new Error(`First clear task modal should show the demon tower mainline as claimable, got ${JSON.stringify(clearedTaskModal)}`);
  }
  console.log('[smoke] first clear returns to hub without unlocking the next chapter before mainline claim');

  await clickCardButton(cdp, '.mainline-task-panel', '妖塔一层', '领取');
  await waitForPage(
    cdp,
    `[...document.querySelectorAll('.dungeon-card')].some((card) =>
        card.textContent.includes('镜潮地铁') && card.textContent.includes('下一推荐')
      ) &&
      document.querySelector('[role="dialog"][aria-modal="true"]')?.textContent.includes('镜潮地铁') &&
      document.querySelector('[role="dialog"][aria-modal="true"]')?.textContent.includes('进行中')`,
    'claiming first mainline unlocks second chapter recommendation'
  );
  const claimedTaskIds = await evaluate(
    cdp,
    `(() => JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).state.claimedTaskIds)()`
  );
  if (!Array.isArray(claimedTaskIds) || !claimedTaskIds.includes('mainline_clear_demon_tower_1')) {
    throw new Error(`Claimed mainline task should persist claimedTaskIds, got ${JSON.stringify(claimedTaskIds)}`);
  }
  await waitForPage(
    cdp,
    `[...document.querySelectorAll('.side-task-card')].length >= 2 &&
      [...document.querySelectorAll('.side-task-card')].some((card) =>
        card.textContent.includes('镜潮地铁')
      )`,
    'second chapter side tasks render after mainline claim'
  );
  await clickDialogButton(cdp, '重开');
  await waitForPage(
    cdp,
    `(() => {
      const compactText = (element) => element?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const appContent = document.querySelector('.app-content');
      const dungeonCards = [...document.querySelectorAll('.dungeon-card')].map(compactText);
      const routeText = compactText(document.querySelector('.campaign-route-panel'));
      return !document.querySelector('[role="dialog"][aria-modal="true"]') &&
        !document.body.classList.contains('modal-open') &&
        !Boolean(appContent?.hasAttribute('inert') || appContent?.inert) &&
        document.activeElement === document.querySelector('.task-trigger') &&
        localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === null &&
        document.querySelector('.resource-strip')?.textContent.includes('850') &&
        document.querySelector('.task-trigger')?.textContent.includes('妖塔一层') &&
        document.querySelector('.task-trigger')?.textContent.includes('0 可领取') &&
        dungeonCards.some((card) => card.includes('妖塔一层') && card.includes('已解锁') && !card.includes('已完成')) &&
        dungeonCards.every((card) => !card.includes('已完成')) &&
        routeText.includes('推演终局 ${DUNGEON_COUNT}/${DUNGEON_COUNT}') &&
        !/终局完成|已完成|完成\\s+\\d\\/${DUNGEON_COUNT}/.test(routeText) &&
        !document.body.textContent.includes('镜潮地铁 可领取');
    })()`,
    'restart from open completed task modal clears task and challenge progress'
  );
  console.log('[smoke] claiming first mainline task unlocks the second chapter, persists claimedTaskIds, and restart from the open task modal clears progress');

  await runTacticalLoadoutSaveValidationSmoke(cdp, appUrl);
  await runTacticalLoadoutPointerSmoke(cdp, appUrl);
  await runFieldSurveySmoke(cdp, appUrl);
  await runEquipmentHuntSmoke(cdp, appUrl);
  await runEquipmentMemoryHuntSmoke(cdp, appUrl);
  await runRunPursuitSmoke(cdp, appUrl);
  await runPanopticonCityPointerSmoke(cdp, appUrl);
  await resetEquipmentSoulSmokeState(cdp, appUrl);
  console.log('[smoke] final cleanup restores an empty localStorage and the 1440x900 new-game hub');
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run the automated UI smoke.');
  }

  const externalAppUrl = process.env.SMOKE_APP_URL?.trim();
  const appPort = externalAppUrl ? undefined : await getFreePort();
  const debugPort = await getFreePort();
  const profileDir = await mkdtemp(path.join(tmpdir(), 'infinite-flow-smoke-'));
  const viteCommand = externalAppUrl ? undefined : getLocalViteCommand();
  const appUrl = externalAppUrl ? new URL(externalAppUrl).href : `http://127.0.0.1:${appPort}/`;
  let vite;
  let chrome;
  let cdp;

  try {
    let viteStdout = '';
    let viteStderr = '';
    if (externalAppUrl) {
      await waitForHttp(appUrl, 'existing Vite dev server');
    } else if (viteCommand && appPort !== undefined) {
      vite = spawn(viteCommand.command, [...viteCommand.args, '--host', '127.0.0.1', '--port', String(appPort), '--strictPort'], {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, BROWSER: 'none' },
        ...processGroupSpawnOptions()
      });
      vite.stdout.on('data', (data) => {
        viteStdout += data.toString();
      });
      vite.stderr.on('data', (data) => {
        viteStderr += data.toString();
      });

      try {
        await waitForHttpOrChildError(vite, appUrl, 'Vite dev server');
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\n\n${formatProcessOutput('Vite stdout', viteStdout)}\n\n${formatProcessOutput(
            'Vite stderr',
            viteStderr
          )}`
        );
      }
      if (vite.exitCode !== null) {
        throw new Error(`Vite exited early:\n${formatProcessOutput('Vite stdout', viteStdout)}\n\n${formatProcessOutput('Vite stderr', viteStderr)}`);
      }
    }

    chrome = spawn(
      chromePath,
      [
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profileDir}`,
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], ...processGroupSpawnOptions() }
    );

    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 'Chrome DevTools', 30000);
    const target = await createPage(debugPort, appUrl);
    cdp = new CdpSession(target.webSocketDebuggerUrl);
    await cdp.open();
    await runSmoke(cdp, appUrl);
  } finally {
    if (cdp) cdp.close();
    await stopProcess(chrome);
    await stopProcess(vite);
    await rm(profileDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
