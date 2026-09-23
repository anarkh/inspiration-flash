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
import { GALLERY_SHEET_THEMES } from './sheet-styles';
import type { SheetTheme } from './sheet-theme';
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
 * Debug-only style gallery (?gallery=1 in web-mobile debug builds). Owns an
 * in-memory client + fixture VM and overlays the real sheet renderer with a
 * switcher bar. The only DOM access lives in sheetGalleryRequested(); the
 * production entry guards the import with HTML5 && DEBUG.
 */

const UI_LAYER = 1 << 25;
const TOUCH = GALLERY_TOUCH;

const GALLERY_KINDS: readonly MobilePanelKind[] = ['character', 'menu', 'inventory'];

export function sheetGalleryRequested(): boolean {
  const global = globalThis as { wx?: unknown; location?: { search?: string } };
  if (global.wx !== undefined) return false;
  try {
    return new URLSearchParams(global.location?.search ?? '').get('gallery') === '1';
  } catch {
    return false;
  }
}

export type InfiniteFlowSheetGalleryHandle = Readonly<{
  root: Node;
  dispose: () => void;
}>;

/**
 * Build the gallery overlay under canvas. Resolves once the in-memory client is
 * ready; the caller owns disposal on exit or component destruction.
 */
export async function startInfiniteFlowSheetGallery(canvas: Node): Promise<InfiniteFlowSheetGalleryHandle> {
  const client = await createGalleryClient();
  const host = new Node('SheetGalleryHost');
  host.layer = UI_LAYER;
  canvas.addChild(host);
  let disposed = false;
  const teardown = (): void => {
    if (disposed) return;
    disposed = true;
    host.destroy();
    try {
      client.dispose();
    } catch {
      // Teardown best-effort; the page owns the WebGL process anyway.
    }
  };
  const controller = new GalleryController(host, client, measureSurfaceHeight(canvas), teardown);
  controller.mount();

  return { root: host, dispose: teardown };
}

class GalleryController {
  private themeIndex = 0;
  private kindIndex = 0;
  private galleryRoot: Node | undefined;
  private mountNode: Node | undefined;
  private barNode: Node | undefined;

  constructor(
    private readonly host: Node,
    private readonly client: InfiniteFlowClient,
    private readonly surfaceHeight: number,
    private readonly requestExit: () => void,
  ) {}

  private get theme(): SheetTheme {
    return GALLERY_SHEET_THEMES[this.themeIndex]!;
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

  /** Full rebuild: overlay shade, sheet mount and switcher bar. */
  mount(): void {
    this.galleryRoot?.destroy();
    const root = makeGalleryNode(this.host, 'SheetGalleryRoot', 0, 0, DESIGN_WIDTH, this.surfaceHeight);
    root.addComponent(BlockInputEvents);
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(5, 5, 7, 200);
    shade.rect(-DESIGN_WIDTH / 2, -this.surfaceHeight / 2, DESIGN_WIDTH, this.surfaceHeight);
    shade.fill();
    this.galleryRoot = root;

    this.mountNode = makeGalleryNode(root, 'SheetGallerySheetMount', 0, 0, DESIGN_WIDTH, this.surfaceHeight);
    this.renderSheet({ kind: this.kind, page: 0 });

    this.barNode = makeGalleryNode(
      root,
      'SheetGalleryBar',
      0,
      this.surfaceHeight / 2 - 16 - (TOUCH * 2 + BAR_GAP) / 2,
      BAR_WIDTH,
      TOUCH * 2 + BAR_GAP,
    );
    this.renderBar();
  }

  /** Rebuild only the sheet subtree (tabs/paging/metric drill stay inside the theme). */
  private renderSheet(state: MobileSheetState): void {
    const mount = this.mountNode;
    if (!mount) return;
    mount.removeAllChildren();
    renderInfiniteFlowInfoSheet(mount, this.modelFor(state.kind), state, {
      safeInsets: galleryInsets(),
      surfaceHeight: this.surfaceHeight,
      chrome: {
        modeKind: 'preview',
        modeLabel: '样式画廊',
        modeDetail: '仅预览，不写入存档',
      },
      theme: this.theme,
      bindLocal: (node, callback) => bindGalleryPress(node, callback),
      // Preview never executes domain commands; the chrome copy says so.
      bindAction() {},
      close: () => this.mount(),
      setState: (next) => this.applySheetState(next),
      openHelp() {},
    });
  }

  private applySheetState(state: MobileSheetState): void {
    const nextKindIndex = GALLERY_KINDS.indexOf(state.kind as MobilePanelKind);
    if (nextKindIndex >= 0 && nextKindIndex !== this.kindIndex) {
      // Cross-panel navigation from the menu tiles: full mount refreshes the bar.
      this.kindIndex = nextKindIndex;
      this.mount();
      return;
    }
    this.renderSheet(nextKindIndex >= 0 ? state : { kind: this.kind, page: 0 });
  }

  private setTheme(index: number): void {
    if (index < 0 || index >= GALLERY_SHEET_THEMES.length) return;
    this.themeIndex = index;
    this.mount();
  }

  private setKind(index: number): void {
    this.kindIndex = index;
    this.mount();
  }

  private renderBar(): void {
    const bar = this.barNode;
    if (!bar) return;
    bar.removeAllChildren();
    const rowHeight = TOUCH;
    const topY = rowHeight / 2 + BAR_GAP / 2;
    const bottomY = -rowHeight / 2 - BAR_GAP / 2;

    // Row 1: previous theme · theme label · next theme (ends disabled, no wrap).
    const sideWidth = 150;
    const centerWidth = BAR_WIDTH - sideWidth * 2;
    this.control(bar, 'SheetGalleryPrevTheme', '上一样式', -BAR_WIDTH / 2 + sideWidth / 2, topY, sideWidth,
      this.themeIndex > 0, () => this.setTheme(this.themeIndex - 1));
    this.caption(bar, 'SheetGalleryThemeId',
      `${this.themeIndex + 1} / ${GALLERY_SHEET_THEMES.length} · ${this.theme.name}`,
      this.theme.reference, 0, topY, centerWidth);
    this.control(bar, 'SheetGalleryNextTheme', '下一样式', BAR_WIDTH / 2 - sideWidth / 2, topY, sideWidth,
      this.themeIndex < GALLERY_SHEET_THEMES.length - 1, () => this.setTheme(this.themeIndex + 1));

    // Row 2: character / menu / inventory / exit.
    const choiceWidth = (BAR_WIDTH - BAR_GAP * 3) / 4;
    const choice = (index: number, name: string, label: string, active: boolean, enabled: boolean, activate: () => void): void => {
      const x = -BAR_WIDTH / 2 + choiceWidth / 2 + index * (choiceWidth + BAR_GAP);
      this.control(bar, name, label, x, bottomY, choiceWidth, enabled, activate, active);
    };
    choice(0, 'SheetGalleryKind:character', '角色', this.kindIndex === 0, true, () => this.setKind(0));
    choice(1, 'SheetGalleryKind:menu', '菜单', this.kindIndex === 1, true, () => this.setKind(1));
    choice(2, 'SheetGalleryKind:inventory', '背包', this.kindIndex === 2, true, () => this.setKind(2));
    choice(3, 'SheetGalleryExit', '退出画廊', false, true, () => this.dispose());
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
