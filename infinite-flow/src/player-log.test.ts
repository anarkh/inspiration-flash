import { describe, expect, it } from 'vitest';
import { formatPlayerLogLine } from './player-log';

describe('player log compatibility formatting', () => {
  it('maps legacy economy enums without rewriting already-localized copy', () => {
    expect(formatPlayerLogLine('白光裂口亮起，首次通关结算：normal_clear，倍率 1.2x。'))
      .toBe('白光裂口亮起，首次通关结算：稳定通关，倍率 1.2x。');
    expect(formatPlayerLogLine('白光裂口亮起，首次通关结算：稳定通关，倍率 1.2x。'))
      .toBe('白光裂口亮起，首次通关结算：稳定通关，倍率 1.2x。');
  });

  it('maps every persisted route settlement reason used by old saves', () => {
    expect(formatPlayerLogLine('隐藏任务以 failed/incomplete_exit 结算，奖励为 0。'))
      .toBe('隐藏任务以 失败（离场时目标未完成）结算，奖励为 0。');
    expect(formatPlayerLogLine('路线契约以 lost/retreat 独立结算，奖励为 0。'))
      .toBe('路线契约以 已失效（主动撤退）独立结算，奖励为 0。');
    expect(formatPlayerLogLine('路线契约以 lost/cross_dungeon 独立结算，奖励为 0。'))
      .toBe('路线契约以 已失效（跨副本转移）独立结算，奖励为 0。');
  });

  it('keeps unrelated player copy unchanged', () => {
    const line = '雾爪幼兽倒下，战利品进入本局袋。';
    expect(formatPlayerLogLine(line)).toBe(line);
  });
});
