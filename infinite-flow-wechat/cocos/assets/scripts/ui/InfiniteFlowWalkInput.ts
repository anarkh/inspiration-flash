import { EventKeyboard, EventTouch, Game, Input, KeyCode, Node, UITransform, Vec3, game, input } from 'cc';

/** Input lives only while the walking surface is visible. It never sends movement commands. */
export class InfiniteFlowWalkInput {
  private readonly keys = new Set<number>();
  private touchId: number | undefined;
  private touchAxis = { x: 0, y: 0 };
  private disposed = false;

  constructor(
    private readonly joystick: Node,
    private readonly thumb: Node,
    private readonly interact: () => void,
  ) {
    joystick.on(Node.EventType.TOUCH_START, this.touchStart, this);
    joystick.on(Node.EventType.TOUCH_MOVE, this.touchMove, this);
    joystick.on(Node.EventType.TOUCH_END, this.touchEnd, this);
    joystick.on(Node.EventType.TOUCH_CANCEL, this.touchEnd, this);
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.KEY_UP, this.keyUp, this);
    game.on(Game.EVENT_HIDE, this.reset, this);
  }

  axis(): Readonly<{ x: number; y: number }> {
    if (this.disposed) return { x: 0, y: 0 };
    if (this.touchId !== undefined) return this.touchAxis;
    return {
      x: Number(this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT))
        - Number(this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)),
      y: Number(this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN))
        - Number(this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)),
    };
  }

  private readonly keyDown = (event: EventKeyboard): void => {
    if (this.disposed) return;
    const repeated = this.keys.has(event.keyCode);
    this.keys.add(event.keyCode);
    if (!repeated && (event.keyCode === KeyCode.KEY_E || event.keyCode === KeyCode.SPACE)) this.interact();
  };

  private readonly keyUp = (event: EventKeyboard): void => { this.keys.delete(event.keyCode); };

  private readonly touchStart = (event: EventTouch): void => {
    if (this.disposed || this.touchId !== undefined) return;
    const id = event.getID();
    if (id === null) return;
    this.touchId = id;
    this.touchMove(event);
  };

  private readonly touchMove = (event: EventTouch): void => {
    if (this.disposed || event.getID() !== this.touchId) return;
    event.propagationStopped = true;
    const transform = this.joystick.getComponent(UITransform);
    if (transform === null) throw new Error('Walking joystick has no UITransform');
    const point = event.getUILocation();
    const local = transform.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
    const distance = Math.hypot(local.x, local.y);
    const scale = distance <= 12 ? 0 : Math.min(1, distance / 66) / distance;
    this.touchAxis = { x: local.x * scale, y: -local.y * scale };
    this.thumb.setPosition(new Vec3(this.touchAxis.x * 56, -this.touchAxis.y * 56, 0));
  };

  private readonly touchEnd = (event: EventTouch): void => {
    if (event.getID() !== this.touchId) return;
    event.propagationStopped = true;
    this.touchId = undefined;
    this.touchAxis = { x: 0, y: 0 };
    this.thumb.setPosition(new Vec3(0, 0, 0));
  };

  readonly reset = (): void => {
    this.keys.clear();
    this.touchId = undefined;
    this.touchAxis = { x: 0, y: 0 };
    this.thumb.setPosition(new Vec3(0, 0, 0));
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    this.joystick.off(Node.EventType.TOUCH_START, this.touchStart, this);
    this.joystick.off(Node.EventType.TOUCH_MOVE, this.touchMove, this);
    this.joystick.off(Node.EventType.TOUCH_END, this.touchEnd, this);
    this.joystick.off(Node.EventType.TOUCH_CANCEL, this.touchEnd, this);
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.KEY_UP, this.keyUp, this);
    game.off(Game.EVENT_HIDE, this.reset, this);
  }
}
