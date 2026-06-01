declare module 'cc' {
  export const _decorator: {
    ccclass: (name: string) => ClassDecorator;
  };

  export class Component {
    node: Node;
    start?(): void;
  }

  export class Node {
    static EventType: Record<string, string>;
    constructor(name?: string);
    addChild(node: Node): void;
    removeAllChildren(): void;
    destroy(): void;
    getChildByName(name: string): Node | null;
    setPosition(position: Vec3): void;
    addComponent<T>(component: new (...args: never[]) => T): T;
    getComponent<T>(component: new (...args: never[]) => T): T | null;
    on(event: string, callback: () => void): void;
  }

  export class UITransform {
    setContentSize(size: Size): void;
  }

  export class Size {
    constructor(width: number, height: number);
  }

  export class Vec3 {
    constructor(x: number, y: number, z?: number);
  }

  export class Color {
    constructor(r: number, g: number, b: number, a?: number);
  }

  export class Graphics {
    fillColor: Color;
    strokeColor: Color;
    lineWidth: number;
    rect(x: number, y: number, w: number, h: number): void;
    fill(): void;
    stroke(): void;
  }

  export class Label {
    static HorizontalAlign: {
      CENTER: number;
    };
    static VerticalAlign: {
      CENTER: number;
    };
    static Overflow: {
      SHRINK: number;
    };
    string: string;
    fontSize: number;
    lineHeight: number;
    color: Color;
    horizontalAlign: number;
    verticalAlign: number;
    overflow: number;
    enableWrapText: boolean;
  }

  export class Button {
    static EventType: {
      CLICK: string;
    };
    interactable: boolean;
  }

  export function log(...args: unknown[]): void;
}
