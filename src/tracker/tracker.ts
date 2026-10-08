/** 记牌核心:纯函数。输入卡牌池 + 回放状态,输出剩余牌库推算。
 *  模型:未知池 = 卡牌池 − 消耗牌 − 我的手牌;
 *       对手手牌估计 H = 匿名摸牌数 − 匿名弃牌数;牌库估计 D = U − H;
 *       某牌(未知池中 n 张副本)至少一张在真实牌库的概率 = 1 − ∏_{i<n} (H−i)/(U−i)。
 */

import { mainDeckCards, type Card } from '../data/cardDb';
import type { ReplayState } from '../log/parser';

export interface RemainingEntry {
  card: Card;
  unknownCopies: number;
  /** 至少一张仍在真实牌库中的概率(0-1) */
  deckProbability: number;
}

export interface TrackerView {
  /** 未知池总量(身份不明的牌) */
  unknownTotal: number;
  /** 对手手牌估计 */
  opponentHandEstimate: number;
  /** 真实牌库剩余估计 */
  deckEstimate: number;
  /** 逐牌推算,按在牌库概率降序 */
  entries: RemainingEntry[];
  /** 未解析卡名告警 */
  unresolvedNames: string[];
}

export function deckProbability(unknownCopies: number, unknownTotal: number, opponentHand: number): number {
  if (unknownTotal <= 0) return 0;
  if (opponentHand < unknownCopies) return 1;
  let pNoneInDeck = 1;
  for (let i = 0; i < unknownCopies; i++) {
    pNoneInDeck *= (opponentHand - i) / (unknownTotal - i);
  }
  return 1 - pNoneInDeck;
}

export function computeTracker(state: ReplayState, mode: 'bg' | 'mw' = 'mw'): TrackerView {
  const pool = mainDeckCards(mode);
  // 已知区域:消耗牌 + 我的手牌 + 身份已知的对手手牌,全部从未知池剔除
  const known = new Set([...state.consumedCardIds, ...state.myHandCardIds, ...state.knownHiddenCardIds]);

  const copiesByCard = new Map<string, { card: Card; n: number }>();
  for (const card of pool) {
    if (known.has(card.id)) continue;
    const e = copiesByCard.get(card.id);
    if (e) e.n += 1;
    else copiesByCard.set(card.id, { card, n: 1 });
  }

  const unknownTotal = [...copiesByCard.values()].reduce((s, e) => s + e.n, 0);
  const drawn = Object.values(state.anonymous.drawn).reduce((a, b) => a + b, 0);
  const discarded = Object.values(state.anonymous.discarded).reduce((a, b) => a + b, 0);
  const opponentHandEstimate = Math.max(0, drawn - discarded);
  const deckEstimate = Math.max(0, unknownTotal - opponentHandEstimate);

  const entries = [...copiesByCard.values()]
    .map(({ card, n }) => ({
      card,
      unknownCopies: n,
      deckProbability: deckProbability(n, unknownTotal, opponentHandEstimate),
    }))
    .sort((a, b) => b.deckProbability - a.deckProbability || a.card.nameZh.localeCompare(b.card.nameZh, 'zh'));

  return { unknownTotal, opponentHandEstimate, deckEstimate, entries, unresolvedNames: state.unresolvedNames };
}
