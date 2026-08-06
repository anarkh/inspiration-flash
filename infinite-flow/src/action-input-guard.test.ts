import { describe, expect, it } from 'vitest';

import {
  hasPointerMovedBeyondRepeatRadius,
  isRepeatedPointerPress,
  shouldAllowActionActivation,
  shouldSuppressRepeatedPointerPress,
  type PointerPress
} from './action-input-guard';

describe('action input guard', () => {
  it.each([0, 1])('allows activation for click detail %s', (clickDetail) => {
    expect(shouldAllowActionActivation(clickDetail)).toBe(true);
  });

  it.each([2, 3])('rejects repeated activation for click detail %s', (clickDetail) => {
    expect(shouldAllowActionActivation(clickDetail)).toBe(false);
  });

  it.each([
    Number.NaN,
    Infinity,
    -Infinity,
    -1,
    -0.5,
    0.5,
    1.5,
    undefined,
    null,
    '1'
  ])('fails closed for malformed click detail %s', (clickDetail) => {
    expect(shouldAllowActionActivation(clickDetail)).toBe(false);
  });

  const firstPress: PointerPress = {
    actionId: 'buy-healing-pill',
    button: 0,
    clientX: 320,
    clientY: 240,
    timeStamp: 1000
  };

  it('recognizes a rapid second press after the original DOM target was replaced', () => {
    expect(
      isRepeatedPointerPress(
        { ...firstPress, clientX: 324, clientY: 243, timeStamp: 1120 },
        firstPress
      )
    ).toBe(true);
  });

  it('does not suppress a later press at the same location', () => {
    expect(
      isRepeatedPointerPress({ ...firstPress, timeStamp: 1501 }, firstPress)
    ).toBe(false);
  });

  it('does not suppress a rapid press on a different command', () => {
    expect(
      isRepeatedPointerPress({ ...firstPress, clientX: 327, timeStamp: 1120 }, firstPress)
    ).toBe(false);
  });

  it('does not merge different mouse buttons or out-of-order events', () => {
    expect(
      isRepeatedPointerPress({ ...firstPress, button: 1, timeStamp: 1120 }, firstPress)
    ).toBe(false);
    expect(
      isRepeatedPointerPress({ ...firstPress, timeStamp: 999 }, firstPress)
    ).toBe(false);
  });

  it('rejects incomplete pointer history without treating it as a repeat', () => {
    expect(isRepeatedPointerPress(firstPress, undefined)).toBe(false);
    expect(
      isRepeatedPointerPress(
        { ...firstPress, clientX: Number.NaN, timeStamp: 1120 },
        firstPress
      )
    ).toBe(false);
  });

  it('clears repeat history after meaningful pointer travel', () => {
    expect(hasPointerMovedBeyondRepeatRadius(327, 240, firstPress)).toBe(true);
    expect(hasPointerMovedBeyondRepeatRadius(324, 243, firstPress)).toBe(false);
  });

  it('does not invent pointer travel from malformed coordinates or missing history', () => {
    expect(hasPointerMovedBeyondRepeatRadius(327, 240, undefined)).toBe(false);
    expect(hasPointerMovedBeyondRepeatRadius(Number.NaN, 240, firstPress)).toBe(false);
  });

  it('suppresses the same command when a real double-click continues without moving', () => {
    expect(
      shouldSuppressRepeatedPointerPress(
        { ...firstPress, timeStamp: 1100 },
        firstPress,
        false,
        2
      )
    ).toBe(true);
  });

  it('suppresses the second press when rerendering replaced the command with a surface', () => {
    expect(
      shouldSuppressRepeatedPointerPress(
        { ...firstPress, actionId: undefined, timeStamp: 1100 },
        firstPress,
        false,
        1
      )
    ).toBe(true);
  });

  it('allows a different command immediately even when the browser retains detail 2', () => {
    expect(
      shouldSuppressRepeatedPointerPress(
        { ...firstPress, actionId: 'use-restoration-method', timeStamp: 1100 },
        firstPress,
        false,
        2
      )
    ).toBe(false);
  });

  it('allows an intentional new press after meaningful pointer travel', () => {
    expect(
      shouldSuppressRepeatedPointerPress(
        { ...firstPress, timeStamp: 1100 },
        firstPress,
        true,
        2
      )
    ).toBe(false);
  });

  it('does not suppress pointer activity without a previous game command', () => {
    const surfacePress = { ...firstPress, actionId: undefined };
    expect(
      shouldSuppressRepeatedPointerPress(
        { ...surfacePress, timeStamp: 1100 },
        surfacePress,
        false,
        2
      )
    ).toBe(false);
  });
});
