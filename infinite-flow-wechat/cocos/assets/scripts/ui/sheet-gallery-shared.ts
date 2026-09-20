// Shared machinery for the debug sheet galleries (?gallery=1 skins and
// ?gallery=2 layouts): in-memory fixture client, gallery geometry constants
// and the press-binding/node helpers. Gallery-only — imported solely by the
// guarded app branches and gallery modules.
import {
  EventTouch,
  Node,
  Size,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { createInfiniteFlowClient, type InfiniteFlowClient } from '@infinite-flow/client';
import { InMemoryStoragePort, PortableSha256HashPort, SequenceSeedPort } from '@infinite-flow/runtime';
import {
  INFINITE_FLOW_PREVIEW_SAFE_INSETS,
  type InfiniteFlowSafeInsets,
} from './InfiniteFlowView';

export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;
export const UI_LAYER = 1 << 25;
export const GALLERY_TOUCH = 104;
export const BAR_GAP = 16;
export const BAR_WIDTH = DESIGN_WIDTH - 32;
/** Vertical space the two-row switcher bar reserves above the sheet. */
export const BAR_RESERVED_TOP = 232;

function previewSeeds(): readonly number[] {
  const values: number[] = [];
  for (let index = 0; index < 1024; index += 1) {
    const candidate = (0x51f1_5e5d + Math.imul(index + 1, 0x9e37_79b1)) >>> 0;
    values.push(candidate === 0 ? index + 1 : candidate);
  }
  return values;
}

/**
 * Build the in-memory gallery client and enrich its fixture along the real
 * command path (best-effort: a rejected command keeps the prior state; the
 * gallery is cosmetic and stays renderable).
 */
export async function createGalleryClient(): Promise<InfiniteFlowClient> {
  const client = await createInfiniteFlowClient({
    storage: new InMemoryStoragePort(),
    seedPort: new SequenceSeedPort(previewSeeds()),
    hashPort: new PortableSha256HashPort(),
  });
  const dispatchIgnored = async (command: Parameters<InfiniteFlowClient['dispatch']>[0]): Promise<void> => {
    try {
      await client.dispatch(command);
    } catch {
      // Cosmetic preview fixture: enrichment rejection is not actionable.
    }
  };
  // Starting save carries 850 reward points: stay inside it so every dispatch
  // commits (healing 120 x3, dispel 240, gate 220 = 820).
  for (const [itemId, amount] of [
    ['healing_pill', 3],
    ['dispel_talisman', 1],
    ['gate_sigil', 1],
  ] as const) {
    for (let purchased = 0; purchased < amount; purchased += 1) {
      await dispatchIgnored({ type: 'hub/buy-item', itemId });
    }
  }
  await dispatchIgnored({
    type: 'hub/configure-tactical-loadout',
    itemIds: ['healing_pill', 'dispel_talisman', 'gate_sigil'],
  });
  await dispatchIgnored({ type: 'hub/learn-method', methodId: 'mist_breathing' });
  await dispatchIgnored({ type: 'hub/recruit-companion', companionId: 'qin_che' });
  await dispatchIgnored({ type: 'hub/unlock-bloodline', bloodlineId: 'titan_marrow' });
  return client;
}

export function measureSurfaceHeight(canvas: Node): number {
  const canvasHeight = canvas.getComponent?.(UITransform)?.contentSize.height;
  if (canvasHeight !== undefined && canvasHeight > 0 && Number.isFinite(canvasHeight)) {
    return Math.max(DESIGN_HEIGHT, canvasHeight);
  }
  const frame = view.getFrameSize();
  return frame.width > 0
    ? Math.max(DESIGN_HEIGHT, DESIGN_WIDTH * frame.height / frame.width)
    : DESIGN_HEIGHT;
}

export function galleryInsets(): InfiniteFlowSafeInsets {
  return {
    ...INFINITE_FLOW_PREVIEW_SAFE_INSETS,
    top: INFINITE_FLOW_PREVIEW_SAFE_INSETS.top + BAR_RESERVED_TOP,
  };
}

export function makeGalleryNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const child = new Node(name);
  child.layer = UI_LAYER;
  parent.addChild(child);
  child.setPosition(new Vec3(x, y, 0));
  child.addComponent(UITransform).setContentSize(new Size(width, height));
  return child;
}

/** Press-activate binding matching the production sheet: START arms, END fires. */
export function bindGalleryPress(node: Node, activate: () => void): void {
  let armed = false;
  node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
    event.propagationStopped = true;
    armed = true;
  });
  node.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
    event.propagationStopped = true;
    armed = false;
  });
  node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
    event.propagationStopped = true;
    if (!armed) return;
    armed = false;
    activate();
  });
}
