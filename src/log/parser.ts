/** 游戏日志解析器:把 BGA 方舟动物园的中文日志解析成规范化事件流。
 *  纯函数,不碰 DOM。规则:
 *  - 能识别的行产出结构化事件;认识但无关卡牌的(收入/毒液/休息等)产出 note/gain;完全不认识的产出 unknown,绝不静默吞掉
 *  - 匹配前把全角标点(,:())归一为半角,卡名不含标点不受影响
 *  - 卡名按显示名解析(中文界面=中文名),解析不出记 rawName 并告警
 *  - "你" 与本人用户名(可选参数 me)统一归一化为 'me'
 */

import { cardByDisplayName, type Card } from '../data/cardDb';

export type PlayerRef = 'me' | string;

/** 卡牌引用:已解析的带完整数据,未解析的保留原文名 */
export type CardRef = { kind: 'resolved'; card: Card } | { kind: 'unresolved'; rawName: string };

export type GameEvent =
  | { kind: 'draw'; player: PlayerRef; cards: CardRef[]; deck: 'main' | 'scoring' }
  | { kind: 'drawAnonymous'; player: PlayerRef; count: number; deck: 'main' | 'scoring' }
  | { kind: 'discard'; player: PlayerRef; cards: CardRef[]; reason?: string }
  | { kind: 'discardAnonymous'; player: PlayerRef; count: number; reason?: string }
  | { kind: 'displayRefill'; cards: CardRef[] }
  | { kind: 'displayRemove'; cards: CardRef[] }
  | { kind: 'playCard'; player: PlayerRef; card: CardRef; cost?: number; destination?: string; from: 'hand' | 'display' }
  | { kind: 'takeDisplay'; player: PlayerRef; card: CardRef }
  | { kind: 'huntReveal'; player: PlayerRef; cards: CardRef[] }
  | { kind: 'huntKeep'; player: PlayerRef; kept: CardRef[]; discarded: CardRef[] }
  | { kind: 'build'; player: PlayerRef; cost: number; structure: string }
  | { kind: 'gain'; player: PlayerRef; amount?: number; source?: string }
  | { kind: 'projectSupport'; player: PlayerRef; project: string }
  | { kind: 'actionSelected'; player: PlayerRef; strength: number; actionCard: string }
  | { kind: 'actionPlaced'; player: PlayerRef; slot: number }
  | { kind: 'actionSet'; player: PlayerRef; raw: string }
  | { kind: 'note'; text: string }
  | { kind: 'unknown'; text: string };

/** 全角标点归一为半角,匹配只写半角模式(用码点书写,避免全角/半角字面量混淆) */
function normalizePunctuation(text: string): string {
  const map: Record<string, string> = { '，': ',', '：': ':', '（': '(', '）': ')' };
  return text.replace(/[，：（）]/g, (ch) => map[ch] ?? ch);
}

function normPlayer(name: string, me?: string): PlayerRef {
  const n = name.trim(); // 日志里玩家名可能带空格("zpdleld 从展示区以…")
  return n === '你' || (me !== undefined && n === me) ? 'me' : n;
}

