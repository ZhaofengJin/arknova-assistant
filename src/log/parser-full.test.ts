/** 完整对局日志片段的回放测试:覆盖中后期模式(打出、购买/精选展示区、狩猎、鲨鱼袭击、休息阶段、毒液)。 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardByDisplayName } from '../data/cardDb';
import { parseLogText, replayEvents, type GameEvent } from './parser';

const ME = 'JeffJin';
const id = (zh: string): string => {
  const c = cardByDisplayName(zh);
  if (!c) throw new Error(`测试卡牌不存在: ${zh}`);
  return c.id;
};
const log = readFileSync('samples/game-log-full-2026-10-08.normalized.txt', 'utf-8')
  .split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
const events = parseLogText(log, ME);

function byKind<K extends GameEvent['kind']>(kind: K): Extract<GameEvent, { kind: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind);
}

const names = (refs: { kind: string; card?: { nameZh: string }; rawName?: string }[]) =>
  refs.map((r) => (r.kind === 'resolved' ? (r as { card: { nameZh: string } }).card.nameZh : (r as { rawName: string }).rawName));

describe('完整日志:解析覆盖', () => {
  it('没有无法识别的行', () => {
    expect(byKind('unknown')).toEqual([]);
  });

  it('没有未解析的卡名', () => {
    expect(replayEvents(events).unresolvedNames).toEqual([]);
  });

  it('弃牌堆总数推算:匿名弃牌 + 实名弃牌 + 展示区移除 + 狩猎弃牌', () => {
    expect(replayEvents(events).discardPileCount).toBe(18);
  });

  it('打出动物:付费打出与免费打出都识别,归属手牌或展示区', () => {
    const plays = byKind('playCard');
    const played = (zh: string) => plays.find((p) => p.card.kind === 'resolved' && p.card.card.nameZh === zh);
    expect(played('羱羊')).toMatchObject({ player: 'zpdleld', cost: 7, from: 'hand' });
    expect(played('锥齿鲨')).toMatchObject({ player: 'me', cost: 29, from: 'hand' });
    expect(played('美国短吻鳄')).toMatchObject({ player: 'zpdleld', cost: 18, from: 'hand' });
    expect(played('鲸头鹳')).toMatchObject({ player: 'shiqiliu670', cost: 9, from: 'hand' });
    expect(played('小型动物专家')).toMatchObject({ player: 'me', from: 'hand' });
    expect(played('红尾蚺')).toMatchObject({ player: 'zpdleld', cost: 20, from: 'display' });
  });

  it('从展示区拿取/精选', () => {
    const takes = byKind('takeDisplay');
    const taken = (zh: string) => takes.find((t) => t.card.kind === 'resolved' && t.card.card.nameZh === zh);
    expect(taken('公主海葵')).toMatchObject({ player: 'me' });
    expect(taken('食草类动物繁育计划')).toMatchObject({ player: 'me' });
    expect(taken('小型动物专家')).toMatchObject({ player: 'me' });
    expect(taken('蛇蜥')).toMatchObject({ player: 'zpdleld' });
  });

  it('展示区移除(海浪图标/最前面两张)', () => {
    const removals = byKind('displayRemove');
    expect(removals).toHaveLength(2);
    expect(names(removals.flatMap((r) => r.cards)).sort()).toEqual(
      ['白点刺鼻单棘鲀', '海底隧道', '科研', '本地海鸟'].sort(),
    );
  });

  it('狩猎效果:展示三张,保留一张,弃除两张', () => {
    const reveal = byKind('huntReveal')[0];
    expect(reveal.player).toBe('me');
    expect(names(reveal.cards)).toEqual(['园林学家', '驴', '综合研究员']);
    const keep = byKind('huntKeep')[0];
    expect(names(keep.kept)).toEqual(['驴']);
    expect(names(keep.discarded)).toEqual(['园林学家', '综合研究员']);
  });

  it('效果弃牌(鲨鱼袭击)带原因', () => {
    const d = byKind('discard').find((e) => e.reason === '鲨鱼袭击');
    expect(d).toMatchObject({ player: 'me' });
    expect(names(d!.cards)).toEqual(['驯鹿']);
  });

  it('匿名弃牌:休息阶段与洞察力', () => {
    const anon = byKind('discardAnonymous');
    expect(anon).toContainEqual({ kind: 'discardAnonymous', player: 'shiqiliu670', count: 6, reason: '休息阶段' });
    expect(anon).toContainEqual({ kind: 'discardAnonymous', player: 'zpdleld', count: 1, reason: '休息阶段' });
    expect(anon).toContainEqual({ kind: 'discardAnonymous', player: 'shiqiliu670', count: 1, reason: '洞察力效果' });
  });
});

describe('完整日志:回放重建', () => {
  const state = replayEvents(events);

  it('打出的牌进入消耗集合', () => {
    for (const zh of ['锥齿鲨', '鸭嘴兽', '羱羊', '美国短吻鳄', '鲸头鹳', '红尾蚺', '小型动物专家',
      '笑翠鸟', '鸸鹋', '蛇蜥', '考古学家', '红腿白臀叶猴']) {
      expect(state.consumedCardIds, zh).toContain(id(zh));
    }
  });

  it('我的手牌:保留的狩猎牌在,弃掉的与打出的不在', () => {
    expect(state.myHandCardIds).toContain(id('驴'));
    expect(state.myHandCardIds).toContain(id('厄瓜多尔松鼠猴'));
    expect(state.myHandCardIds).not.toContain(id('欧洲獾')); // 抓了又弃
    expect(state.myHandCardIds).not.toContain(id('驯鹿')); // 鲨鱼袭击弃掉
    expect(state.myHandCardIds).not.toContain(id('小型动物专家')); // 精选后又打出
  });

  it('对手从展示区拿走又打出的牌:不进隐藏牌集合,进消耗集合', () => {
    // 蛇蜥:zpdleld 先从展示区精选,随后打出——完整生命周期
    expect(state.knownHiddenCardIds).not.toContain(id('蛇蜥'));
    expect(state.consumedCardIds).toContain(id('蛇蜥'));
  });

  it('对手从展示区拿走且未打出的牌记为已知隐藏牌(计数制)', () => {
    const snake = id('蛇蜥');
    const synthetic = replayEvents([
      { kind: 'takeDisplay', player: 'zpdleld', card: { kind: 'resolved', card: cardByDisplayName('蛇蜥')! } },
    ]);
    expect(synthetic.knownHiddenCardIds).toContain(snake);
    // 倒序日志:打出事件先于拿取事件出现时,结果不变
    const reversed = replayEvents([
      { kind: 'playCard', player: 'zpdleld', card: { kind: 'resolved', card: cardByDisplayName('蛇蜥')! }, from: 'hand' },
      { kind: 'takeDisplay', player: 'zpdleld', card: { kind: 'resolved', card: cardByDisplayName('蛇蜥')! } },
    ]);
    expect(reversed.knownHiddenCardIds).not.toContain(snake);
    expect(reversed.consumedCardIds).toContain(snake);
  });
});
