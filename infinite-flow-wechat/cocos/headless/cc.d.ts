/**
 * Minimal `cc` surface used only by `tsconfig.headless.json` before Creator has
 * generated `temp/tsconfig.cocos.json`. This directory is outside `assets`, so
 * Creator never imports the shim or merges it with the real engine declarations.
 */
declare module 'cc' {
  export const _decorator: {
    ccclass: (name: string) => ClassDecorator;
  };

  export class Component {
    node: Node;
    start?(): void;
    onDestroy?(): void;
  }

  export class Asset {
    readonly uuid: string;
    addRef(): Asset;
    decRef(autoRelease?: boolean): Asset;
    destroy(): boolean;
  }

  export class JsonAsset extends Asset {
    json: Record<string, unknown> | null;
  }

  export class ImageAsset extends Asset {
    width: number;
    height: number;
  }
  export class Mask {
    static Type: { GRAPHICS_RECT: number };
    type: number;
  }

  export class ScrollView extends Component {
    static readonly EventType: Readonly<{ SCROLLING: string }>;
    content: Node;
    horizontal: boolean;
    vertical: boolean;
    inertia: boolean;
    brake: number;
    elastic: boolean;
    cancelInnerEvents: boolean;
    getScrollOffset(): Vec2;
  }

  export class TextureBase extends Asset {}

  export class SpriteFrame extends Asset {
    static createWithImage(image: ImageAsset): SpriteFrame;
    texture: TextureBase | null;
    rect: Rect;
    originalSize: Size;
    offset: Vec2;
    packable: boolean;
  }

  export class Node {
    static readonly EventType: Readonly<{
      TOUCH_START: string;
      TOUCH_END: string;
      TOUCH_CANCEL: string;
      TOUCH_MOVE: string;
    }>;

    layer: number;
    name: string;
    parent: Node | null;
    readonly isValid: boolean;

    constructor(name?: string);
    addChild(node: Node): void;
    removeAllChildren(): void;
    destroy(): boolean;
    getChildByName(name: string): Node | null;
    setPosition(position: Vec3): void;
    setPosition(x: number, y: number, z?: number): void;
    setScale(scale: Vec3): void;
    setSiblingIndex(index: number): void;
    addComponent<T>(component: new (...args: never[]) => T): T;
    getComponent<T>(component: new (...args: never[]) => T): T | null;
    on<T>(event: string, callback: (event: T) => void, target?: unknown): void;
    off<T>(event: string, callback: (event: T) => void, target?: unknown): void;
  }

  export class UITransform extends Component {
    readonly contentSize: Readonly<Size>;
    setContentSize(size: Size): void;
    setContentSize(width: number, height: number): void;
    convertToNodeSpaceAR(point: Vec3): Vec3;
  }

  export class BlockInputEvents extends Component {}

  export class Sprite extends Component {
    static readonly SizeMode: Readonly<{ CUSTOM: number }>;
    spriteFrame: SpriteFrame | null;
    sizeMode: number;
    color: Readonly<Color>;
  }

  export class Size {
    width: number;
    height: number;
    constructor(width?: number, height?: number);
  }

  export class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
  }
  export class Vec2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
  }
  export class Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
  }
  export class EventKeyboard { keyCode: number; }
  export const KeyCode: Readonly<{ KEY_W: number; KEY_A: number; KEY_S: number; KEY_D: number; KEY_E: number; SPACE: number; ARROW_UP: number; ARROW_DOWN: number; ARROW_LEFT: number; ARROW_RIGHT: number }>;
  export const Input: { EventType: { KEY_DOWN: string; KEY_UP: string } };
  export const input: { on(event: string, handler: (event: EventKeyboard) => void, target?: unknown): void; off(event: string, handler: (event: EventKeyboard) => void, target?: unknown): void };
  export const Game: { EVENT_HIDE: string };
  export const game: { on(event: string, handler: () => void, target?: unknown): void; off(event: string, handler: () => void, target?: unknown): void };

  export class Color {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r?: number, g?: number, b?: number, a?: number);
  }

  export class EventTouch {
    propagationStopped: boolean;
    getID(): number;
    getUILocation(): Vec2;
  }

  export class Graphics extends Component {
    fillColor: Color;
    strokeColor: Color;
    lineWidth: number;
    rect(x: number, y: number, width: number, height: number): void;
    roundRect(
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ): void;
    circle(cx: number, cy: number, radius: number): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
    fill(): void;
    stroke(): void;
    clear(): void;
  }

  export class Label extends Component {
    static readonly HorizontalAlign: Readonly<{
      LEFT: number;
      CENTER: number;
      RIGHT: number;
    }>;
    static readonly VerticalAlign: Readonly<{
      TOP: number;
      CENTER: number;
      BOTTOM: number;
    }>;
    static readonly Overflow: Readonly<{
      NONE: number;
      CLAMP: number;
      SHRINK: number;
      RESIZE_HEIGHT: number;
    }>;

    string: string;
    fontSize: number;
    lineHeight: number;
    color: Color;
    horizontalAlign: number;
    verticalAlign: number;
    overflow: number;
    enableWrapText: boolean;
    isItalic: boolean;
  }

  export namespace AssetManager {
    class Bundle {
      readonly name: string;
      getInfoWithPath(
        path: string,
        type?: new (...args: never[]) => Asset,
      ): Readonly<{ uuid: string; path: string }> | null;
      get<T extends Asset>(
        path: string,
        type?: new (...args: never[]) => T,
      ): T | null;
      load<T extends Asset>(
        path: string,
        type: new (...args: never[]) => T,
        callback: (error: Error | null | undefined, asset: T) => void,
      ): void;
      release(
        path: string,
        type?: new (...args: never[]) => Asset,
      ): void;
    }
  }

  export const assetManager: Readonly<{
    loadBundle(
      name: string,
      callback: (
        error: Error | null | undefined,
        bundle: AssetManager.Bundle,
      ) => void,
    ): void;
  }>;

  export const view: {
    getFrameSize(): Size;
  };
}

declare module 'cc/env' {
  export const DEBUG: boolean;
  export const HTML5: boolean;
}

// tsconfig.headless.json compiles with the ES2020 lib (no DOM); the gallery
// guards parse the browser query string via URLSearchParams.
declare const URLSearchParams: {
  new (init?: string): { get(name: string): string | null };
};
