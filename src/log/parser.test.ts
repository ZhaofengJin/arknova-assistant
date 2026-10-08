/** 日志解析器测试:用真实对局日志样本做回放(fixture 测试,只断言外部行为)。 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLogText, replayEvents, type GameEvent } from './parser';

const raw = readFileSync('samples/game-log-2026-10-08.txt', 'utf-8');
// 样本文件里以 # 开头的是注释,不是 BGA 输出
const log = raw.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
const events = parseLogText(log);

function byKind<K extends GameEvent['kind']>(kind: K): Extract<GameEvent, { kind: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind);
}

describe('日志解析:事件流', () => {
  it('没有无法识别的行(unknown 为零)', () => {
    expect(byKind('unknown')).toEqual([]);
  });

  it('识别出我的开局摸牌:8 张主牌库牌 + 2 张终局计分牌,全部解析', () => {
    const myDraws = byKind('draw').filter((e) => e.player === 'me');
    const main = myDraws.find((e) => e.deck === 'main');
    const scoring = myDraws.find((e) => e.deck === 'scoring');
    expect(main?.cards).toHaveLength(8);
    expect(scoring?.cards).toHaveLength(2);
    expect(myDraws.flatMap((e) => e.cards).every((c) => c.kind === 'resolved')).toBe(true);
  });

  it('对手的摸牌只有数量没有牌名', () => {
    const anon = byKind('drawAnonymous');
    expect(anon).toContainEqual({ kind: 'drawAnonymous', player: 'shiqiliu670', count: 8, deck: 'main' });
    expect(anon).toContainEqual({ kind: 'drawAnonymous', player: 'zpdleld', count: 2, deck: 'scoring' });
  });

  it('我的弃牌按名解析,对手的弃牌匿名', () => {
    const myDiscard = byKind('discard').find((e) => e.player === 'me');
    expect(myDiscard?.cards.map((c) => c.kind === 'resolved' && c.card.nameZh)).toEqual(
      ['发言人', '环尾狐猴', '黄喉貂', '儿童游乐园'],
    );
    expect(byKind('discardAnonymous')).toHaveLength(2);
  });

  it('展示区补充 6 张牌,全部解析', () => {
    const refill = byKind('displayRefill');
    expect(refill).toHaveLength(1);
    expect(refill[0].cards).toHaveLength(6);
    expect(refill[0].cards.every((c) => c.kind === 'resolved')).toBe(true);
  });

  it('建造是建造事件,不会污染卡牌流(小型海洋馆不是牌)', () => {
    const builds = byKind('build');
    expect(builds).toContainEqual({ kind: 'build', player: 'JeffJin', cost: 4, structure: '小型海洋馆' });
  });

  it('行动卡选择与放置事件', () => {
    expect(byKind('actionSelected')).toContainEqual(
      { kind: 'actionSelected', player: 'JeffJin', strength: 5, actionCard: 'I' });
    expect(byKind('actionPlaced')).toContainEqual({ kind: 'actionPlaced', player: 'JeffJin', slot: 1 });
  });
});

describe('日志解析:回放重建', () => {
  const state = replayEvents(events);

  it('消耗牌 = 我的 4 张弃牌 + 展示区 6 张', () => {
    expect(state.consumedCardIds).toHaveLength(10);
  });

  it('弃牌后我的手牌剩 4 张', () => {
    expect(state.myHandCardIds).toHaveLength(4);
  });

  it('匿名摸牌按玩家计数', () => {
    expect(state.anonymous.drawn).toEqual({ shiqiliu670: 8, zpdleld: 8 });
    expect(state.anonymous.discarded).toEqual({ shiqiliu670: 4, zpdleld: 4 });
  });

  it('没有未解析的卡名', () => {
    expect(state.unresolvedNames).toEqual([]);
  });
});
