/** 建议引擎:五大行动优先级排序 + 一句理由。
 *  v1 纯事件流驱动:手牌、展示区、已打出牌、支持的项目都是已知的;
 *  金钱/地图/协会工人未读取(DOM,工单 07),涉及它们的建议标注不确定。
 */

import type { Card } from '../data/cardDb';
import type { GameState } from './gameState';
import { scoreCards, type ScoredCard, type Weights } from './scoring';

export type ActionKind = 'cards' | 'build' | 'animals' | 'sponsors' | 'association';

export interface Advice {
  action: ActionKind;
  actionZh: string;
  /** 0-100 */
  score: number;
  reason: string;
  /** 是否有关键局面信息未知 */
  partial: boolean;
}

const clamp100 = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

const best = (cards: Card[], gs: GameState, w: Weights): ScoredCard | undefined =>
  scoreCards(cards, gs, w)[0];

export function advise(gs: GameState, w: Weights): Advice[] {
  const handAnimals = gs.myHand.filter((c) => c.type === 'animal');
  const handSponsors = gs.myHand.filter((c) => c.type === 'sponsor');
  const advices: Advice[] = [];

  // 动物:手牌里最好的动物
  const bestAnimal = best(handAnimals, gs, w);
  advices.push(bestAnimal
    ? {
        action: 'animals', actionZh: '动物', score: clamp100(bestAnimal.score), partial: true,
        reason: `手牌最佳:${bestAnimal.card.nameZh}(${bestAnimal.reasons[0] ?? ''})。金钱/围栏未读取,费用可行性请自行确认`,
      }
    : { action: 'animals', actionZh: '动物', score: 5, partial: false, reason: '手牌里没有动物' });

  // 赞助商:手牌里最好的赞助商
  const bestSponsor = best(handSponsors, gs, w);
  advices.push(bestSponsor
    ? { action: 'sponsors', actionZh: '赞助', score: clamp100(bestSponsor.score), partial: true, reason: `手牌最佳赞助商:${bestSponsor.card.nameZh}` }
    : { action: 'sponsors', actionZh: '赞助', score: 5, partial: false, reason: '手牌里没有赞助商' });

  // 卡牌:展示区最佳 + 手牌少加成
  const bestDisplay = best(gs.displayCards, gs, w);
  const cardsScore = (bestDisplay ? bestDisplay.score : 10) + (gs.myHand.length <= 2 ? 15 : 0);
  advices.push({
    action: 'cards', actionZh: '卡牌', score: clamp100(cardsScore), partial: gs.displayUnknownRemovals > 0,
    reason: bestDisplay
      ? `展示区最佳:${bestDisplay.card.nameZh}(${bestDisplay.reasons.join(';')})`
      : '展示区没有值得拿的牌,可刷新',
  });

  // 建造:手里有动物才迫切;地图未读取,固定中等
  advices.push(handAnimals.length > 0
    ? { action: 'build', actionZh: '建造', score: 40, partial: true, reason: `手牌有 ${handAnimals.length} 只动物;地图围栏状态未读取,缺空间时优先` }
    : { action: 'build', actionZh: '建造', score: 15, partial: true, reason: '手牌没有动物,建造不急;地图状态未读取' });

  // 协会:保护项目协同 + 手牌少时抽牌价值(基准压低,避免盖过能打的手牌)
  const assocScore = 10 + (gs.mySupportedProjects.length === 0 ? 10 : 0) + (gs.myHand.length <= 2 ? 8 : 0);
  advices.push({
    action: 'association', actionZh: '协会', score: clamp100(assocScore), partial: true,
    reason: gs.mySupportedProjects.length === 0
      ? '尚未支持任何保护项目;协会工人与合作动物园状态未读取'
      : `已支持 ${gs.mySupportedProjects.length} 个项目;协会板状态未读取`,
  });

  return advices.sort((a, b) => b.score - a.score);
}
