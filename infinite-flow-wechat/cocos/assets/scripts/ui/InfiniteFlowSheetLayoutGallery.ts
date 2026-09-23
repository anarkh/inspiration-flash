import {
  BlockInputEvents,
  Color,
  Graphics,
  Label,
  Node,
  UITransform,
} from 'cc';
import { type InfiniteFlowClient } from '@infinite-flow/client';
import { buildGameViewModel, type GameViewModel } from '@infinite-flow/presentation';
import {
  renderInfiniteFlowInfoSheet,
  type MobilePanelKind,
  type MobileSheetState,
} from './InfiniteFlowInfoSheet';
import { DARK_UI, paintDarkFrame } from './dark-ui';
import type { SheetLayoutStyle } from './sheet-layout';
import type { SheetImageLibrary } from './sheet-kit';
import {
  SHEET_DUNGEON_BANNER_KEY,
  SHEET_PORTRAIT_KEY,
  SHEET_SCENE_BANNER_KEY,
  sheetEquipmentKey,
  sheetItemKey,
} from './sheet-kit';
import { SHEET_LAYOUT_STYLES } from './sheet-layout-styles';
import { preloadGalleryImages, type GalleryImageLibraryHandle } from './sheet-gallery-images';
import {
  BAR_GAP,
  BAR_WIDTH,
  DESIGN_WIDTH,
  GALLERY_TOUCH,
  bindGalleryPress,
  createGalleryClient,
  galleryInsets,
  makeGalleryNode,
  measureSurfaceHeight,
} from './sheet-gallery-shared';

/**
 * Debug-only layout gallery (?gallery=2 in web-mobile debug builds). Same
 * overlay/switcher discipline as the v1 skin gallery, but each switch awaits
 * the style's raster preload before mounting ("展卷中…" caption) and passes
 * the layout seam. Production never imports this module.
 */

const UI_LAYER = 1 << 25;
const TOUCH = GALLERY_TOUCH;

const GALLERY_KINDS: readonly MobilePanelKind[] = ['character', 'menu', 'inventory'];

const EQUIPMENT_IDS = [
  'training_blade', 'patched_headwrap', 'patched_coat', 'patched_gloves',
  'patched_boots', 'patched_belt', 'plain_charm',
] as const;
const ITEM_IDS = [
  'healing_pill', 'thunder_talisman', 'dispel_talisman', 'gate_sigil',
  'echo_coin', 'capture_net', 'spirit_bait', 'armor_patch', 'focus_incense',
] as const;

function imageKeysForStyle(style: SheetLayoutStyle): readonly string[] {
  const policy = style.imagePolicy;
  const keys: string[] = [];
  if (policy.portrait) keys.push(SHEET_PORTRAIT_KEY);
  if (policy.equipmentIcons) keys.push(...EQUIPMENT_IDS.map((id) => sheetEquipmentKey(id)));
  if (policy.itemIcons) keys.push(...ITEM_IDS.map((id) => sheetItemKey(id)));
  if (policy.banners) keys.push(SHEET_SCENE_BANNER_KEY, SHEET_DUNGEON_BANNER_KEY);
  return keys;
}

export function sheetLayoutGalleryRequested(): boolean {
  const global = globalThis as { wx?: unknown; location?: { search?: string } };
  if (global.wx !== undefined) return false;
  try {
    return new URLSearchParams(global.location?.search ?? '').get('gallery') === '2';
  } catch {
    return false;
  }
}

export type InfiniteFlowSheetLayoutGalleryHandle = Readonly<{
  root: Node;
  dispose: () => void;
}>;

export async function startInfiniteFlowSheetLayoutGallery(canvas: Node): Promise<InfiniteFlowSheetLayoutGalleryHandle> {
  const client = await createGalleryClient();
  const host = new Node('SheetLayoutGalleryHost');
  host.layer = UI_LAYER;
  canvas.addChild(host);
  let disposed = false;
  let imageHandle: GalleryImageLibraryHandle | undefined;
  const teardown = (): void => {
    if (disposed) return;
    disposed = true;
    imageHandle?.dispose();
    host.destroy();
    try {
      client.dispose();
    } catch {
      // Teardown best-effort; the page owns the WebGL process anyway.
    }
  };
  const controller = new LayoutGalleryController(host, client, measureSurfaceHeight(canvas), teardown,
    (handle) => { imageHandle?.dispose(); imageHandle = handle; },
    () => imageHandle?.images);
  await controller.showStyle(0, { kind: 'character', page: 0 });

  return { root: host, dispose: teardown };
}

class LayoutGalleryController {
  private styleIndex = 0;
  private kindIndex = 0;
  private galleryRoot: Node | undefined;
  private mountNode: Node | undefined;
  private barNode: Node | undefined;
  private loading = false;

