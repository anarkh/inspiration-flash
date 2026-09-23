export const COCOS_DESIGN_TOKENS = Object.freeze({
  coordinateSpace: Object.freeze({ width: 750, height: 1334, unit: 'design-px' }),
  units: Object.freeze({
    design: 'design-px',
    viewport: 'viewport-px',
    conversion: 'design-px = viewport-px * 750 / viewport-width'
  }),
  safeAreaProfiles: Object.freeze({
    compact: Object.freeze({
      viewport: Object.freeze({ width: 320, height: 568, unit: 'viewport-px' }),
      fallbackInsets: Object.freeze({ top: 20, right: 0, bottom: 16, left: 0, unit: 'viewport-px' }),
      viewportPxToDesignPx: 2.34375
    }),
    tall: Object.freeze({
      viewport: Object.freeze({ width: 390, height: 844, unit: 'viewport-px' }),
      fallbackInsets: Object.freeze({ top: 47, right: 0, bottom: 34, left: 0, unit: 'viewport-px' }),
      viewportPxToDesignPx: 750 / 390
    })
  }),
  safeAreaPolicy: Object.freeze({ source: 'host-insets', fallback: 'profile' }),
  spacing: Object.freeze({ x1: 4, x2: 8, x3: 12, x4: 16, x6: 24, x8: 32 }),
  touch: Object.freeze({
    minimumViewportPx: 44,
    minimumDesignPxAt390: 85,
    minimumDesignPxAt320: 104,
    compactDesignGate: 104,
    primaryDesignPx: 112,
    mapNodeDesignPx: 104
  }),
  colors: Object.freeze({
    deepCharcoal: '#141817',
    charcoalRaised: '#202725',
    oxidizedTeal: '#2F716B',
    oldGold: '#B9964A',
    warningRed: '#B84C45',
    boneText: '#E8E0CF',
    mutedText: '#A9A596'
  }),
  contrast: Object.freeze({
    regularTextMinimum: 4.5,
    largeTextMinimum: 3,
    nonTextUiMinimum: 3,
    auditUnit: 'WCAG-contrast-ratio'
  }),
  mapStates: Object.freeze({
    current: Object.freeze({ color: 'oldGold', label: '当前位置', symbol: '◎', pattern: 'double-ring' }),
    adjacent: Object.freeze({ color: 'oxidizedTeal', label: '相邻可达', symbol: '→', pattern: 'direction-notch' }),
    scouted: Object.freeze({ color: 'mutedText', label: '已侦察', symbol: '◇', pattern: 'open-diamond' }),
    cleared: Object.freeze({ color: 'oxidizedTeal', label: '已清理', symbol: '✓', pattern: 'check-hatch' }),
    fogged: Object.freeze({ color: 'charcoalRaised', label: '迷雾未知', symbol: '?', pattern: 'question-dots' })
  }),
  actionStates: Object.freeze({
    recommended: Object.freeze({ label: '推荐', symbol: '★', border: 'solid' }),
    highRisk: Object.freeze({ label: '高风险', symbol: '!', border: 'double' }),
    disabled: Object.freeze({ label: '不可用', symbol: '×', border: 'dashed' })
  })
} as const);
