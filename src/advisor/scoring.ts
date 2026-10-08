/** 启发式评分:对单张牌打分,规则透明、权重可调。
 *  只看牌面数据 + 我的打出牌构成的协同引擎;金钱/围栏可行性标 unknown。
 */

import type { Card } from '../data/cardDb';
import type { GameState } from './gameState';

export interface Weights {
  /** 标签/大洲协同 */
  synergy: number;
  /** 费用效率(魅力/费用) */
  efficiency: number;
  /** 保护点权重 */
  conservation: number;
}

export const DEFAULT_WEIGHTS: Weights = { synergy: 3, efficiency: 2, conservation: 8 };

export interface ScoredCard {
  card: Card;
  score: number;
  reasons: string[];
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** 统计一组牌的标签(类别+大洲)出现次数 */
export function countTags(cards: Card[]): Record<string, number> {
  const tags: Record<string, number> = {};
  for (const c of cards) {
    for (const t of [...list(c.categories), ...list(c.continents)]) {
      tags[t] = (tags[t] ?? 0) + 1;
    }
  }
  return tags;
}

/** 前置条件中涉及标签的部分,哪些未满足(如 {Predator: 3}) */
export function unmetPrereqs(card: Card, myTags: Record<string, number>): string[] {
  const prereqs = card.prerequisites;
  if (!prereqs || typeof prereqs !== 'object' || Array.isArray(prereqs)) return [];
  const unmet: string[] = [];
  for (const [tag, need] of Object.entries(prereqs as Record<string, number>)) {
    if (typeof need !== 'number') continue; // SponsorsII 这类行动等级前置,事件流读不到,跳过
    if ((myTags[tag] ?? 0) < need) unmet.push(`${tag}×${need}`);
  }
  return unmet;
}

export function scoreCard(card: Card, gs: GameState, w: Weights): ScoredCard {
  const reasons: string[] = [];
  let score = 0;
  const myTags = countTags(gs.myInPlay);

  const appeal = num(card.appeal);
  const cost = card.type === 'sponsor' ? num(card.lvl) : num(card.cost);
  const conservation = num(card.conservation);

  // 费用效率
  const eff = appeal / Math.max(cost, 1);
  score += eff * 10 * w.efficiency;
  if (appeal > 0) reasons.push(`魅力 ${appeal} / 费用 ${cost}`);

  // 保护点(终局核心资源)
  if (conservation > 0) {
    score += conservation * w.conservation;
    reasons.push(`保护点 +${conservation}`);
  }

  // 协同:类别/大洲与已打出牌重叠
  const overlap = [...list(card.categories), ...list(card.continents)]
    .reduce((s, t) => s + Math.min(myTags[t] ?? 0, 2), 0);
  if (overlap > 0) {
    score += overlap * w.synergy;
    reasons.push(`协同已有标签 ×${overlap}`);
  }

  // 前置条件
  const unmet = unmetPrereqs(card, myTags);
  if (unmet.length > 0) {
    score *= 0.2;
    reasons.push(`前置未满足: ${unmet.join('、')}`);
  }

  return { card, score: Math.round(score * 10) / 10, reasons };
}

export function scoreCards(cards: Card[], gs: GameState, w: Weights): ScoredCard[] {
  return cards.map((c) => scoreCard(c, gs, w)).sort((a, b) => b.score - a.score);
}
