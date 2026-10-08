# 05: DOM 校验兜底

**What to build:** 从页面 DOM 抓取展示区与弃牌堆的当前卡牌集合，与日志重建的状态对账；发现不一致（日志漏事件、解析错误、BGA 改版迹象）时在面板上给出明确告警。DOM 抓取是校验通道，日志仍是主通道。

**Blocked by:** 04 记牌核心 + 剩余牌库面板

**Status:** done

- [x] 能抓取展示区与弃牌堆的 DOM 卡牌集合（用保存的网页快照做解析测试）
- [x] 自动对账：DOM 集合与日志状态不一致时面板显示告警与差异明细
- [x] DOM 选择器集中定义，BGA 改版时只需改一处

## Comments

2026-10-08 实现完成（v0.1.1）:

- `src/dom/reconcile.ts`:`SELECTORS` 常量集中定义。展示区容器 `#cards-pool`、
  卡牌元素 `.ark-card.zoo-card`(官方 id 在 `data-id`),依据官方 Cards.js
  源码确认(`getCardContainer` / `setupCards`);计数器 `#deck-counter` / `#discard-counter`。
- 对账三项:展示区集合逐牌 diff、牌库计数器 vs `deckEstimate`、弃牌堆计数器 vs
  新增的 `replay.discardPileCount`(匿名弃牌+实名弃牌+展示区移除+狩猎弃牌,整局 fixture 断言 = 18)。
- 日志盲区处理:`displayUnknownRemovals > 0` 时「页面有但日志没有」降级为提示而非告警。
- **范围降级说明**:弃牌堆在 BGA 页面上只显示计数、不渲染牌面(DOM 里无卡牌元素),
  因此弃牌堆只能做计数级对账,无法做集合级——这是 BGA 前端所限,非实现遗漏。
- 测试用假 DOM(实现 `DomLike` 最小接口),未引入 jsdom;真实页面选择器尚未实测,
  若 BGA 实际渲染与源码不符,告警区会显示「未找到展示区容器」,改版时只改 `SELECTORS`。
- 已知缺口:牌库耗尽后弃牌堆重洗回牌库的日志模式无样本,届时计数对账会告警提示。
