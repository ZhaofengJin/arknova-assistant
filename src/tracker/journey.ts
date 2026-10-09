/** 逐牌履历记牌器(工单 11):按玩家追踪每张已知身份的牌:
 *  从哪获得(来源)→ 现在在哪(在手/已使用/已丢弃)。
 *  匿名移动(对手只有数量的摸牌/弃牌)记为计数,配合未知池概率做手牌猜测。
 *
 *  输入事件必须按时间正序(日志 id 升序)排列——main.ts 在读取 DOM 时排序。
 *  与 replayEvents 的聚合计数不同,这里保留每张牌的个体轨迹。
 */

import type { Card } from '../data/cardDb';
import type { CardRef, GameEvent, PlayerRef } from '../log/parser';

/** 获得来源(面板直接展示,用中文) */
export type ObtainSource = '牌库' | '大学奖励' | '展示区' | '狩猎' | '蛙潜' | '终局计分牌库' | '手牌(来源未知)';

export interface CardJourneyEntry {
  card: Card;
  source: ObtainSource;
}

export interface PlayerJourney {
  player: PlayerRef;
  /** 当前仍持有的已知身份牌(含终局计分卡) */
  knownHand: CardJourneyEntry[];
  /** 已使用(打出/购买)的牌 */
  played: CardJourneyEntry[];
  /** 已丢弃的牌 */
  discarded: CardJourneyEntry[];
  /** 匿名主牌库手牌估计(身份未知的牌数) */
  anonymousHand: number;
  /** 匿名终局计分卡数 */
  anonymousScoring: number;
}

/** 从已知手牌中移除一张(返回它的来源;不在手牌里返回 undefined) */
function takeFromHand(hand: CardJourneyEntry[], cardId: string): ObtainSource | undefined {
  const i = hand.findIndex((e) => e.card.id === cardId);
  if (i < 0) return undefined;
  const [entry] = hand.splice(i, 1);
  return entry.source;
}

export function trackJourneys(events: GameEvent[]): PlayerJourney[] {
  const journeys = new Map<PlayerRef, PlayerJourney>();
  const anonDrawn: Record<string, number> = {};
  const anonDiscarded: Record<string, number> = {};
  const anonScoring: Record<string, number> = {};
  /** 匿名抽取后身份转已知的牌数(狩猎保留),结算时从匿名手牌剔除 */
  const knownFromAnon: Record<string, number> = {};

  const of = (player: PlayerRef): PlayerJourney => {
    let j = journeys.get(player);
    if (!j) {
      j = { player, knownHand: [], played: [], discarded: [], anonymousHand: 0, anonymousScoring: 0 };
      journeys.set(player, j);
    }
    return j;
  };

  const obtain = (player: PlayerRef, ref: CardRef, source: ObtainSource): void => {
    if (ref.kind === 'resolved') of(player).knownHand.push({ card: ref.card, source });
  };

  for (const e of events) {
    switch (e.kind) {
      case 'draw': {
        const source: ObtainSource = e.deck === 'scoring' ? '终局计分牌库' : e.origin === '大学奖励' ? '大学奖励' : '牌库';
        for (const ref of e.cards) obtain(e.player, ref, source);
        break;
      }
      case 'drawAnonymous':
        of(e.player); // 仅有匿名事件的玩家也要建档
        if (e.deck === 'scoring') anonScoring[e.player] = (anonScoring[e.player] ?? 0) + e.count;
        else anonDrawn[e.player] = (anonDrawn[e.player] ?? 0) + e.count;
        break;
      case 'discard':
        for (const ref of e.cards) {
          if (ref.kind !== 'resolved') continue;
          const source = takeFromHand(of(e.player).knownHand, ref.card.id) ?? '手牌(来源未知)';
          of(e.player).discarded.push({ card: ref.card, source });
        }
        break;
      case 'discardAnonymous':
        of(e.player);
        anonDiscarded[e.player] = (anonDiscarded[e.player] ?? 0) + e.count;
        break;
      case 'takeDisplay':
        obtain(e.player, e.card, '展示区');
        break;
      case 'playCard': {
        if (e.card.kind !== 'resolved') break;
        // 从展示区直接打出/购买:从未进过手牌
        const source: ObtainSource =
          e.from === 'display' ? '展示区' : takeFromHand(of(e.player).knownHand, e.card.card.id) ?? '手牌(来源未知)';
        of(e.player).played.push({ card: e.card.card, source });
        break;
      }
      case 'huntKeep': {
        const source: ObtainSource = e.origin === '蛙潜' ? '蛙潜' : '狩猎';
        for (const ref of e.kept) obtain(e.player, ref, source);
        // 弃除的牌:从牌库顶亮出后丢弃,从未进手牌,但仍要记履历
        for (const ref of e.discarded) {
          if (ref.kind === 'resolved') of(e.player).discarded.push({ card: ref.card, source });
        }
        if (e.discardedCount) anonDiscarded[e.player] = (anonDiscarded[e.player] ?? 0) + e.discardedCount;
        if (e.fromAnonymousDraw) knownFromAnon[e.player] = (knownFromAnon[e.player] ?? 0) + e.kept.filter((r) => r.kind === 'resolved').length;
        break;
      }
      // displayRefill/displayRemove/huntReveal 不进任何玩家手牌,不记履历
      default:
        break;
    }
  }

  for (const j of journeys.values()) {
    const drawn = Math.max(0, (anonDrawn[j.player] ?? 0) - (knownFromAnon[j.player] ?? 0));
    j.anonymousHand = Math.max(0, drawn - (anonDiscarded[j.player] ?? 0));
    j.anonymousScoring = anonScoring[j.player] ?? 0;
  }

  // 我排最前,其余按名字
  return [...journeys.values()].sort((a, b) =>
    a.player === 'me' ? -1 : b.player === 'me' ? 1 : String(a.player).localeCompare(String(b.player)),
  );
}
