import type {
  LifecycleFlushResult,
  LifecyclePort,
  LifecycleSuspendContext,
  Unsubscribe,
} from '@infinite-flow/runtime';

export interface WxLifecycleApi {
  onHide(listener: () => void): void;
  offHide(listener: () => void): void;
  onShow(listener: () => void): void;
  offShow(listener: () => void): void;
  onMemoryWarning(listener: () => void): void;
  offMemoryWarning(listener: () => void): void;
}

export const REQUIRED_WX_LIFECYCLE_METHODS = Object.freeze([
  'onHide',
  'offHide',
  'onShow',
  'offShow',
  'onMemoryWarning',
  'offMemoryWarning',
] as const);

export type RequiredWxLifecycleMethod =
  (typeof REQUIRED_WX_LIFECYCLE_METHODS)[number];

/** Shared by the Cocos composition gate and headless contract checks. */
export function missingRequiredWxLifecycleMethods(
  candidate: Readonly<Record<string, unknown>>,
): RequiredWxLifecycleMethod[] {
  return REQUIRED_WX_LIFECYCLE_METHODS.filter(
    (method) => typeof candidate[method] !== 'function',
  );
}

export type WxLifecycleErrorCode =
  | 'invalid-config'
  | 'disposed'
  | 'registration-failed'
  | 'unregistration-failed';

export class WxLifecycleError extends Error {
  readonly code: WxLifecycleErrorCode;
  readonly causeValue: unknown;

  constructor(
    code: WxLifecycleErrorCode,
    message: string,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = 'WxLifecycleError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

/** ES2020-compatible aggregate used by the Cocos/WeChat target. */
export class WxLifecycleAggregateError extends WxLifecycleError {
  readonly errors: readonly unknown[];

  constructor(message: string, errors: readonly unknown[]) {
    const exactErrors = Object.freeze([...errors]);
    super('unregistration-failed', message, exactErrors);
    this.name = 'WxLifecycleAggregateError';
    this.errors = exactErrors;
  }
}

export type WxLifecycleAdapterOptions = Readonly<{
  hideBudgetMs?: number | (() => number | undefined);
  onSuspendResults?: (results: readonly LifecycleFlushResult[]) => void;
  onListenerError?: (
    phase: 'hide' | 'show' | 'memory-warning',
    error: unknown,
  ) => void;
}>;

function resolveBudget(
  configured: WxLifecycleAdapterOptions['hideBudgetMs'],
): number | undefined {
  const value = typeof configured === 'function' ? configured() : configured;
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) {
    throw new WxLifecycleError(
      'invalid-config',
      'hideBudgetMs must be a finite non-negative number',
    );
  }
  return value;
}

/**
 * Multiplexes wx lifecycle callbacks and unregisters the exact platform handler
 * when its last listener leaves.
 */
export class WxLifecycleAdapter implements LifecyclePort {
  private readonly suspendListeners = new Set<
    (context: LifecycleSuspendContext) => Promise<LifecycleFlushResult>
  >();
  private readonly resumeListeners = new Set<() => void>();
  private readonly memoryWarningListeners = new Set<() => void>();
  private hideRegistered = false;
  private showRegistered = false;
  private memoryWarningRegistered = false;
  private disposed = false;
  private lastSuspendWork: Promise<readonly LifecycleFlushResult[]> =
    Promise.resolve([]);

  private readonly handleHide = (): void => {
    if (this.disposed) return;
    let remainingTimeMs: number | undefined;
    try {
      remainingTimeMs = resolveBudget(this.options.hideBudgetMs);
    } catch (error) {
      this.reportListenerError('hide', error);
      // A malformed dynamic budget must not accidentally grant unlimited time.
      remainingTimeMs = 0;
    }
    const context: LifecycleSuspendContext = {
      reason: 'hide',
      ...(remainingTimeMs === undefined ? {} : { remainingTimeMs }),
    };
    const listeners = [...this.suspendListeners];
    this.lastSuspendWork = Promise.all(
      listeners.map(async (listener) => {
        try {
          return await listener(context);
        } catch (error) {
          this.reportListenerError('hide', error);
          throw error;
        }
      }),
    );
    void this.lastSuspendWork.then(
      (results) => {
        try {
          this.options.onSuspendResults?.(results);
        } catch (error) {
          this.reportListenerError('hide', error);
        }
      },
      () => {
        // Individual errors have already been surfaced through onListenerError.
      },
    );
  };

  private readonly handleShow = (): void => {
    if (this.disposed) return;
    for (const listener of [...this.resumeListeners]) {
      try {
        listener();
      } catch (error) {
        this.reportListenerError('show', error);
      }
    }
  };

  private readonly handleMemoryWarning = (): void => {
    if (this.disposed) return;
    for (const listener of [...this.memoryWarningListeners]) {
      try {
        listener();
      } catch (error) {
        this.reportListenerError('memory-warning', error);
      }
    }
  };