function splitNames(raw: string): string[] {
  return raw
    .split(/[,,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveCards(names: string[]): CardRef[] {
  return names.map((n) => {
    const card = cardByDisplayName(n);
    return card ? { kind: 'resolved', card } : { kind: 'unresolved', rawName: n };
  });
}

const P = {
  drawNamed: /^(.+?)从牌库中抓取到了(.+?)(?:\((终局计分卡牌)\))?$/,
  drawAnon: /^(.+?)从牌库中抓取(\d+)张(终局计分)?卡牌$/,
  insightDraw: /^(.+?)抓取了(\d+)张卡牌\((洞察力效果)\)$/,
  insightDiscard: /^洞察力效果:(.+?)\s*保留\s*(\d+)\s*张牌并丢弃\s*(\d+)\s*张牌$/,
  breakDiscard: /^(.+?)在休息阶段弃除了(\d+)张卡牌$/,
  effectDiscard: /^(.+?)弃除(.+?)由于(.+?)的效果$/,
  huntReveal: /^(.+?)抓取并展示了(.+?)(?:\((狩猎效果)\))$/,
  huntKeep: /^(.+?)保留(.+?)并弃除(.+?)(?:\((狩猎效果)\))$/,
  discardPurpose: /^(.+?)弃除了(.+?)以(.+?)(?:\((.+?)\))?$/,
  discardNamed: /^(.+?)弃除了(.+?)(?:\((初始卡牌选择)\))?$/,
  discardAnon: /^(.+?)弃除了(\d+)张卡牌(?:\((初始卡牌选择)\))?$/,
  displayRefill: /^展示区补充了(.+)$/,
  displayRemove: /^(?:根据所展示海浪图标的数量,)?移除展示区(?:最前面的两张|的\s*(\d+)\s*张)卡牌:(.+)$/,
  buyDisplay: /^(.+?)从展示区以\s*(\d+)\s*购买了\s*(.+?)\s*并将其放置在\s*(.+)$/,
  takeDisplay: /^(.+?)从展示区(?:中的声望范围内)?(?:拿取|精选)了?(.+?)$/,
  playPaid: /^(.+?)支付\s*(\d+)\s*打出(.+?),并将其放入(.+)$/,
  playFree: /^(.+?)打出(.+?)$/,
  build: /^(.+?)支付\s*(\d+)\s*建造了(?:一个|一间)?(.+)$/,
  gain: /^(.+?)获得(?:\s*(\d+))?\s*(?:\((.+?)\))?$/,
  actionSelected: /^(.+?)选择强度为\s*(\d+)\s*的行动卡牌\s*(.*)$/,
  actionPlaced: /^(.+?)将行动卡\s*放置在位置(\d+)/,
  actionSet: /^(.+?)将使用以下行动卡牌:(.+)$/,
  projectSupport: /^(.+?)支持了保护项目的第(?:一|1)格:(.+)$/,
  timestamp: /^\d{1,2}:\d{2}$/,
};

/** 认识但与卡牌流无关的行:记为 note,不污染 unknown。 */
const NOTES: RegExp[] = [
  /^(.+?) 有 \d+ 并因 \d+ 获得 -?\d+ 分。/, // 终局计分(可能两条句子连在一起)
  /^(.+?) 的总分为\d+ 分。$/,
  /^触发游戏结束:/,
  /^(.+?)支付\s*(\d+)\s*为了增加卡牌强度$/,
  /^(.+?)因在(.+?)上具有其玩家标记而获得\s*(\d+)$/, // 标记奖励,需在 gain 之前拦截
  /^(.+?)从展示区标记了(.+?)$/, // 标记不动牌,仅预订
  /^(.+?)支付\s*(\d+)\s*为了毒液$/,
  /^(.+?)使用毒液效果并将毒液标记给予(.+)$/,
  /^(.+?)支付\s*(\d+)\s*以获得\s*(\d+)\s*\((.+?)\)$/,
  /^(.+?)\s*捐赠\s*(\d+)\s*获得奖励\s*(\d+)$/,
  /^(.+?)升级\s*([IV]+)$/,
  /^(.+?)重新开始了他\(她\)的回合$/,
  /^(.+?)已(离线|上线)$/,
  /^(.+?)将休息标记推进了\d+格,现在位于\d+\/\d+$/,
  /^(.+?)推进了\d+格休息标记并到达了尽头/,
  /^(.+?)\s*增加声望$/,
  /^(.+?)获得一个新的协会事务员$/,
  /^(.+?)\s*拿取一个新的合作动物园$/,
  /^(休息结束|开始一次新的休息|补充合作动物园和大学|将所有玩家的事务员返回他们的个人面板|移除所有玩家卡牌上的指示物)$/,
];

export function parseLogLine(rawLine: string, me?: string): GameEvent | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;
  const text = normalizePunctuation(trimmed);
  if (P.timestamp.test(text)) return null;

  let m = text.match(P.insightDiscard);
  if (m) return { kind: 'discardAnonymous', player: normPlayer(m[1], me), count: Number(m[3]), reason: '洞察力效果' };

  m = text.match(P.huntKeep);
  if (m) return { kind: 'huntKeep', player: normPlayer(m[1], me), kept: resolveCards(splitNames(m[2])), discarded: resolveCards(splitNames(m[3])) };

  m = text.match(P.huntReveal);
  if (m) return { kind: 'huntReveal', player: normPlayer(m[1], me), cards: resolveCards(splitNames(m[2])) };

  m = text.match(P.insightDraw);
  if (m) return { kind: 'drawAnonymous', player: normPlayer(m[1], me), count: Number(m[2]), deck: 'main' };

  m = text.match(P.breakDiscard);
  if (m) return { kind: 'discardAnonymous', player: normPlayer(m[1], me), count: Number(m[2]), reason: '休息阶段' };

  m = text.match(P.effectDiscard);
  if (m) return { kind: 'discard', player: normPlayer(m[1], me), cards: resolveCards(splitNames(m[2])), reason: m[3] };

  m = text.match(P.drawAnon);
  if (m) return { kind: 'drawAnonymous', player: normPlayer(m[1], me), count: Number(m[2]), deck: m[3] ? 'scoring' : 'main' };

  m = text.match(P.drawNamed);
  if (m) return { kind: 'draw', player: normPlayer(m[1], me), cards: resolveCards(splitNames(m[2])), deck: m[3] ? 'scoring' : 'main' };

  m = text.match(P.discardAnon);
  if (m) return { kind: 'discardAnonymous', player: normPlayer(m[1], me), count: Number(m[2]) };

  m = text.match(P.discardPurpose);
  if (m) return { kind: 'discard', player: normPlayer(m[1], me), cards: resolveCards(splitNames(m[2])), reason: m[3] };

  m = text.match(P.discardNamed);
  if (m) return { kind: 'discard', player: normPlayer(m[1], me), cards: resolveCards(splitNames(m[2])) };

  m = text.match(P.displayRemove);
  if (m) return { kind: 'displayRemove', cards: resolveCards(splitNames(m[2])) };

  m = text.match(P.displayRefill);
  if (m) return { kind: 'displayRefill', cards: resolveCards(splitNames(m[1])) };

  m = text.match(P.buyDisplay);
  if (m) return { kind: 'playCard', player: normPlayer(m[1], me), card: resolveCards([m[3].trim()])[0], cost: Number(m[2]), destination: m[4].trim(), from: 'display' };

  m = text.match(P.takeDisplay);
  if (m) return { kind: 'takeDisplay', player: normPlayer(m[1], me), card: resolveCards([m[2].trim()])[0] };

  m = text.match(P.playPaid);
  if (m) return { kind: 'playCard', player: normPlayer(m[1], me), card: resolveCards([m[3].trim()])[0], cost: Number(m[2]), destination: m[4].trim(), from: 'hand' };

  m = text.match(P.playFree);
  if (m) return { kind: 'playCard', player: normPlayer(m[1], me), card: resolveCards([m[2].trim()])[0], from: 'hand' };

  m = text.match(P.build);
  if (m) return { kind: 'build', player: normPlayer(m[1], me), cost: Number(m[2]), structure: m[3].trim() };

  m = text.match(P.actionSelected);
  if (m) return { kind: 'actionSelected', player: normPlayer(m[1], me), strength: Number(m[2]), actionCard: m[3].trim() };

  m = text.match(P.actionPlaced);
  if (m) return { kind: 'actionPlaced', player: normPlayer(m[1], me), slot: Number(m[2]) };

  m = text.match(P.actionSet);
  if (m) return { kind: 'actionSet', player: normPlayer(m[1], me), raw: m[2].trim() };

  m = text.match(P.projectSupport);
  if (m) return { kind: 'projectSupport', player: normPlayer(m[1], me), project: m[2].trim() };

  if (NOTES.some((re) => re.test(text))) return { kind: 'note', text };

  m = text.match(P.gain);
  if (m) return { kind: 'gain', player: normPlayer(m[1], me), amount: m[2] ? Number(m[2]) : undefined, source: m[3] };

  return { kind: 'unknown', text };
}

export function parseLogText(log: string, me?: string): GameEvent[] {
  return log
    .split('\n')
    .map((l) => parseLogLine(l, me))
    .filter((e): e is GameEvent => e !== null);
}

/** 解析单条 DOM 日志条目:innerText 里的换行(BGA 会把数字拆行)先折叠成空格。 */
export function parseLogEntry(entryText: string, me?: string): GameEvent | null {
  return parseLogLine(entryText.replace(/\s+/g, ' '), me);
}

/** 从事件流开头回放,重建某一时刻的卡牌流向状态。 */
export interface ReplayState {
  /** 离开主牌库且身份已知的牌(弃牌堆、展示区进出的牌、打出的牌),按官方 id */
  consumedCardIds: string[];
  /** 我的手牌(已知区域),按官方 id */
  myHandCardIds: string[];
  /** 身份已知但在对手手牌里的牌(展示区被对手拿走、狩猎被对手保留等),按官方 id */
  knownHiddenCardIds: string[];
  /** 身份未知的移动计数(对手摸牌/弃牌只有数量) */
  anonymous: { drawn: Record<string, number>; discarded: Record<string, number> };
  /** 未解析的卡名(需要人工跟进) */
  unresolvedNames: string[];
}

export function replayEvents(events: GameEvent[]): ReplayState {
  const consumed = new Set<string>();
  // 手牌/已知隐藏牌用计数而非集合增删:日志可能是倒序(最新在前),计数与顺序无关
  const myHandCount = new Map<string, number>();
  const hiddenCount = new Map<string, number>();
  const drawn: Record<string, number> = {};
  const discardedAnon: Record<string, number> = {};
  const unresolved = new Set<string>();

  const bump = (map: Map<string, number>, id: string, delta: number): void => {
    map.set(id, (map.get(id) ?? 0) + delta);
  };

  const idsOf = (refs: CardRef[]): string[] => {
    const ids: string[] = [];
    for (const r of refs) {
      if (r.kind === 'resolved') ids.push(r.card.id);
      else unresolved.add(r.rawName);
    }
    return ids;
  };

  for (const e of events) {
    switch (e.kind) {
      case 'draw':
        if (e.deck === 'main' && e.player === 'me') idsOf(e.cards).forEach((id) => bump(myHandCount, id, 1));
        else idsOf(e.cards); // 仍要触发未解析告警
        break;
      case 'drawAnonymous':
        if (e.deck === 'main') drawn[e.player] = (drawn[e.player] ?? 0) + e.count;
        break;
      case 'discard': {
        const ids = idsOf(e.cards);
        ids.forEach((id) => {
          consumed.add(id);
          if (e.player === 'me') bump(myHandCount, id, -1);
          else bump(hiddenCount, id, -1);
        });
        break;
      }
      case 'discardAnonymous':
        discardedAnon[e.player] = (discardedAnon[e.player] ?? 0) + e.count;
        break;
      case 'displayRefill':
        idsOf(e.cards).forEach((id) => consumed.add(id));
        break;
      case 'displayRemove':
        idsOf(e.cards).forEach((id) => consumed.add(id)); // 已在 refill 时计入,幂等
        break;
      case 'playCard': {
        const id = idsOf([e.card])[0];
        if (id) {
          consumed.add(id);
          if (e.player === 'me') bump(myHandCount, id, -1);
          else bump(hiddenCount, id, -1);
        }
        break;
      }
      case 'takeDisplay': {
        const id = idsOf([e.card])[0];
        if (id) bump(e.player === 'me' ? myHandCount : hiddenCount, id, 1);
        break;
      }
      case 'huntReveal':
        idsOf(e.cards); // 仅触发未解析告警;归属由随后的 huntKeep 落定
        break;
      case 'huntKeep': {
        const kept = idsOf(e.kept);
        const disc = idsOf(e.discarded);
        kept.forEach((id) => bump(e.player === 'me' ? myHandCount : hiddenCount, id, 1));
        disc.forEach((id) => consumed.add(id));
        break;
      }
    }
  }

  const positive = (map: Map<string, number>): string[] =>
    [...map.entries()].filter(([, n]) => n > 0).map(([id]) => id);

  return {
    consumedCardIds: [...consumed],
    myHandCardIds: positive(myHandCount),
    knownHiddenCardIds: positive(hiddenCount),
    anonymous: { drawn, discarded: discardedAnon },
    unresolvedNames: [...unresolved],
  };
}