  constructor(
    private readonly host: Node,
    private readonly client: InfiniteFlowClient,
    private readonly surfaceHeight: number,
    private readonly requestExit: () => void,
    private readonly retainImages: (handle: GalleryImageLibraryHandle) => void,
    private readonly currentImages: () => SheetImageLibrary | undefined,
  ) {}

  private get style(): SheetLayoutStyle {
    return SHEET_LAYOUT_STYLES[this.styleIndex]!;
  }

  private get kind(): MobilePanelKind {
    return GALLERY_KINDS[this.kindIndex]!;
  }

  private modelFor(kind: MobilePanelKind): GameViewModel {
    return buildGameViewModel(this.client.getState(), {
      hubPanel: kind === 'inventory' ? 'supplies' : undefined,
    });
  }

  dispose(): void {
    this.requestExit();
  }

  /**
   * Preload this style's raster keys before the synchronous mount. While a
   * load is in flight the bar caption reads "展卷中…"; an await that resolves
   * after disposal leaves the tree untouched.
   */
  async showStyle(index: number, state: MobileSheetState): Promise<void> {
    if (index < 0 || index >= SHEET_LAYOUT_STYLES.length || this.loading) return;
    this.loading = true;
    this.styleIndex = index;
    this.mountShell('展卷中…');
    const style = SHEET_LAYOUT_STYLES[index]!;
    const handle = await preloadGalleryImages(imageKeysForStyle(style));
    this.loading = false;
    if (this.destroyedHost()) return;
    this.retainImages(handle);
    this.kindIndex = GALLERY_KINDS.indexOf(state.kind as MobilePanelKind);
    if (this.kindIndex < 0) this.kindIndex = 0;
    this.mountShell();
    this.renderSheet(state);
  }

  private destroyedHost(): boolean {
    return !this.host.isValid;
  }

  /** Full rebuild: shade, empty mount and switcher bar (loading caption optional). */
  private mountShell(loadingCaption?: string): void {
    this.galleryRoot?.destroy();
    const root = makeGalleryNode(this.host, 'SheetGalleryRoot', 0, 0, DESIGN_WIDTH, this.surfaceHeight);
    root.addComponent(BlockInputEvents);
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(5, 5, 7, 200);
    shade.rect(-DESIGN_WIDTH / 2, -this.surfaceHeight / 2, DESIGN_WIDTH, this.surfaceHeight);
    shade.fill();
    this.galleryRoot = root;

    this.mountNode = makeGalleryNode(root, 'SheetGallerySheetMount', 0, 0, DESIGN_WIDTH, this.surfaceHeight);

    this.barNode = makeGalleryNode(
      root,
      'SheetGalleryBar',
      0,
      this.surfaceHeight / 2 - 16 - (TOUCH * 2 + BAR_GAP) / 2,
      BAR_WIDTH,
      TOUCH * 2 + BAR_GAP,
    );
    this.renderBar(loadingCaption);
  }

  private renderSheet(state: MobileSheetState): void {
    const mount = this.mountNode;
    if (!mount) return;
    mount.removeAllChildren();
    renderInfiniteFlowInfoSheet(mount, this.modelFor(state.kind), state, {
      safeInsets: galleryInsets(),
      surfaceHeight: this.surfaceHeight,
      chrome: {
        modeKind: 'preview',
        modeLabel: '版式画廊',
        modeDetail: '仅预览，不写入存档',
      },
      theme: this.style.theme,
      layout: this.style.layout,
      images: this.currentImages(),
      bindLocal: (node, callback) => bindGalleryPress(node, callback),
      bindAction() {},
      close: () => this.remountCurrent(),
      setState: (next) => this.applySheetState(next),
      openHelp() {},
    });
  }

  private remountCurrent(): void {
    this.mountShell();
    this.renderSheet({ kind: this.kind, page: 0 });
  }

  private applySheetState(state: MobileSheetState): void {
    const nextKindIndex = GALLERY_KINDS.indexOf(state.kind as MobilePanelKind);
    if (nextKindIndex >= 0 && nextKindIndex !== this.kindIndex) {
      this.kindIndex = nextKindIndex;
      this.mountShell();
      this.renderSheet(state);
      return;
    }
    this.renderSheet(nextKindIndex >= 0 ? state : { kind: this.kind, page: 0 });
  }

  private setKind(index: number): void {
    this.kindIndex = index;
    this.mountShell();
    this.renderSheet({ kind: GALLERY_KINDS[index]!, page: 0 });
  }

