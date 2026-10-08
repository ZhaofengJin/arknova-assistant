/** DOM 对账(工单 05):页面 DOM 是校验通道,日志推算仍是主通道。
 *  对账范围:
 *  1. 展示区卡牌集合(DOM 元素逐个对账,能发现漏事件/解析错误)
 *  2. 牌库计数器(页面读数是权威值,与日志推算的 deckEstimate 对比)
 *  3. 弃牌堆计数器(页面上弃牌堆只显示计数、不显示牌面,只能对总数)
 *  所有选择器集中在 SELECTORS,BGA 改版只需改这里。
 *  选择器依据(2026-10 从官方 Cards.js 确认):展示区容器 #cards-pool,
 *  卡牌元素 .ark-card.zoo-card,官方 id 在 data-id 属性;计数器 #deck-counter / #discard-counter。
 */

import { cardById } from '../data/cardDb';

export const SELECTORS = {
  displayContainer: '#cards-pool',
  cardNode: '.ark-card.zoo-card',
  deckCounter: '#deck-counter',
  discardCounter: '#discard-counter',
} as const;

/** 最小 DOM 接口:真实页面传 document,测试传假 DOM,避免引入 jsdom */
export interface ElementLike {
  getAttribute(name: string): string | null;
  id: string;
  textContent: string | null;
}

export interface DomLike {
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ArrayLike<ElementLike>;
}

export interface DomSnapshot {
  /** 展示区卡牌官方 id;null = 容器没找到(BGA 可能改版) */
  displayIds: string[] | null;
  /** 牌库计数器读数;null = 读不到 */
  deckCount: number | null;
  /** 弃牌堆计数器读数;null = 读不到 */
  discardCount: number | null;
}

export function readDisplayIds(root: DomLike): string[] | null {
  if (!root.querySelector(SELECTORS.displayContainer)) return null;
  const nodes = root.querySelectorAll(`${SELECTORS.displayContainer} ${SELECTORS.cardNode}`);
  const ids: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const dataId = el.getAttribute('data-id');
    if (dataId) {
      ids.push(dataId);
      continue;
    }
    // 兜底:元素 id 形如 card-A401_Cheetah
    const m = /^card-(.+)$/.exec(el.id ?? '');
    if (m) ids.push(m[1]);
  }
  return ids;
}

export function readCounter(root: DomLike, selector: string): number | null {
  const el = root.querySelector(selector);
  if (!el) return null;
  const m = /\d+/.exec(el.textContent ?? '');
  return m ? Number(m[0]) : null;
}

export function readDomSnapshot(root: DomLike): DomSnapshot {
  return {
    displayIds: readDisplayIds(root),
    deckCount: readCounter(root, SELECTORS.deckCounter),
    discardCount: readCounter(root, SELECTORS.discardCounter),
  };
}

export interface ReconcileExpected {
  /** 日志推算的展示区官方 id */
  displayIds: string[];
  /** 日志推算的牌库剩余估计 */
  deckEstimate: number;
  /** 日志推算的弃牌堆总数 */
  discardEstimate: number;
  /** 日志盲区:日志窗口开始前就在展示区、后被移除的牌数(>0 说明日志不完整) */
  displayBlindSpot: number;
}

export interface ReconcileIssue {
  area: 'layout' | 'display' | 'deck' | 'discard';
  message: string;
}

function namesOf(ids: string[]): string {
  return ids.map((id) => cardById(id)?.nameZh ?? id).join('、');
}

export function reconcile(snap: DomSnapshot, exp: ReconcileExpected): ReconcileIssue[] {
  const issues: ReconcileIssue[] = [];

  // 1. 展示区集合对账
  if (snap.displayIds === null) {
    issues.push({
      area: 'layout',
      message: `未找到展示区容器 ${SELECTORS.displayContainer}(BGA 可能已改版,对账暂停)`,
    });
  } else {
    const dom = new Set(snap.displayIds);
    const log = new Set(exp.displayIds);
    const onlyInLog = [...log].filter((id) => !dom.has(id));
    const onlyInDom = [...dom].filter((id) => !log.has(id));
    if (onlyInLog.length > 0) {
      issues.push({
        area: 'display',
        message: `日志推算有但页面没有:${namesOf(onlyInLog)}(可能漏了解析移除事件)`,
      });
    }
    if (onlyInDom.length > 0) {
      // 日志窗口不完整时(开局前就在展示区的牌),DOM 多出属预期,降级为提示
      const prefix = exp.displayBlindSpot > 0 ? '日志窗口不完整,以页面为准:' : '页面有但日志推算没有:';
      issues.push({
        area: 'display',
        message: `${prefix}${namesOf(onlyInDom)}`,
      });
    }
  }

  // 2. 牌库计数对账:页面计数器是权威值
  if (snap.deckCount !== null && snap.deckCount !== exp.deckEstimate) {
    issues.push({
      area: 'deck',
      message: `牌库计数不一致:页面 ${snap.deckCount} / 日志推算 ${exp.deckEstimate}(可能漏了摸牌或弃牌事件)`,
    });
  }

  // 3. 弃牌堆计数对账
  if (snap.discardCount !== null && snap.discardCount !== exp.discardEstimate) {
    issues.push({
      area: 'discard',
      message: `弃牌堆计数不一致:页面 ${snap.discardCount} / 日志推算 ${exp.discardEstimate}`,
    });
  }

  return issues;
}
