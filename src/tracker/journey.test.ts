/** 逐牌履历记牌器测试:合成时间正序事件流,验证每张牌的来源与去向追踪。 */

import { describe, expect, it } from 'vitest';
import { cardByDisplayName } from '../data/cardDb';
import type { CardRef, GameEvent } from '../log/parser';
import { trackJourneys } from './journey';

const ref = (nameZh: string): CardRef => {
  const card = cardByDisplayName(nameZh);
  if (!card) throw new Error(`测试卡名不存在: ${nameZh}`);
  return { kind: 'resolved', card };
};

describe('trackJourneys', () => {
  it('我的实名摸牌进手牌,打出后转入已使用并保留来源', () => {
    const events: GameEvent[] = [
      { kind: 'draw', player: 'me', cards: [ref('锥齿鲨')], deck: 'main' },
      { kind: 'playCard', player: 'me', card: ref('锥齿鲨'), cost: 29, from: 'hand' },
    ];
    const [me] = trackJourneys(events);
    expect(me.knownHand).toEqual([]);
    expect(me.played).toHaveLength(1);
    expect(me.played[0].card.nameZh).toBe('锥齿鲨');
    expect(me.played[0].source).toBe('牌库');
  });

  it('对手从展示区拿牌:身份已知并带来源;打出后离开手牌', () => {
    const events: GameEvent[] = [
      { kind: 'takeDisplay', player: 'opp', card: ref('白犀牛') },
      { kind: 'playCard', player: 'opp', card: ref('白犀牛'), cost: 18, from: 'hand' },
    ];
    const [opp] = trackJourneys(events);
    expect(opp.knownHand).toEqual([]);
    expect(opp.played[0].source).toBe('展示区');
  });

  it('对手打出匿名摸到的牌:来源记为「手牌(来源未知)」', () => {
    const events: GameEvent[] = [
      { kind: 'drawAnonymous', player: 'opp', count: 8, deck: 'main' },
      { kind: 'playCard', player: 'opp', card: ref('马来熊'), cost: 13, from: 'hand' },
    ];
    const [opp] = trackJourneys(events);
    expect(opp.played[0].source).toBe('手牌(来源未知)');
    // 匿名手牌 = 摸 8 - 弃 0,打出的牌也在其中但身份揭晓后仍是 8 张里的一张
    expect(opp.anonymousHand).toBe(8);
  });

  it('弃牌:已知手牌丢弃带来源;匿名弃牌只增减计数', () => {
    const events: GameEvent[] = [
      { kind: 'draw', player: 'me', cards: [ref('儿童游乐园'), ref('欧洲泽龟')], deck: 'main' },
      { kind: 'discard', player: 'me', cards: [ref('儿童游乐园')] },
      { kind: 'drawAnonymous', player: 'opp', count: 8, deck: 'main' },
      { kind: 'discardAnonymous', player: 'opp', count: 4 },
    ];
    const [me, opp] = trackJourneys(events);
    expect(me.knownHand.map((e) => e.card.nameZh)).toEqual(['欧洲泽龟']);
    expect(me.discarded[0]).toMatchObject({ source: '牌库' });
    expect(opp.anonymousHand).toBe(4);
  });

  it('狩猎保留计牌变体:保留牌来源为狩猎且不占匿名手牌', () => {
    const events: GameEvent[] = [
      { kind: 'drawAnonymous', player: 'opp', count: 3, deck: 'main' },
      {
        kind: 'huntKeep',
        player: 'opp',
        kept: [ref('秃鹳')],
        discarded: [],
        discardedCount: 2,
        fromAnonymousDraw: true,
        origin: '狩猎',
      },
    ];
    const [opp] = trackJourneys(events);
    expect(opp.knownHand[0]).toMatchObject({ source: '狩猎' });
    expect(opp.anonymousHand).toBe(0); // 摸 3 - 保留转已知 1 - 弃 2
  });

  it('蛙潜:保留牌来源为蛙潜,弃除牌从未入手但记履历', () => {
    const events: GameEvent[] = [
      {
        kind: 'huntKeep',
        player: 'me',
        kept: [ref('海龟水族箱')],
        discarded: [ref('邦加跗猴'), ref('大羊驼')],
        origin: '蛙潜',
      },
    ];
    const [me] = trackJourneys(events);
    expect(me.knownHand[0]).toMatchObject({ source: '蛙潜' });
    expect(me.discarded.map((e) => e.card.nameZh)).toEqual(['邦加跗猴', '大羊驼']);
  });

  it('终局计分卡与大学奖励各有来源标记', () => {
    const events: GameEvent[] = [
      { kind: 'draw', player: 'me', cards: [ref('国际动物园')], deck: 'scoring' },
      { kind: 'draw', player: 'me', cards: [ref('锥齿鲨')], deck: 'main', origin: '大学奖励' },
      { kind: 'drawAnonymous', player: 'opp', count: 2, deck: 'scoring' },
    ];
    const [me, opp] = trackJourneys(events);
    const sources = Object.fromEntries(me.knownHand.map((e) => [e.card.nameZh, e.source]));
    expect(sources['国际动物园']).toBe('终局计分牌库');
    expect(sources['锥齿鲨']).toBe('大学奖励');
    expect(opp.anonymousScoring).toBe(2);
  });

  it('从展示区直接购买打出:从未进手牌,直接记已使用', () => {
    const events: GameEvent[] = [
      { kind: 'playCard', player: 'opp', card: ref('红尾蚺'), cost: 20, from: 'display' },
    ];
    const [opp] = trackJourneys(events);
    expect(opp.knownHand).toEqual([]);
    expect(opp.played[0].source).toBe('展示区');
  });

  it('我排在玩家列表最前', () => {
    const events: GameEvent[] = [
      { kind: 'drawAnonymous', player: 'zzz', count: 1, deck: 'main' },
      { kind: 'draw', player: 'me', cards: [ref('欧洲泽龟')], deck: 'main' },
      { kind: 'drawAnonymous', player: 'aaa', count: 1, deck: 'main' },
    ];
    const players = trackJourneys(events).map((j) => j.player);
    expect(players).toEqual(['me', 'aaa', 'zzz']);
  });
});