  private renderBar(loadingCaption?: string): void {
    const bar = this.barNode;
    if (!bar) return;
    bar.removeAllChildren();
    const rowHeight = TOUCH;
    const topY = rowHeight / 2 + BAR_GAP / 2;
    const bottomY = -rowHeight / 2 - BAR_GAP / 2;

    const sideWidth = 150;
    const centerWidth = BAR_WIDTH - sideWidth * 2;
    this.control(bar, 'SheetGalleryPrevStyle', '上一样式', -BAR_WIDTH / 2 + sideWidth / 2, topY, sideWidth,
      this.styleIndex > 0, () => { void this.showStyle(this.styleIndex - 1, { kind: this.kind, page: 0 }); });
    this.caption(bar, 'SheetGalleryStyleId',
      loadingCaption ?? `${this.styleIndex + 1} / ${SHEET_LAYOUT_STYLES.length} · ${this.style.name}`,
      loadingCaption ? '加载在册图绘' : this.style.reference, 0, topY, centerWidth);
    this.control(bar, 'SheetGalleryNextStyle', '下一样式', BAR_WIDTH / 2 - sideWidth / 2, topY, sideWidth,
      this.styleIndex < SHEET_LAYOUT_STYLES.length - 1,
      () => { void this.showStyle(this.styleIndex + 1, { kind: this.kind, page: 0 }); });

    const choiceWidth = (BAR_WIDTH - BAR_GAP * 3) / 4;
    const choice = (index: number, name: string, label: string, active: boolean): void => {
      const x = -BAR_WIDTH / 2 + choiceWidth / 2 + index * (choiceWidth + BAR_GAP);
      this.control(bar, name, label, x, bottomY, choiceWidth, true, () => this.setKind(index), active);
    };
    choice(0, 'SheetGalleryKind:character', '角色', this.kindIndex === 0);
    choice(1, 'SheetGalleryKind:menu', '菜单', this.kindIndex === 1);
    choice(2, 'SheetGalleryKind:inventory', '背包', this.kindIndex === 2);
    this.control(bar, 'SheetGalleryExit', '退出画廊',
      -BAR_WIDTH / 2 + choiceWidth / 2 + 3 * (choiceWidth + BAR_GAP), bottomY, choiceWidth, true,
      () => this.dispose(), false);
  }

  private control(
    parent: Node,
    name: string,
    label: string,
    x: number,
    y: number,
    width: number,
    enabled: boolean,
    activate: () => void,
    active = false,
  ): void {
    const node = makeGalleryNode(parent, name, x, y, width, TOUCH);
    const g = node.addComponent(Graphics);
    paintDarkFrame(g, width, TOUCH, {
      fill: active ? DARK_UI.goldDark : DARK_UI.raised,
      edge: !enabled ? DARK_UI.edge : active ? DARK_UI.gold : DARK_UI.edgeLight,
      accent: DARK_UI.gold,
      cut: 8,
      ornate: false,
    });
    const textNode = makeGalleryNode(node, 'Label', 0, 0, width - 20, 76);
    const text = textNode.addComponent(Label);
    text.string = label;
    text.fontSize = 27;
    text.lineHeight = 37;
    text.color = enabled ? (active ? DARK_UI.gold : DARK_UI.bone) : DARK_UI.muted;
    text.horizontalAlign = Label.HorizontalAlign.CENTER;
    text.verticalAlign = Label.VerticalAlign.CENTER;
    text.enableWrapText = true;
    text.overflow = Label.Overflow.SHRINK;
    if (enabled) bindGalleryPress(node, activate);
  }

  private caption(parent: Node, name: string, title: string, reference: string, x: number, y: number, width: number): void {
    const node = makeGalleryNode(parent, name, x, y, width, TOUCH);
    const g = node.addComponent(Graphics);
    paintDarkFrame(g, width, TOUCH, {
      fill: DARK_UI.quiet,
      edge: DARK_UI.edge,
      accent: DARK_UI.gold,
      cut: 8,
      ornate: false,
    });
    labelOn(node, 'CaptionTitle', title, 18, 28, DARK_UI.gold);
    labelOn(node, 'CaptionReference', reference, -22, 18, DARK_UI.muted);
  }
}

function labelOn(parent: Node, name: string, value: string, y: number, fontSize: number, color: Color): void {
  const width = parent.getComponent(UITransform)!.contentSize.width;
  const labelNode = makeGalleryNode(parent, name, 0, y, width - 28, fontSize + 12);
  const label = labelNode.addComponent(Label);
  label.string = value;
  label.fontSize = fontSize;
  label.lineHeight = Math.ceil(fontSize * 1.3);
  label.color = color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.enableWrapText = false;
  label.overflow = Label.Overflow.SHRINK;
}
