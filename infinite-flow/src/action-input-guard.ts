/**
 * Browsers normally increment `MouseEvent.detail` for each click in one
 * multi-click gesture. A synchronous render can replace the original target
 * between presses, however, which resets the second event's detail to one.
 *
 * A detail of zero is valid for keyboard or programmatic activation; malformed
 * counts fail closed.
 */
export function shouldAllowActionActivation(clickDetail: unknown): boolean {
  return (
    typeof clickDetail === 'number' &&
    Number.isInteger(clickDetail) &&
    clickDetail >= 0 &&
    clickDetail < 2
  );
}

export interface PointerPress {
  actionId?: string;
  button: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

const REPEATED_POINTER_WINDOW_MS = 500;
const REPEATED_POINTER_RADIUS_PX = 6;

function isFinitePointerPress(press: PointerPress | undefined): press is PointerPress {
  return Boolean(
    press &&
      Number.isInteger(press.button) &&
      press.button >= 0 &&
      Number.isFinite(press.clientX) &&
      Number.isFinite(press.clientY) &&
      Number.isFinite(press.timeStamp) &&
      press.timeStamp >= 0
  );
}

/**
 * Detects the continuation of one physical multi-click gesture even when a
 * render replaced the first event target. The small spatial and temporal
 * bounds keep a click on a different command from being suppressed.
 */
export function isRepeatedPointerPress(
  current: PointerPress,
  previous: PointerPress | undefined
): boolean {
  if (!isFinitePointerPress(current) || !isFinitePointerPress(previous)) return false;
  const elapsed = current.timeStamp - previous.timeStamp;
  if (
    current.button !== previous.button ||
    elapsed < 0 ||
    elapsed > REPEATED_POINTER_WINDOW_MS
  ) {
    return false;
  }
  const deltaX = current.clientX - previous.clientX;
  const deltaY = current.clientY - previous.clientY;
  return deltaX * deltaX + deltaY * deltaY <= REPEATED_POINTER_RADIUS_PX ** 2;
}

export function hasPointerMovedBeyondRepeatRadius(
  clientX: number,
  clientY: number,
  previous: PointerPress | undefined
): boolean {
  if (
    !isFinitePointerPress(previous) ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  ) {
    return false;
  }
  const deltaX = clientX - previous.clientX;
  const deltaY = clientY - previous.clientY;
  return deltaX * deltaX + deltaY * deltaY > REPEATED_POINTER_RADIUS_PX ** 2;
}

/**
 * Suppresses only a continued press on the same rendered command. When the
 * first command rerenders away, a second press on the now non-action surface
 * is still part of that gesture. A different action id is always an explicit
 * new command, even if the browser keeps a multi-click count.
 */
export function shouldSuppressRepeatedPointerPress(
  current: PointerPress,
  previous: PointerPress | undefined,
  pointerMovedSincePreviousPress: boolean,
  pressDetail: unknown
): boolean {
  if (
    pointerMovedSincePreviousPress ||
    !isFinitePointerPress(current) ||
    !isFinitePointerPress(previous) ||
    !previous.actionId
  ) {
    return false;
  }
  const continuesPreviousAction =
    current.actionId === previous.actionId || current.actionId === undefined;
  if (!continuesPreviousAction) return false;
  return (
    !shouldAllowActionActivation(pressDetail) ||
    isRepeatedPointerPress(current, previous)
  );
}
