const LEGACY_SETTLEMENT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'failed/incomplete_exit': '失败（离场时目标未完成）',
  'failed/out_of_order': '失败（目标顺序错误）',
  'lost/retreat': '已失效（主动撤退）',
  'lost/failure': '已失效（濒死回收）',
  'lost/cross_dungeon': '已失效（跨副本转移）',
  'active/none': '进行中',
  'secured/none': '目标已完成',
  'failed/none': '失败',
  'lost/none': '已失效',
  'banked/none': '已入账',
  'disabled/retreat': '未启用（主动撤退）',
  'disabled/failure': '未启用（濒死回收）',
  'disabled/successful_exit': '未启用（成功撤离）'
});

const LEGACY_ECONOMY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  clean_clear: '完美撤离',
  normal_clear: '稳定通关',
  retreat: '主动撤退',
  failed_recovered: '濒死回收'
});

export function formatPlayerLogLine(line: string): string {
  let formatted = line;
  for (const [legacyValue, label] of Object.entries(LEGACY_SETTLEMENT_LABELS)) {
    formatted = formatted
      .split(`${legacyValue} `).join(label)
      .split(legacyValue).join(label);
  }
  return formatted.replace(
    /\b(clean_clear|normal_clear|retreat|failed_recovered)\b/g,
    (value) => LEGACY_ECONOMY_LABELS[value] ?? value
  );
}
