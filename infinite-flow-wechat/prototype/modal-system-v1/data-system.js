export const systemScreens = [
  { id: 'system-loading', group: '帮助与浮层', label: '场景加载中', title: '正在进入副本', subtitle: '妖塔一层', paragraphs: ['正在准备场景素材…'], note: '加载完成后进入场景。', dismissible: false, footer: [], source: ['cocos/assets/scripts/ui/InfiniteFlowView.ts:3427'] },
  { id: 'system-load-error', group: '帮助与浮层', label: '场景加载失败', title: '场景加载失败', paragraphs: ['场景素材未能完成加载。', '游戏进度已保留，可以重新加载。'], footer: [{ label: '重新加载', action: 'toast', feedback: '已演示重新加载操作' }], dismissible: false, source: ['cocos/assets/scripts/ui/InfiniteFlowView.ts:3427'] },
  { id: 'system-initializing', group: '帮助与浮层', label: '游戏初始化', title: '正在初始化', paragraphs: ['正在恢复本地游戏状态…'], dismissible: false, footer: [], source: ['cocos/assets/scripts/ui/InfiniteFlowView.ts:3756'] },
  { id: 'system-blocked', group: '帮助与浮层', label: '运行阻断说明', title: '当前操作暂不可用', description: '请处理运行状态后继续。', sections: [{ title: '状态说明', paragraphs: ['此处显示运行时返回的 blockingMessage。'] }], note: '错误详情随实际运行状态显示。此屏只演示状态框布局。', footer: [{ label: '收起', action: 'close' }], source: ['cocos/assets/scripts/ui/InfiniteFlowView.ts:3756'] },
];
