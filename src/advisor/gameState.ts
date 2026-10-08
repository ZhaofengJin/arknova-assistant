/** 局面推导:从事件流重建建议引擎所需的局面状态。
 *  全部来自日志事件,不读 DOM。计数制,与日志顺序无关。
 *  已知盲区(留给工单 07 的 DOM 读取):金钱、地图围栏、协会工人。
 */

import { cardById, type Card } from '../data/cardDb';
import type { GameEvent, ReplayState } from '../log/parser';

export interface GameState {
  /** 当前展示区里的牌(补充 − 拿取/购买/移除) */
  displayCards: Card[];
  /** 我的手牌 */
  myHand: Card[];
  /** 我已打出的牌(动物园里的协同引擎) */
  myInPlay: Card[];
  /** 我保留的终局计分卡 */
  myScoring: Card[];
  /** 我支持过的保护项目名 */
  mySupportedProjects: string[];
  /** 对手手牌估计(记牌推算) */
  opponentHandEstimate: number;
  /** 展示区推算置信度:日志窗口外的移除(开局前就在展示区的牌)计数 */
  displayUnknownRemovals: number;
}

export function deriveGameState(events: GameEvent[], replay: ReplayState): GameState {
  const displayCount = new Map<string, number>();
  const inPlay = new Set<string>();
  const scoring = new Map<string, number>();
  const projects: string[] = [];
  let displayUnknownRemovals = 0;

  const bump = (map: Map<string, number>, id: string, d: number): void => {
    map.set(id, (map.get(id) ?? 0) + d);
  };

  for (const e of events) {
    switch (e.kind) {
      case 'displayRefill':
        for (const r of e.cards) if (r.kind === 'resolved') bump(displayCount, r.card.id, 1);
        break;
      case 'displayRemove':
        for (const r of e.cards) {
          if (r.kind !== 'resolved') continue;
          // 移除的牌不在已知展示区里:它是日志窗口开始前就在展示区的牌
          if ((displayCount.get(r.card.id) ?? 0) <= 0) displayUnknownRemovals += 1;
          bump(displayCount, r.card.id, -1);
        }
        break;
      case 'takeDisplay':
        if (e.card.kind === 'resolved') bump(displayCount, e.card.card.id, -1);
        break;
      case 'playCard':
        if (e.card.kind !== 'resolved') break;
        if (e.from === 'display') bump(displayCount, e.card.card.id, -1);
        if (e.player === 'me') inPlay.add(e.card.card.id);
        break;
      case 'draw':
        if (e.deck === 'scoring' && e.player === 'me') {
          for (const r of e.cards) if (r.kind === 'resolved') bump(scoring, r.card.id, 1);
        }
        break;
      case 'discard':
        if (e.player === 'me') {
          for (const r of e.cards) if (r.kind === 'resolved') bump(scoring, r.card.id, -1);
        }
        break;
      case 'projectSupport':
        if (e.player === 'me') projects.push(e.project);
        break;
    }
  }

  const cardsOf = (ids: Iterable<string>): Card[] =>
    [...ids].map((id) => cardById(id)).filter((c): c is Card => c !== undefined);

  return {
    displayCards: cardsOf([...displayCount.entries()].filter(([, n]) => n > 0).map(([id]) => id)),
    myHand: cardsOf(replay.myHandCardIds),
    myInPlay: cardsOf(inPlay),
    myScoring: cardsOf([...scoring.entries()].filter(([, n]) => n > 0).map(([id]) => id)),
    mySupportedProjects: projects,
    opponentHandEstimate: Math.max(
      0,
      Object.values(replay.anonymous.drawn).reduce((a, b) => a + b, 0)
        - Object.values(replay.anonymous.discarded).reduce((a, b) => a + b, 0),
    ),
    displayUnknownRemovals,
  };
}
