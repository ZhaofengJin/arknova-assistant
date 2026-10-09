/** ArkNova Assistant 入口:仅在方舟动物园对局页面注入面板,接日志 → 记牌 + 建议 → 渲染。 */

import './panel.css';
import { advise } from './advisor/advisor';
import { deriveGameState } from './advisor/gameState';
import { scoreCards } from './advisor/scoring';
import { readDomSnapshot, reconcile } from './dom/reconcile';
import { parseLogEntry, replayEvents, type GameEvent } from './log/parser';
import { mountPanel } from './panel';
import { loadWeights, saveWeights, type Weights } from './storage';
import { trackJourneys } from './tracker/journey';
import { computeTracker } from './tracker/tracker';
import { renderPanel } from './ui/panelView';

function isArknovaTablePage(loc: Location = window.location, doc: Document = document): boolean {
  if (!/(^|\.)boardgamearena\.com$/.test(loc.hostname)) return false;
  if (loc.pathname.includes('arknova')) return true;
  // /tableview?table=ID 地址不含游戏名,需看页面内容识别
  if (loc.pathname.startsWith('/tableview')) {
    return doc.title.includes('Ark Nova') || doc.title.includes('方舟动物园');
  }
  return false;
}

/** BGA 日志条目:id 形如 log_N,聊天窗口里的 dockedlog_N 是副本必须排除。
 *  不按容器找(#logs 只存在于经典布局,新布局容器未知),全局按条目 id 前缀找。 */
function findLogEntries(doc: Document): HTMLElement[] {
  const byId = [...doc.querySelectorAll<HTMLElement>('.log[id^="log_"]')];
  if (byId.length > 0) return byId;
  // 兜底:经典布局容器(某些快照里条目无 id 前缀也能读)
  const root = doc.querySelector('#logs') ?? doc.querySelector('.log_history');
  return root ? [...root.querySelectorAll<HTMLElement>('.log')] : [];
}

/** 本人用户名:优先页面菜单的 .bga-username,兜底内联脚本里的 globalUserInfos。 */
function getMyName(doc: Document): string | undefined {
  const fromMenu = doc.querySelector('.bga-username')?.textContent?.trim();
  if (fromMenu) return fromMenu;
  const m = doc.documentElement.innerHTML.match(/globalUserInfos=\{[^}]*"name":"([^"]+)"/);
  return m?.[1];
}

function readEvents(entries: HTMLElement[], me?: string): GameEvent[] {
  // 按日志 id 升序(时间正序)排列:履历记牌与展示区盲区判定都依赖顺序
  const num = (el: HTMLElement): number => Number(/^log_(\d+)$/.exec(el.id)?.[1] ?? 0);
  const sorted = [...entries].sort((a, b) => num(a) - num(b));
  return sorted
    .map((el) => parseLogEntry(el.innerText ?? el.textContent ?? '', me))
    .filter((e): e is GameEvent => e !== null);
}

function start(): void {
  const panel = mountPanel();
  if (!panel) return;

  const myName = getMyName(document);
  let weights: Weights = loadWeights(window.localStorage);

  const refresh = (): void => {
    const entries = findLogEntries(document);
    if (entries.length === 0) {
      panel.update('<div class="ana-warn">未读到任何日志条目(BGA 布局可能已改版,或游戏尚未开始)</div>');
      return;
    }
    const events = readEvents(entries, myName);
    const unknownCount = events.filter((e) => e.kind === 'unknown').length;
    const replay = replayEvents(events);
    const gs = deriveGameState(events, replay);
    const tracker = computeTracker(replay, 'mw');
    const issues = reconcile(readDomSnapshot(document), {
      displayIds: gs.displayCards.map((c) => c.id),
      deckEstimate: tracker.deckEstimate,
      discardEstimate: replay.discardPileCount,
      displayBlindSpot: gs.displayUnknownRemovals,
    });
    // 诊断行:排查布局改版时让用户截图这一行即可
    const logStatus = `日志 ${entries.length} 条 → 事件 ${events.length}(未知 ${unknownCount})`;
    console.info('[ArkNova Assistant]', logStatus);
    // 对手手牌猜测:未知池中在牌库概率最低的牌,最可能被摸走
    const handGuess =
      tracker.opponentHandEstimate > 0
        ? [...tracker.entries]
            .sort((a, b) => a.deckProbability - b.deckProbability)
            .filter((e) => e.deckProbability < 1)
            .slice(0, 5)
            .map((e) => ({ name: e.card.nameZh, probability: 1 - e.deckProbability }))
        : [];
    panel.update(renderPanel({
      advice: advise(gs, weights),
      handScored: scoreCards(gs.myHand, gs, weights),
      displayScored: scoreCards(gs.displayCards, gs, weights),
      tracker,
      weights,
      issues,
      logStatus,
      journeys: trackJourneys(events),
      handGuess,
    }));
  };

  // 权重滑杆:事件委托挂在 body 上,innerHTML 重渲染不影响
  panel.body.addEventListener('input', (ev) => {
    const input = ev.target as HTMLInputElement;
    const key = input.dataset?.weight as keyof Weights | undefined;
    if (!key) return;
    weights = { ...weights, [key]: Number(input.value) };
    saveWeights(window.localStorage, weights);
    refresh();
  });

  // 日志条目可能晚于脚本加载出现,先轮询找到为止;
  // 之后观察整个 body 的 .log 增删(不依赖具体容器,兼容布局改版)
  const tryAttach = (): void => {
    if (findLogEntries(document).length === 0) {
      setTimeout(tryAttach, 1000);
      return;
    }
    refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const touchesLog = (muts: MutationRecord[]): boolean =>
      muts.some((m) =>
        [...m.addedNodes, ...m.removedNodes].some(
          (n) =>
            n instanceof HTMLElement &&
            (n.classList?.contains('log') || n.querySelector?.('.log') !== null),
        ),
      );
    new MutationObserver((muts) => {
      if (!touchesLog(muts)) return;
      clearTimeout(timer);
      timer = setTimeout(refresh, 300); // 防抖:一波日志更新只重算一次
    }).observe(document.body, { childList: true, subtree: true });
  };
  tryAttach();
}

if (isArknovaTablePage()) {
  start();
}
