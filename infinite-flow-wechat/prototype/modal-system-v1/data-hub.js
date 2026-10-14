// Display-only fixtures. Costs and descriptions follow the current source;
// ownership, completed chapters and active choices are explicitly sample states.
export const hubScreens = [
  {
    id: 'npc-merchant', group: '主神空间', label: '军需官 · 商品目录', title: '装备与强化', subtitle: '军需官', image: 'npc/equipment-quartermaster-v1.png',
    description: '先挑合适的装备，再决定如何强化。点装备查看详情。', layout: 'grid',
    tabs: [{ label: '装备', target: 'npc-merchant' }, { label: '已拥有', target: 'hub-equipment' }],
    grid: [
      { title: '破甲剑', image: 'equipment/armor-piercing-sword-v1.png', badge: '普通', target: 'hub-detail-equipment' },
      { title: '白骨长矛', image: 'equipment/bone-spear-v1.png', badge: '普通' },
      { title: '灰烬短杖', image: 'equipment/ember-staff-v1.png', badge: '普通' },
      { title: '雾行兜帽', image: 'equipment/mist-hood-v1.png', badge: '普通' },
      { title: '拼缝护衣', image: 'equipment/patched-coat-v1.png', badge: '劣质' },
      { title: '空白护符', image: 'equipment/plain-charm-v1.png', badge: '普通' }
    ],
    footer: [{ label: '封存委托', target: 'hub-services' }],
    hint: '点破甲剑查看详情；兑换后需手动穿戴。',
    note: '图标目录示例；购入不会自动穿戴。只有破甲剑展示完整详情链路，其余同类图标用于目录排布。',
    source: ['packages/presentation/src/hub-shop.ts:48', 'packages/presentation/src/hub-shop.ts:202-237', 'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2774-2870'],
    related: ['hub-detail-equipment', 'hub-more-actions', 'hub-services', 'hub-equipment']
  },
  {
    id: 'npc-supplies', group: '主神空间', label: '补给商 · 物资兑换', title: '物资兑换', subtitle: '补给商', image: 'npc/supply-trader-v1.png',
    description: '挑选下次冒险需要的补给与道具，兑换后会放入背包。', layout: 'grid',
    grid: [
      { title: '止血丹', image: 'item/healing-pill-v1.png', badge: '补给', target: 'hub-detail-supply' },
      { title: '雷火符', image: 'item/thunder-talisman-v1.png', badge: '战斗' },
      { title: '破禁符', image: 'item/dispel-talisman-v1.png', badge: '防护' },
      { title: '小界门符', image: 'item/gate-sigil-v1.png', badge: '传送' },
      { title: '缚灵网', image: 'item/capture-net-v1.png', badge: '捕获' },
      { title: '灵饵', image: 'item/spirit-bait-v1.png', badge: '捕获' }
    ],
    footer: [{ label: '休整服务', target: 'hub-recover' }, { label: '配置携行', target: 'player-carry' }],
    hint: '补给不占槽；特殊道具需配置携行。',
    note: '兑换与携行分开；补给品不占携行槽。止血丹提供详情示例，其他图标为同类排布。',
    source: ['packages/presentation/src/hub-shop.ts:49', 'packages/presentation/src/hub-shop.ts:239-259', 'packages/core/src/game.ts:1350-1406'],
    related: ['hub-detail-supply', 'hub-recover', 'player-carry']
  },
  {
    id: 'npc-pets', group: '主神空间', label: '灵宠师 · 灵宠培养', title: '灵宠与培养', subtitle: '灵宠师', image: 'npc/pet-keeper-v1.png',
    description: '在这里结识新的灵宠，也可以培养已有的伙伴，提升它们的能力。', layout: 'grid',
    grid: [
      { title: '契约小灵', image: 'pet/contract-sprite-v1.png', badge: '签约', target: 'hub-detail-pet' },
      { title: '雾爪幼兽', image: 'pet/mist-kitten-v1.png', badge: '捕获' },
      { title: '烬火犬', image: 'pet/ash-hound-v1.png', badge: '捕获' },
      { title: '镜翼蛾', image: 'pet/mirror-moth-v1.png', badge: '捕获' },
      { title: '星铁浮蜂', image: 'pet/starling-drone-v1.png', badge: '签约' },
      { title: '虚空幼蜥', image: 'pet/void-whelp-v1.png', badge: '捕获' }
    ],
    footer: [{ label: '配置出战', target: 'hub-growth' }],
    hint: '仅出战灵宠生效；捕获灵宠来自副本。',
    note: '签约和培养属于 NPC 服务；设置出战保留在角色养成目录。只有出战的一只灵宠提供属性。',
    source: ['packages/presentation/src/hub-shop.ts:50', 'packages/presentation/src/hub-shop.ts:260-280', 'packages/core/src/pet-system.ts:16-91'],
    related: ['hub-detail-pet', 'hub-growth']
  },
  {
    id: 'npc-methods', group: '主神空间', label: '修行导师 · 功法战技', title: '功法与战技', subtitle: '修行导师', image: 'npc/method-master-v1.png',
    description: '学习功法获得被动收益，继续精研则能强化战技。', layout: 'grid',
    grid: [
      { title: '吐纳诀', image: 'item/mist-breathing-v2.png', badge: '普通', target: 'hub-detail-method' },
      { title: '铁衣诀', image: 'item/iron-body-v2.png', badge: '优秀' },
      { title: '云隙步', image: 'item/cloud-step-v2.png', badge: '优秀' },
      { title: '观门法', image: 'item/gate-sense-v2.png', badge: '稀有' },
      { title: '御灵印', image: 'item/beast-taming-v2.png', badge: '稀有' },
      { title: '星核炼息', image: 'item/star-core-method-v2.png', badge: '史诗' },
      { title: '虚心诀', image: 'item/void-heart-v2.png', badge: '传说' }
    ],
    footer: [{ label: '常用功法', target: 'hub-growth' }],
    hint: '已学被动全部生效；常用只改变列表顺序。',
    note: '学习与精研在这里进行；已学功法的被动全部生效，常用只改变列表顺序。',
    source: ['packages/presentation/src/hub-shop.ts:51', 'packages/presentation/src/hub-shop.ts:282-301', 'packages/core/src/game.ts:1544-1600'],
    related: ['hub-detail-method', 'hub-growth']
  },
  {
    id: 'npc-bloodlines', group: '主神空间', label: '血脉祭司 · 血统觉醒', title: '血统与觉醒', subtitle: '血脉祭司', image: 'npc/bloodline-priest-v1.png',
    description: '觉醒开启新的血统，晋升增强血统的属性与爆发能力。', layout: 'grid',
    grid: [
      { title: '巨灵骨髓', image: 'item/titan-marrow-v2.png', badge: '史诗', target: 'hub-detail-bloodline' },
      { title: '虚界共生体', image: 'item/void-symbiote-v2.png', badge: '传说' },
      { title: '界壁甲质', image: 'item/bastion-chitin-v2.png', badge: '史诗' },
      { title: '涅槃余烬', image: 'item/phoenix-ember-v2.png', badge: '传说' }
    ],
    footer: [{ label: '配置血统', target: 'hub-growth' }],
    hint: '觉醒后手动激活；每次仅一种血统生效。',
    note: '觉醒、晋升与激活分开；每次只激活一种血统，下次入场带入当前阶位。',
    source: ['packages/presentation/src/hub-shop.ts:52', 'packages/presentation/src/hub-shop.ts:283-302', 'packages/core/src/bloodline-system.ts:94-162'],
    related: ['hub-detail-bloodline', 'hub-growth']
  },
  {
    id: 'npc-companions', group: '主神空间', label: '同行引路人 · 同伴训练', title: '同伴与训练', subtitle: '同行引路人', image: 'npc/companion-guide-v2.png',
    description: '招募旅途中结识的伙伴，或通过训练增强他们的战斗援助。', layout: 'grid',
    grid: [
      { title: '秦彻', image: 'character/qin-che-v1.png', badge: '稀有', target: 'hub-detail-companion' },
      { title: '周映雪', image: 'character/zhou-yingxue-v1.png', badge: '史诗' },
      { title: '陆观澜', image: 'character/lu-guanlan-v1.png', badge: '传说' }
    ],
    footer: [{ label: '配置同伴', target: 'hub-growth' }],
    hint: '首次通关后可招募；每次只出战一位同伴。',
    note: '秦彻为壁垒先锋，周映雪为精神分析师，陆观澜为战地医师。保留首次通关的招募条件；招募后手动设为出战，每次只能带一位同伴。',
    source: ['packages/presentation/src/hub-shop.ts:53', 'packages/presentation/src/hub-shop.ts:303-326', 'packages/core/src/companion-system.ts:84-123'],
    related: ['hub-detail-companion', 'hub-growth']
  },
  {
    id: 'npc-tasks', group: '主神空间', label: '任务使者 · 任务奖励', title: '任务与奖励', subtitle: '任务使者', image: 'npc/main-god-projection-v1.png',
    description: '所有目标都列在这里。完成后手动领取，主线奖励还会开启下一章。',
    rows: [
      { title: '妖塔一层主线', text: '完成妖塔一层首通，并确认章节推进。', meta: '80 奖励点 · 领取后开启下一章', badge: '可领取示例', target: 'hub-detail-task' },
      { title: '镜潮地铁主线', text: '首通镜潮地铁后领取主线奖励。', meta: '90 奖励点', badge: '未解锁示例', target: 'entry-locked' },
      { title: '星坠矿井主线', text: '首通星坠矿井后领取主线奖励。', meta: '100 奖励点 · 1 灵蕴', badge: '未解锁示例' }
    ],
    footer: [{ label: '章节列表', target: 'entry-root' }],
    hint: '完成后手动领取；领取主线奖励推进章节。',
    note: '展示任务可领取与未解锁两种状态；完成首通不等于已领取主线奖励。示例不读取或修改玩家进度。',
    source: ['packages/presentation/src/hub-shop.ts:54', 'packages/presentation/src/hub-shop.ts:329-363', 'packages/core/src/task-system.ts:195-216'],
    related: ['hub-detail-task', 'entry-root', 'entry-locked']
  },
  {
    id: 'npc-empty', group: '主神空间', label: '交谈 · 无 NPC', title: '交谈',
    paragraphs: ['请在主神空间走近 NPC 后交谈。'],
    footer: [{ label: '关闭', action: 'close' }],
    note: '保留未靠近 NPC 时的空状态，不将其改成远程商店入口。',
    source: ['cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2990-2993'], related: ['npc-merchant']
  },
  {
    id: 'hub-detail-equipment', group: '主神空间', label: '装备 · 商品详情', title: '破甲剑', subtitle: '武器 · 普通',
    rows: [{ title: '破甲剑', text: '对厚甲怪和矿壳守卫有额外威慑。', image: 'equipment/armor-piercing-sword-v1.png', meta: '兑换价 260 奖励点' }],
    metrics: [{ label: '攻击', value: '+9' }, { label: '速度', value: '+1' }, { label: '等级上限', value: '3' }],
    sections: [
      { title: '成长', paragraphs: ['每级攻击 +4。升级永久提高这件装备的等级与属性。'] },
      { title: '固定词缀 · 破甲锋线', paragraphs: ['攻击 +2。'] },
      { title: '生效方式', paragraphs: ['兑换后放入装备架，手动穿戴后属性生效；同部位只能穿戴一件。'] }
    ],
    footer: [{ label: '更多操作', target: 'hub-more-actions' }, { label: '兑换', action: 'toast' }],
    note: '数值来自装备目录。兑换按钮仅展示原型反馈，不自动穿戴。',
    source: ['packages/core/src/equipment-catalog.ts:82-91', 'packages/core/src/equipment-system.ts:138-141', 'packages/presentation/src/hub-shop.ts:90-117', 'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2630-2771'],
    related: ['hub-more-actions', 'hub-confirm', 'npc-merchant', 'hub-owned-equipment-detail']
  },
  {
    id: 'hub-detail-supply', group: '主神空间', label: '物资 · 兑换详情', title: '止血丹', subtitle: '补给品 · 普通',
    rows: [{ title: '止血丹', text: '战斗中回复 36 点生命。', image: 'item/healing-pill-v1.png', meta: '兑换价 120 奖励点' }],
    paragraphs: ['不占携行槽；副本中有库存即可使用。', '兑换后存入永久背包，使用时仍会消耗库存。'],
    footer: [{ label: '返回', target: 'npc-supplies' }, { label: '兑换', action: 'toast' }],
    note: '此处是兑换入口；实际战斗使用与携行配置沿用现有规则。',
    source: ['packages/core/src/game.ts:1350-1356', 'packages/presentation/src/hub-shop.ts:239-259'],
    related: ['npc-supplies', 'player-carry']
  },
  {
    id: 'hub-detail-pet', group: '主神空间', label: '灵宠 · 签约培养详情', title: '契约小灵', subtitle: '可签约 · 普通',
    rows: [{ title: '契约小灵', image: 'pet/contract-sprite-v1.png', text: '稳定提升灵力的基础灵宠。', meta: '签约价 280 奖励点' }],
    metrics: [{ label: '心神', value: '+1' }, { label: '术法', value: '+3' }, { label: '等级上限', value: '3' }],
    sections: [
      { title: '培养', paragraphs: ['每级术法 +2；培养材料为定神香。'] },
      { title: '生效方式', paragraphs: ['只有出战中的一只灵宠提供属性与特性，培养永久提高等级。签约后可在角色养成目录配置出战。'] }
    ],
    footer: [{ label: '培养', action: 'toast' }, { label: '签约', action: 'toast' }],
    note: '分别展示签约与已拥有后的培养操作样式；实际可用性由玩家拥有状态和资源决定。',
    source: ['packages/core/src/pet-system.ts:17-28', 'packages/presentation/src/hub-shop.ts:260-280'],
    related: ['npc-pets', 'hub-growth']
  },
  {
    id: 'hub-detail-method', group: '主神空间', label: '功法 · 学习精研详情', title: '吐纳诀', subtitle: '功法 · 普通',
    rows: [{ title: '吐纳诀', image: 'item/mist-breathing-v2.png', text: '在雾、潮声和幻觉里稳住心神，能发现隐藏奖励。', meta: '学习价 280 奖励点' }],
    sections: [
      { title: '学习属性', paragraphs: ['心神 +1。'] },
      { title: '功法被动', paragraphs: ['奖励节点出现隐藏路线，陷阱检定更容易通过。'] },
      { title: '生效方式', paragraphs: ['已学功法的被动都生效；精研后下次入场使用新阶位战技。常用只调整列表顺序。'] }
    ],
    footer: [{ label: '精研', action: 'toast' }, { label: '学习', action: 'toast' }],
    note: '学习、精研和常用排序保留各自语义；可用性由当前学习状态与资源决定。',
    source: ['packages/core/src/game.ts:1545-1552', 'packages/presentation/src/hub-shop.ts:282-301'],
    related: ['npc-methods', 'hub-growth']
  },
  {
    id: 'hub-detail-bloodline', group: '主神空间', label: '血统 · 觉醒晋升详情', title: '巨灵骨髓', subtitle: '力之始祖 · 史诗',
    rows: [{ title: '巨灵骨髓', image: 'item/titan-marrow-v2.png', text: '激活后获得属性与血统爆发。' }],
    metrics: [{ label: '一阶攻击', value: '+6' }, { label: '一阶生命', value: '+12' }, { label: '一阶爆发', value: '物理伤害 18' }],
    sections: [
      { title: '三阶属性', paragraphs: ['攻击 +20，生命上限 +40。'] },
      { title: '生效方式', paragraphs: ['每次只激活一种血统；下次入场带入当前激活的血统与阶位。'] }
    ],
    footer: [{ label: '晋升', action: 'toast' }, { label: '觉醒', action: 'toast' }],
    note: '只展示已定义的属性；觉醒与晋升成本由当前阶位计算，不在原型中编造余额。',
    source: ['packages/core/src/bloodline-system.ts:94-110', 'packages/presentation/src/hub-shop.ts:283-302'],
    related: ['npc-bloodlines', 'hub-growth']
  },
  {
    id: 'hub-detail-companion', group: '主神空间', label: '同伴 · 招募训练详情', title: '秦彻', subtitle: '壁垒先锋 · 稀有',
    rows: [{ title: '秦彻', image: 'character/qin-che-v1.png', text: '提供「抢位援护」战斗援助。', meta: '首次通关妖塔一层后可招募' }],
    sections: [
      { title: '招募消耗', paragraphs: ['480 奖励点、1 灵蕴、妖骨 ×2。'] },
      { title: '援助技能', paragraphs: ['一阶抢位援护使角色获得防御；训练材料为妖骨。'] },
      { title: '生效方式', paragraphs: ['每次只能带一位同伴；下次入场按当前出战人选和阶位提供援助。'] }
    ],
    footer: [{ label: '训练', action: 'toast' }, { label: '招募', action: 'toast' }],
    note: '展示通关后可招募的状态样式；原型操作只反馈，不解锁或消耗玩家资源。',
    source: ['packages/core/src/companion-system.ts:84-101', 'packages/presentation/src/hub-shop.ts:303-326'],
    related: ['npc-companions', 'hub-growth']
  },
  {
    id: 'hub-detail-task', group: '主神空间', label: '任务 · 领取详情', title: '妖塔一层主线', subtitle: '主线任务 · 可领取示例',
    paragraphs: ['完成妖塔一层首通，并在主神空间确认章节推进。', '领取后获得 80 奖励点，解锁镜潮地铁。'],
    sections: [{ title: '章节推进', paragraphs: ['完成首通后回到主神空间，再手动领取主线奖励。每项任务只能领取一次。'] }],
    footer: [{ label: '返回', target: 'npc-tasks' }, { label: '领取', action: 'toast' }],
    note: '这是主线任务手动领取，独立于首通结算；不得将本屏反馈视为真实领取或解锁。',
    source: ['packages/core/src/task-system.ts:195-216', 'packages/presentation/src/hub-shop.ts:329-363'],
    related: ['npc-tasks', 'entry-root', 'result-root']
  },
  {
    id: 'hub-services', group: '主神空间', label: '军需官 · 封存委托', title: '装备封存委托', subtitle: '军需官 · 其他服务',
    paragraphs: ['暂时封存两件不同装备，成功走出 3 个不同副本后解除封存，并获得所选淬炼材料 ×2。', '启动消耗 300 奖励点与 1 灵蕴；封存期间装备不能使用或强化。'],
    rows: [
      { id: 'commission-star-iron', title: '星铁', image: 'item/star-iron-v1.png', text: '委托完成后获得 ×2', choice: true },
      { id: 'commission-cracked-core', title: '裂核', image: 'item/cracked-core-v1.png', text: '委托完成后获得 ×2', choice: true }
    ],
    footer: [{ label: '撤回委托', target: 'hub-confirm' }, { label: '启动委托', action: 'toast', requiresChoice: true }],
    hint: '目标材料由两件封存装备决定。',
    note: '仅呈现服务弹窗和目标材料选择。实际启动仍需两件符合条件的不同装备及足够资源；材料选择本身不消耗资源。',
    source: ['packages/core/src/equipment-commissions.ts:1-3', 'packages/presentation/src/hub-shop.ts:376-419', 'packages/presentation/src/view-model.ts:1224-1432'],
    related: ['hub-confirm', 'npc-merchant']
  },
  {
    id: 'hub-recover', group: '主神空间', label: '补给商 · 休整服务', title: '休整服务', subtitle: '补给商',
    rows: [{ title: '恢复生命', text: '免费将生命补满，立即生效。', badge: '免费' }],
    footer: [{ label: '返回', target: 'npc-supplies' }, { label: '恢复生命', action: 'toast' }],
    note: '沿用免费恢复生命的服务，不引入收费或新的恢复机制。',
    source: ['packages/presentation/src/view-model.ts:1108-1110', 'packages/presentation/src/hub-shop.ts:376-380'],
    related: ['npc-supplies']
  },
  {
    id: 'hub-more-actions', group: '主神空间', label: '装备 · 更多操作', title: '破甲剑 · 更多操作',
    rows: [
      { title: '铭刻', text: '为满级装备选择额外属性；改选会替换原铭刻并重新消耗资源。', target: 'hub-detail-equipment' },
      { title: '淬炼', text: '继续提高满级装备的属性；淬炼 II 还需先完成铭刻。', target: 'hub-detail-equipment' },
      { title: '封存委托', text: '将符合条件的装备加入两件封存装备草稿。', target: 'hub-services' }
    ],
    footer: [{ label: '返回详情', target: 'hub-detail-equipment' }],
    note: '更多操作独立收纳低频服务，保留满级、材料和委托状态的前置条件；不自动执行操作。',
    source: ['cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2659-2771', 'packages/presentation/src/view-model.ts:1630-1669'],
    related: ['hub-detail-equipment', 'hub-services', 'hub-confirm']
  },
  {
    id: 'hub-confirm', group: '主神空间', label: '服务 · 操作确认', title: '确认撤回委托', subtitle: '装备封存委托',
    paragraphs: ['撤回后，两件装备解除封存。', '启动消耗不返还，并会丢失当前不同副本的委托进度。'],
    footer: [{ label: '取消', target: 'hub-services' }, { label: '确认撤回', action: 'toast' }],
    note: '高风险动作先阅读后确认。示例不填写未知的真实委托进度，也不执行撤回。',
    source: ['packages/presentation/src/view-model.ts:1275-1289', 'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2630-2650'],
    related: ['hub-services']
  },
  {
    id: 'hub-equipment', group: '主神空间', label: '玩家 · 装备目录', title: '已拥有装备', subtitle: '穿戴与配置',
    tabs: [{ label: '装备', target: 'hub-equipment' }, { label: '养成', target: 'hub-growth' }],
    rows: [
      { id: 'owned-training-blade', title: '训练短刃', image: 'equipment/training-blade-v1.png', text: '基础武器 · 攻击 +4', badge: '已装备示例', choice: true },
      { id: 'owned-armor-piercing', title: '破甲剑', image: 'equipment/armor-piercing-sword-v1.png', text: '武器 · 攻击 +9 · 速度 +1', badge: '背包中示例', choice: true },
      { id: 'owned-patched-coat', title: '拼缝护衣', image: 'equipment/patched-coat-v1.png', text: '护甲 · 生命上限 +10 · 防御 +2', badge: '已装备示例', choice: true }
    ],
    footer: [{ label: '破甲剑详情', target: 'hub-owned-equipment-detail' }, { label: '穿戴', action: 'choose', requiresChoice: true }],
    hint: '选择装备演示穿戴；同部位只能穿一件。',
    note: '已拥有列表样式示例。穿戴不会购买，同部位只能穿一件；示例拥有状态不代表当前玩家存档。',
    source: ['packages/presentation/src/hub-shop.ts:118-146', 'packages/presentation/src/hub-shop.ts:429-475', 'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2873-2980'],
    related: ['hub-growth', 'bag-equipment', 'hub-owned-equipment-detail', 'npc-merchant']
  },
  {
    id: 'hub-owned-equipment-detail', group: '主神空间', label: '玩家 · 破甲剑详情', title: '破甲剑', subtitle: '已拥有示例 · 武器 · 普通',
    rows: [{ title: '破甲剑', image: 'equipment/armor-piercing-sword-v1.png', text: '对厚甲怪和矿壳守卫有额外威慑。', meta: 'Lv.1 / 3 · 背包中示例' }],
    metrics: [{ label: '基础攻击', value: '+9' }, { label: '基础速度', value: '+1' }],
    sections: [
      { title: '每级成长', paragraphs: ['攻击 +4。'] },
      { title: '固定词缀 · 破甲锋线', paragraphs: ['攻击 +2。'] }
    ],
    footer: [{ label: '返回装备', target: 'hub-equipment' }, { label: '穿戴', action: 'toast' }],
    hint: '已拥有，穿戴后生效；同部位只能穿一件。',
    note: '破甲剑 Lv.1 已拥有的详情样例，与商品兑换入口分开；基础属性不合并固定词缀，示例穿戴不改存档。',
    source: ['packages/core/src/equipment-catalog.ts:82-91', 'packages/core/src/equipment-system.ts:138-141', 'packages/presentation/src/hub-shop.ts:118-146'],
    related: ['hub-equipment', 'hub-detail-equipment', 'npc-merchant']
  },
  {
    id: 'hub-growth', group: '主神空间', label: '玩家 · 养成配置', title: '已拥有养成', subtitle: '功法 · 灵宠 · 血统 · 同伴',
    tabs: [{ label: '装备', target: 'hub-equipment' }, { label: '养成', target: 'hub-growth' }],
    sections: [
      { title: '灵宠 · 设为出战', rows: [{ title: '契约小灵', image: 'pet/contract-sprite-v1.png', text: '一次只出战一只；只有出战灵宠提供属性。', target: 'hub-config-pet' }] },
      { title: '功法 · 常用排序', rows: [{ title: '吐纳诀', image: 'item/mist-breathing-v2.png', text: '被动全部生效；常用只调整列表顺序。', target: 'hub-config-method' }] },
      { title: '血统 · 激活', rows: [{ title: '巨灵骨髓', image: 'item/titan-marrow-v2.png', text: '一次只激活一种，下次入场带入当前阶位。', target: 'hub-config-bloodline' }] },
      { title: '同伴 · 设为出战', rows: [{ title: '秦彻', image: 'character/qin-che-v1.png', text: '一次只带一位，下次入场按当前阶位提供援助。', target: 'hub-config-companion' }] }
    ],
    footer: [{ label: '关闭', action: 'close' }],
    note: '保留已拥有的配置目录与 NPC 购买、培养目录的区别。本屏是各分类配置样式的合并展示，不显示不存在的抽卡入口。',
    source: ['packages/presentation/src/hub-shop.ts:429-475', 'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2873-2980'],
    related: ['hub-equipment', 'player-character', 'npc-pets', 'npc-methods', 'npc-bloodlines', 'npc-companions']
  },
  {
    id: 'hub-config-pet', group: '主神空间', label: '玩家 · 灵宠配置详情', title: '契约小灵', subtitle: '已拥有灵宠示例',
    rows: [{ title: '契约小灵', image: 'pet/contract-sprite-v1.png', text: '心神 +1 · 术法 +3', meta: '每级术法 +2' }],
    paragraphs: ['一次只出战一只灵宠；只有出战中的灵宠提供属性与特性。'],
    footer: [{ label: '返回', target: 'hub-growth' }, { label: '设为出战', action: 'toast' }],
    note: '已拥有的配置详情只设出战；培养仍在灵宠师处进行。样例不修改玩家当前出战灵宠。',
    source: ['packages/presentation/src/hub-shop.ts:429-475', 'packages/core/src/pet-system.ts:17-28'],
    related: ['hub-growth', 'npc-pets']
  },
  {
    id: 'hub-config-method', group: '主神空间', label: '玩家 · 功法配置详情', title: '吐纳诀', subtitle: '已学功法示例',
    rows: [{ title: '吐纳诀', image: 'item/mist-breathing-v2.png', text: '心神 +1', meta: '奖励节点可出现隐藏路线' }],
    paragraphs: ['已学功法的被动都生效；常用只调整列表顺序。精研后下次入场使用新阶位战技。'],
    footer: [{ label: '返回', target: 'hub-growth' }, { label: '设为常用', action: 'toast' }],
    note: '配置常用不会关闭其他已学功法的被动，也不替代学习或精研。',
    source: ['packages/presentation/src/hub-shop.ts:282-301', 'packages/presentation/src/hub-shop.ts:429-475'],
    related: ['hub-growth', 'npc-methods']
  },
  {
    id: 'hub-config-bloodline', group: '主神空间', label: '玩家 · 血统配置详情', title: '巨灵骨髓', subtitle: '已觉醒血统示例',
    rows: [{ title: '巨灵骨髓', image: 'item/titan-marrow-v2.png', text: '一阶攻击 +6 · 生命上限 +12', meta: '一阶血统爆发：物理伤害 18' }],
    paragraphs: ['每次只激活一种血统；下次入场按当前激活的血统和阶位带入副本。'],
    footer: [{ label: '返回', target: 'hub-growth' }, { label: '激活血统', action: 'toast' }],
    note: '已觉醒的配置详情仅激活，不会执行觉醒或晋升；示例阶位不是当前玩家状态。',
    source: ['packages/presentation/src/hub-shop.ts:283-302', 'packages/presentation/src/hub-shop.ts:429-475'],
    related: ['hub-growth', 'npc-bloodlines']
  },
  {
    id: 'hub-config-companion', group: '主神空间', label: '玩家 · 同伴配置详情', title: '秦彻', subtitle: '已拥有同伴示例',
    rows: [{ title: '秦彻', image: 'character/qin-che-v1.png', text: '壁垒先锋 · 抢位援护', meta: '一阶援助：获得防御' }],
    paragraphs: ['每次只能带一位同伴；下次入场按当前出战人选和阶位提供援助。'],
    footer: [{ label: '返回', target: 'hub-growth' }, { label: '设为出战', action: 'toast' }],
    note: '已拥有的配置详情只设出战；招募和训练仍在同行引路人处进行。',
    source: ['packages/presentation/src/hub-shop.ts:303-326', 'packages/presentation/src/hub-shop.ts:429-475'],
    related: ['hub-growth', 'npc-companions']
  },
  {
    id: 'entry-root', group: '轮回入场', label: '入场 · 章节列表', title: '轮回之门', subtitle: '选择本次挑战的世界',
    description: '未解锁章节可查看要求，满足条件后才能进入。',
    rows: [
      { id: 'entry-demon-tower', title: '妖塔一层', image: 'dungeon/demon-tower-1-v1.png', meta: '第 01 章 · 推荐战力 150', badge: '可进入示例', choice: true },
      { title: '镜潮地铁', image: 'dungeon/metro-abyss-v1.png', meta: '第 02 章 · 推荐战力 185', badge: '未解锁示例', target: 'entry-locked' },
      { title: '星坠矿井', image: 'dungeon/starfall-mine-v1.png', meta: '第 03 章 · 推荐战力 230', badge: '未解锁示例', text: '完成并领取「镜潮地铁主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '锈疫病院', image: 'dungeon/rust-hospital-v1.png', meta: '第 04 章 · 推荐战力 265', badge: '未解锁示例', text: '完成并领取「星坠矿井主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '灰烬竞技场', image: 'dungeon/ash-arena-v1.png', meta: '第 05 章 · 推荐战力 305', badge: '未解锁示例', text: '完成并领取「锈疫病院主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '梦档案馆', image: 'dungeon/dream-archive-v1.png', meta: '第 06 章 · 推荐战力 345', badge: '未解锁示例', text: '完成并领取「灰烬竞技场主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '虚界城', image: 'dungeon/void-citadel-v1.png', meta: '第 07 章 · 推荐战力 390', badge: '未解锁示例', text: '完成并领取「梦档案馆主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '时序观测庭', image: 'dungeon/temporal-observatory-v1.png', meta: '第 08 章 · 推荐战力 435', badge: '未解锁示例', text: '完成并领取「虚界城主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '因果清算所', image: 'dungeon/causal-clearinghouse-v1.png', meta: '第 09 章 · 推荐战力 500', badge: '未解锁示例', text: '完成并领取「时序观测庭主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '熵海方舟', image: 'dungeon/entropy-ark-v1.png', meta: '第 10 章 · 推荐战力 565', badge: '未解锁示例', text: '完成并领取「因果清算所主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '镜海轮回城', image: 'dungeon/mirror-cycle-city-v2.png', meta: '第 11 章 · 推荐战力 630', badge: '未解锁示例', text: '完成并领取「熵海方舟主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '删界终稿院', image: 'dungeon/redaction-scriptorium-v2.png', meta: '第 12 章 · 推荐战力 700', badge: '未解锁示例', text: '完成并领取「镜海轮回城主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '亡队遗产拍卖庭', image: 'dungeon/legacy-auction-court-v2.png', meta: '第 13 章 · 推荐战力 780', badge: '未解锁示例', text: '完成并领取「删界终稿院主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '众生原型库', image: 'dungeon/genesis-vault-v2.png', meta: '第 14 章 · 推荐战力 860', badge: '未解锁示例', text: '完成并领取「亡队遗产拍卖庭主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '寂声广播塔', image: 'dungeon/silent-broadcast-tower-v2.png', meta: '第 15 章 · 推荐战力 950', badge: '未解锁示例', text: '完成并领取「众生原型库主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '失联避难所', image: 'dungeon/lost-shelter-v2.png', meta: '第 16 章 · 推荐战力 1040', badge: '未解锁示例', text: '完成并领取「寂声广播塔主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '伪证裁定庭', image: 'dungeon/false-testimony-court-v2.png', meta: '第 17 章 · 推荐战力 1140', badge: '未解锁示例', text: '完成并领取「失联避难所主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '战痕复演场', image: 'dungeon/combat-replay-stage-v2.png', meta: '第 18 章 · 推荐战力 1240', badge: '未解锁示例', text: '完成并领取「伪证裁定庭主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' },
      { title: '天幕监察城', image: 'dungeon/panopticon-city-v2.png', meta: '第 19 章 · 推荐战力 1350', badge: '未解锁示例', text: '完成并领取「战痕复演场主线」后解锁。', disabled: true, reason: '尚未领取前一章主线奖励。' }
    ],
    footer: [{ label: '入场设置', target: 'entry-settings' }, { label: '进入副本', action: 'toast', requiresChoice: true }],
    hint: '选择世界后确认进入；主线奖励需手动领取。',
    note: '章节名称、图片与推荐战力复用现有入场原型。展示首章可进入的示例；选章节只修改草稿，确认前不开始本局。第二章可查看锁定详情，后续锁定行直接展示各自解锁条件。',
    source: ['prototype/dungeon-entry-v1/data.js:2-214', 'packages/presentation/src/view-model.ts:894-926', 'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2412-2475'],
    related: ['entry-locked', 'entry-settings', 'entry-protocol', 'entry-relic', 'entry-contract']
  },
  {
    id: 'entry-locked', group: '轮回入场', label: '入场 · 锁定章节', title: '镜潮地铁', subtitle: '第 02 章 · 未解锁示例',
    rows: [{ title: '镜潮地铁', image: 'dungeon/metro-abyss-v1.png', meta: '推荐战力 185', text: '完成并领取「妖塔一层主线」后解锁。' }],
    paragraphs: ['首通妖塔一层后，返回任务使者处手动领取主线奖励，才会推进到下一章。'],
    footer: [{ label: '查看主线', target: 'hub-detail-task' }, { label: '进入副本', disabled: true, reason: '尚未领取前一章主线奖励。' }],
    note: '允许查看锁定章节的条件，禁止直接进入。此屏是第二章锁定详情代表，后续章节同样依据各自前一章主线条件。',
    source: ['prototype/dungeon-entry-v1/data.js:14-24', 'packages/presentation/src/view-model.ts:906-925', 'packages/core/src/task-system.ts:195-216'],
    related: ['entry-root', 'hub-detail-task', 'npc-tasks']
  },
  {
    id: 'entry-settings', group: '轮回入场', label: '入场 · 设置总览', title: '入场设置', subtitle: '妖塔一层 · 准备草稿',
    rows: [
      { title: '入场协议', text: '标准探索 / 烙印协议 / 炼狱探索', badge: '标准探索示例', target: 'entry-protocol' },
      { title: '回响方向', text: '强攻 / 守御 / 寻路', badge: '强攻示例', target: 'entry-relic' },
      { title: '路线契约', text: '通关本章后可接取，按顺序完成两个目标。', badge: '未接取示例', target: 'entry-contract' },
      { title: '归档种子', text: '从已归档且匹配方向的回响中选择首轮候选。', badge: '不携带示例', target: 'entry-relic' }
    ],
    sections: [{ title: '炼狱层级', paragraphs: ['选择炼狱探索时出现层级调整；完成当前最高层后可解锁更高一层。'] }],
    footer: [{ label: '返回章节', target: 'entry-root' }, { label: '完成调整', target: 'entry-root' }],
    note: '保留全部已存在的入场设置。调整仅改准备草稿，不消耗库存或提前生成本局命数。',
    source: ['packages/presentation/src/view-model.ts:928-1065', 'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts:2479-2560'],
    related: ['entry-root', 'entry-protocol', 'entry-relic', 'entry-contract', 'player-carry']
  },
  {
    id: 'entry-protocol', group: '轮回入场', label: '入场 · 协议与炼狱', title: '入场协议', subtitle: '妖塔一层 · 协议选择',
    rows: [
      { id: 'protocol-standard', title: '标准探索', text: '按原始副本规则探索，不追加烙印压力或协议奖励。', choice: true },
      { id: 'protocol-imprint', title: '烙印协议', text: '先绕至塔底咒水井镇住咒水，再挑战雾塔监斩官。', badge: '通关后开放', disabled: true, reason: '需先通关本章。' },
      { id: 'protocol-deep', title: '炼狱探索', text: '逐层挑战炼狱，完成当前最高层后解锁更高一层。', badge: '通关后开放', disabled: true, reason: '需先通关本章。' }
    ],
    sections: [{ title: '层级调整', rows: [
      { title: '降低一层', disabled: true, reason: '选择炼狱探索后可调整至已解锁范围。' },
      { title: '提高一层', disabled: true, reason: '选择炼狱探索后可调整至已解锁范围。' }
    ] }],
    footer: [{ label: '返回', target: 'entry-settings' }, { label: '选择协议', action: 'choose', requiresChoice: true }],
    note: '使用未通关状态展示开放条件。选择协议只改草稿，实际解锁层级从玩家进度读取，原型不编造当前层。',
    source: ['packages/core/src/run-protocols.ts:123-143', 'packages/core/src/run-protocols.ts:848-878', 'packages/presentation/src/view-model.ts:928-963'],
    related: ['entry-settings', 'entry-root']
  },
  {
    id: 'entry-relic', group: '轮回入场', label: '入场 · 回响与归档种子', title: '回响方向', subtitle: '影响本局回响候选',
    rows: [
      { id: 'frame-assault', title: '强攻回响', image: 'run-relic/mist_edge-v1.png', text: '偏向输出与战斗收益。', choice: true },
      { id: 'frame-bulwark', title: '守御回响', image: 'run-relic/bone_shell-v1.png', text: '偏向防御、恢复与陷阱减伤。', choice: true },
      { id: 'frame-wayfinder', title: '寻路回响', image: 'run-relic/rift_step-v1.png', text: '偏向探索、传送与节点收益。', choice: true }
    ],
    sections: [
      { title: '候选数量', paragraphs: ['每次默认 2 个候选；与生效中的装备回响导流方向匹配时为 3 个。'] },
      { title: '归档种子', paragraphs: ['可不携带种子，或从已归档且匹配方向的回响中选择，使其进入本局首轮候选。切换方向会清除不相容的种子。'] }
    ],
    footer: [{ label: '返回', target: 'entry-settings' }, { label: '选择方向', action: 'choose', requiresChoice: true }],
    note: '保留强攻、守御、寻路与导流候选规则；归档种子不等于直接获取回响。本屏方向选择仅展示原型反馈。',
    source: ['packages/core/src/run-relics.ts:14-18', 'packages/presentation/src/view-model.ts:993-1065'],
    related: ['entry-settings', 'reward-claim', 'result-root']
  },
  {
    id: 'entry-contract', group: '轮回入场', label: '入场 · 路线契约', title: '路线契约', subtitle: '妖塔一层 · 通关后示例',
    rows: [
      { id: 'contract-none', title: '不接取路线契约', text: '本次入场按当前协议探索。', choice: true },
      { id: 'contract-mist-watch', title: '巡雾问井', text: '先肃清上层雾巡，再下行封住咒水井。', meta: '独立奖励 135 奖励点', choice: true },
      { id: 'contract-ash-blade', title: '灰坑引刃', text: '先踏灭塔底灰坑的伏火，再登北阶截住屠刀手。', meta: '独立奖励 135 奖励点', choice: true },
      { id: 'contract-lower-hunt', title: '底层回猎', text: '先在塔底击退巡猎屠夫，再返回高层拆除松砖机关。', meta: '独立奖励 135 奖励点', choice: true }
    ],
    footer: [{ label: '返回', target: 'entry-settings' }, { label: '选择契约', action: 'choose', requiresChoice: true }],
    note: '展示本章通关后可选契约的独立样式；目标顺序与奖励沿用源码。这里仅选择准备草稿，不生成或完成契约。',
    source: ['packages/core/src/route-contracts.ts:114-119', 'packages/presentation/src/view-model.ts:964-992'],
    related: ['entry-settings', 'entry-root', 'result-root']
  }
];
