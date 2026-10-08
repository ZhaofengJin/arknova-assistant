/** 记牌核心测试:给定回放状态断言剩余牌库推算(纯外部行为)。 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mainDeckCards } from '../data/cardDb';
import { parseLogText, replayEvents } from '../log/parser';
import { computeTracker, deckProbability } from './tracker';

const log = readFileSync('samples/game-log-2026-10-08.txt', 'utf-8')
  .split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
const state = replayEvents(parseLogText(log));
const pool = mainDeckCards('mw');
const view = computeTracker(state, 'mw');

describe('记牌核心', () => {
  it('未知池 = 卡牌池 − 消耗牌(10) − 我的手牌(4)', () => {
    expect(view.unknownTotal).toBe(pool.length - 14);
  });

  it('对手手牌估计 = 匿名摸牌(16) − 匿名弃牌(8) = 8', () => {
    expect(view.opponentHandEstimate).toBe(8);
    expect(view.deckEstimate).toBe(view.unknownTotal - 8);
  });

  it('单副本牌的在牌库概率 = D/U', () => {
    const expected = view.deckEstimate / view.unknownTotal;
    const single = view.entries.find((e) => e.unknownCopies === 1);
    expect(single).toBeDefined();
    expect(single!.deckProbability).toBeCloseTo(expected, 10);
  });

  it('消耗牌与手牌不出现在推算里', () => {
    const ids = new Set(view.entries.map((e) => e.card.id));
    for (const id of [...state.consumedCardIds, ...state.myHandCardIds]) {
      expect(ids.has(id), id).toBe(false);
    }
  });

  it('概率排序降序', () => {
    for (let i = 1; i < view.entries.length; i++) {
      expect(view.entries[i - 1].deckProbability).toBeGreaterThanOrEqual(view.entries[i].deckProbability);
    }
  });

  it('空状态:对手无牌时一切必在牌库', () => {
    const empty = computeTracker(
      { consumedCardIds: [], myHandCardIds: [], knownHiddenCardIds: [], anonymous: { drawn: {}, discarded: {} }, discardPileCount: 0, unresolvedNames: [] },
      'mw',
    );
    expect(empty.unknownTotal).toBe(pool.length);
    expect(empty.opponentHandEstimate).toBe(0);
    expect(empty.entries.every((e) => e.deckProbability === 1)).toBe(true);
  });

  it('概率公式边界:对手手牌小于副本数时必在牌库', () => {
    expect(deckProbability(3, 100, 2)).toBe(1);
    expect(deckProbability(1, 100, 0)).toBe(1);
    expect(deckProbability(1, 0, 0)).toBe(0);
  });
});
