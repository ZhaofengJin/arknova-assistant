/** DOM 对账测试:假 DOM 实现 DomLike 接口,验证读取与对账逻辑。 */

import { describe, expect, it } from 'vitest';
import {
  reconcile,
  readCounter,
  readDisplayIds,
  readDomSnapshot,
  SELECTORS,
  type DomLike,
  type ElementLike,
} from './reconcile';

function el(attrs: Record<string, string>): ElementLike {
  return {
    id: attrs.id ?? '',
    textContent: attrs.text ?? null,
    getAttribute: (name) => attrs[name] ?? null,
  };
}

/** 假 DOM:按精确选择器字符串匹配 */
function fakeDom(opts: {
  hasPool?: boolean;
  displayCards?: ElementLike[];
  deck?: string;
  discard?: string;
}): DomLike {
  const { hasPool = true, displayCards = [], deck, discard } = opts;
  return {
    querySelector(sel) {
      if (sel === SELECTORS.displayContainer) return hasPool ? el({ id: 'cards-pool' }) : null;
      if (sel === SELECTORS.deckCounter) return deck !== undefined ? el({ text: deck }) : null;
      if (sel === SELECTORS.discardCounter) return discard !== undefined ? el({ text: discard }) : null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === `${SELECTORS.displayContainer} ${SELECTORS.cardNode}`) return displayCards;
      return [];
    },
  };
}

describe('readDisplayIds', () => {
  it('从 data-id 读取官方卡牌 id', () => {
    const dom = fakeDom({
      displayCards: [el({ 'data-id': 'A401_Cheetah' }), el({ 'data-id': 'S101_Sponsor' })],
    });
    expect(readDisplayIds(dom)).toEqual(['A401_Cheetah', 'S101_Sponsor']);
  });

  it('data-id 缺失时回退到元素 id 的 card- 前缀', () => {
    const dom = fakeDom({ displayCards: [el({ id: 'card-A401_Cheetah' })] });
    expect(readDisplayIds(dom)).toEqual(['A401_Cheetah']);
  });

  it('展示区容器不存在时返回 null(区别于空展示区)', () => {
    expect(readDisplayIds(fakeDom({ hasPool: false }))).toBeNull();
    expect(readDisplayIds(fakeDom({ displayCards: [] }))).toEqual([]);
  });
});

describe('readCounter', () => {
  it('解析计数器文本中的数字', () => {
    expect(readCounter(fakeDom({ deck: '142' }), SELECTORS.deckCounter)).toBe(142);
  });
  it('计数器不存在或无数字时返回 null', () => {
    expect(readCounter(fakeDom({}), SELECTORS.deckCounter)).toBeNull();
    expect(readCounter(fakeDom({ deck: '' }), SELECTORS.deckCounter)).toBeNull();
  });
});

describe('readDomSnapshot', () => {
  it('一次读取全部快照字段', () => {
    const snap = readDomSnapshot(
      fakeDom({ displayCards: [el({ 'data-id': 'A401_Cheetah' })], deck: '100', discard: '23' }),
    );
    expect(snap).toEqual({ displayIds: ['A401_Cheetah'], deckCount: 100, discardCount: 23 });
  });
});

const baseExpected = {
  displayIds: ['A401_Cheetah'],
  deckEstimate: 100,
  discardEstimate: 23,
  displayBlindSpot: 0,
};

describe('reconcile', () => {
  it('完全一致时无告警', () => {
    const snap = readDomSnapshot(
      fakeDom({ displayCards: [el({ 'data-id': 'A401_Cheetah' })], deck: '100', discard: '23' }),
    );
    expect(reconcile(snap, baseExpected)).toEqual([]);
  });

  it('日志推算有但页面没有 → 展示区告警', () => {
    const snap = readDomSnapshot(fakeDom({ displayCards: [], deck: '100', discard: '23' }));
    const issues = reconcile(snap, baseExpected);
    expect(issues).toHaveLength(1);
    expect(issues[0].area).toBe('display');
    expect(issues[0].message).toContain('日志推算有但页面没有');
  });

  it('页面有但日志没有 + 日志完整 → 展示区告警', () => {
    const dom = fakeDom({
      displayCards: [el({ 'data-id': 'A401_Cheetah' }), el({ 'data-id': 'A402_Tiger' })],
      deck: '100',
      discard: '23',
    });
    const issues = reconcile(readDomSnapshot(dom), baseExpected);
    expect(issues.some((i) => i.area === 'display' && i.message.includes('页面有但日志推算没有'))).toBe(true);
  });

  it('页面有但日志没有 + 日志盲区 > 0 → 降级为提示', () => {
    const dom = fakeDom({
      displayCards: [el({ 'data-id': 'A401_Cheetah' }), el({ 'data-id': 'A402_Tiger' })],
      deck: '100',
      discard: '23',
    });
    const issues = reconcile(readDomSnapshot(dom), { ...baseExpected, displayBlindSpot: 2 });
    const display = issues.find((i) => i.area === 'display');
    expect(display?.message).toContain('日志窗口不完整');
  });

  it('展示区容器缺失 → 布局告警', () => {
    const snap = readDomSnapshot(fakeDom({ hasPool: false, deck: '100', discard: '23' }));
    const issues = reconcile(snap, baseExpected);
    expect(issues.some((i) => i.area === 'layout')).toBe(true);
  });

  it('牌库计数不一致 → 告警并给出两个读数', () => {
    const snap = readDomSnapshot(
      fakeDom({ displayCards: [el({ 'data-id': 'A401_Cheetah' })], deck: '97', discard: '23' }),
    );
    const issues = reconcile(snap, baseExpected);
    expect(issues.some((i) => i.area === 'deck' && i.message.includes('97') && i.message.includes('100'))).toBe(true);
  });

  it('弃牌堆计数不一致 → 告警', () => {
    const snap = readDomSnapshot(
      fakeDom({ displayCards: [el({ 'data-id': 'A401_Cheetah' })], deck: '100', discard: '20' }),
    );
    const issues = reconcile(snap, baseExpected);
    expect(issues.some((i) => i.message.includes('弃牌堆') && i.message.includes('20'))).toBe(true);
  });

  it('日志窗口不完整时计数不一致 → 降级为一条提示而非硬告警', () => {
    const snap = readDomSnapshot(
      fakeDom({ displayCards: [el({ 'data-id': 'A401_Cheetah' })], deck: '97', discard: '20' }),
    );
    const issues = reconcile(snap, { ...baseExpected, displayBlindSpot: 3 });
    const countIssues = issues.filter((i) => i.message.includes('计数'));
    expect(countIssues).toHaveLength(1);
    expect(countIssues[0].area).toBe('layout');
    expect(countIssues[0].message).toContain('日志窗口不完整');
    expect(countIssues[0].message).toContain('牌库');
    expect(countIssues[0].message).toContain('弃牌堆');
  });

  it('计数器读不到时不告警(页面区域可能尚未渲染)', () => {
    const snap = readDomSnapshot(fakeDom({ displayCards: [el({ 'data-id': 'A401_Cheetah' })] }));
    const issues = reconcile(snap, baseExpected);
    expect(issues).toEqual([]);
  });
});