  constructor(
    private readonly wxLifecycle: WxLifecycleApi,
    private readonly options: WxLifecycleAdapterOptions = {},
  ) {
    const missingMethods = missingRequiredWxLifecycleMethods(
      wxLifecycle as unknown as Readonly<Record<string, unknown>>,
    );
    if (missingMethods.length > 0) {
      throw new WxLifecycleError(
        'invalid-config',
        `Wx lifecycle API is missing required methods: ${missingMethods.join(', ')}`,
      );
    }
    const configuredBudget =
      typeof options.hideBudgetMs === 'function'
        ? undefined
        : options.hideBudgetMs;
    if (
      configuredBudget !== undefined &&
      (!Number.isFinite(configuredBudget) || configuredBudget < 0)
    ) {
      throw new WxLifecycleError(
        'invalid-config',
        'hideBudgetMs must be a finite non-negative number',
      );
    }
  }

  onSuspend(
    listener: (
      context: LifecycleSuspendContext,
    ) => Promise<LifecycleFlushResult>,
  ): Unsubscribe {
    this.assertActive();
    this.suspendListeners.add(listener);
    if (!this.hideRegistered) {
      try {
        this.wxLifecycle.onHide(this.handleHide);
        this.hideRegistered = true;
      } catch (cause) {
        this.suspendListeners.delete(listener);
        throw new WxLifecycleError(
          'registration-failed',
          'wx.onHide registration failed',
          cause,
        );
      }
    }
    return this.makeUnsubscribe(() => {
      this.suspendListeners.delete(listener);
      if (this.suspendListeners.size === 0) this.unregisterHide();
    });
  }

  onResume(listener: () => void): Unsubscribe {
    this.assertActive();
    this.resumeListeners.add(listener);
    if (!this.showRegistered) {
      try {
        this.wxLifecycle.onShow(this.handleShow);
        this.showRegistered = true;
      } catch (cause) {
        this.resumeListeners.delete(listener);
        throw new WxLifecycleError(
          'registration-failed',
          'wx.onShow registration failed',
          cause,
        );
      }
    }
    return this.makeUnsubscribe(() => {
      this.resumeListeners.delete(listener);
      if (this.resumeListeners.size === 0) this.unregisterShow();
    });
  }

  onMemoryWarning(listener: () => void): Unsubscribe {
    this.assertActive();
    this.memoryWarningListeners.add(listener);
    if (!this.memoryWarningRegistered) {
      try {
        this.wxLifecycle.onMemoryWarning(this.handleMemoryWarning);
        this.memoryWarningRegistered = true;
      } catch (cause) {
        this.memoryWarningListeners.delete(listener);
        throw new WxLifecycleError(
          'registration-failed',
          'wx.onMemoryWarning registration failed',
          cause,
        );
      }
    }
    return this.makeUnsubscribe(() => {
      this.memoryWarningListeners.delete(listener);
      if (this.memoryWarningListeners.size === 0) {
        this.unregisterMemoryWarning();
      }
    });
  }

  waitForLastSuspend(): Promise<readonly LifecycleFlushResult[]> {
    return this.lastSuspendWork;
  }

  dispose(): void {
    if (
      this.disposed
      && !this.hideRegistered
      && !this.showRegistered
      && !this.memoryWarningRegistered
    ) return;
    this.disposed = true;
    this.suspendListeners.clear();
    this.resumeListeners.clear();
    this.memoryWarningListeners.clear();
    const errors: unknown[] = [];
    // Mirror registration order in reverse and never let one faulty off* keep
    // the remaining exact handlers from being detached.
    for (const unregister of [
      () => this.unregisterMemoryWarning(),
      () => this.unregisterShow(),
      () => this.unregisterHide(),
    ]) {
      try {
        unregister();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new WxLifecycleAggregateError(
        'Wx lifecycle disposal encountered unregistration errors',
        errors,
      );
    }
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new WxLifecycleError(
        'disposed',
        'WxLifecycleAdapter is disposed',
      );
    }
  }

  private makeUnsubscribe(remove: () => void): Unsubscribe {
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      remove();
    };
  }

  private unregisterHide(): void {
    if (!this.hideRegistered) return;
    try {
      this.wxLifecycle.offHide(this.handleHide);
      this.hideRegistered = false;
    } catch (cause) {
      const error = new WxLifecycleError(
        'unregistration-failed',
        'wx.offHide unregistration failed',
        cause,
      );
      this.reportListenerError('hide', error);
      throw error;
    }
  }

  private unregisterShow(): void {
    if (!this.showRegistered) return;
    try {
      this.wxLifecycle.offShow(this.handleShow);
      this.showRegistered = false;
    } catch (cause) {
      const error = new WxLifecycleError(
        'unregistration-failed',
        'wx.offShow unregistration failed',
        cause,
      );
      this.reportListenerError('show', error);
      throw error;
    }
  }

  private unregisterMemoryWarning(): void {
    if (!this.memoryWarningRegistered) return;
    try {
      this.wxLifecycle.offMemoryWarning(this.handleMemoryWarning);
      this.memoryWarningRegistered = false;
    } catch (cause) {
      const error = new WxLifecycleError(
        'unregistration-failed',
        'wx.offMemoryWarning unregistration failed',
        cause,
      );
      this.reportListenerError('memory-warning', error);
      throw error;
    }
  }

  private reportListenerError(
    phase: 'hide' | 'show' | 'memory-warning',
    error: unknown,
  ): void {
    try {
      this.options.onListenerError?.(phase, error);
    } catch {
      // Error reporting must never escape a wx lifecycle callback.
    }
  }
}
