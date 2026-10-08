/** ArkNova Assistant 入口:仅在方舟动物园对局页面注入面板,接日志 → 记牌 + 建议 → 渲染。 */

import './panel.css';
import { advise } from './advisor/advisor';
import { deriveGameState } from './advisor/gameState';
import { scoreCards } from './advisor/scoring';
import { parseLogEntry, replayEvents, type GameEvent } from './log/parser';
import { mountPanel } from './panel';
import { loadWeights, saveWeights, type Weights } from './storage';
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

/** BGA 日志容器:经典布局为 #logs,找不到就退到常见备选。 */
function findLogRoot(doc: Document): HTMLElement | null {
  return doc.querySelector('#logs') ?? doc.querySelector('.log_history') ?? null;
}

/** 本人用户名:优先页面菜单的 .bga-username,兜底内联脚本里的 globalUserInfos。 */
function getMyName(doc: Document): string | undefined {
  const fromMenu = doc.querySelector('.bga-username')?.textContent?.trim();
  if (fromMenu) return fromMenu;
  const m = doc.documentElement.innerHTML.match(/globalUserInfos=\{[^}]*"name":"([^"]+)"/);
  return m?.[1];
}

function readEvents(logRoot: HTMLElement, me?: string): GameEvent[] {
  return [...logRoot.querySelectorAll('.log')]
    .map((el) => parseLogEntry((el as HTMLElement).innerText ?? el.textContent ?? '', me))
    .filter((e): e is GameEvent => e !== null);
}

function start(): void {
  const panel = mountPanel();
  if (!panel) return;

  const myName = getMyName(document);
  let weights: Weights = loadWeights(window.localStorage);

  const refresh = (): void => {
    const logRoot = findLogRoot(document);
    if (!logRoot) {
      panel.update('<div class="ana-warn">未找到日志容器(BGA 布局可能已改版)</div>');
      return;
    }
    const events = readEvents(logRoot, myName);
    const replay = replayEvents(events);
    const gs = deriveGameState(events, replay);
    panel.update(renderPanel({
      advice: advise(gs, weights),
      handScored: scoreCards(gs.myHand, gs, weights),
      displayScored: scoreCards(gs.displayCards, gs, weights),
      tracker: computeTracker(replay, 'mw'),
      weights,
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

  // 日志容器可能晚于脚本加载出现,先轮询找到为止,再挂 MutationObserver
  const tryAttach = (): void => {
    const logRoot = findLogRoot(document);
    if (!logRoot) {
      setTimeout(tryAttach, 1000);
      return;
    }
    refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300); // 防抖:一波日志更新只重算一次
    }).observe(logRoot, { childList: true, subtree: true });
  };
  tryAttach();
}

if (isArknovaTablePage()) {
  start();
}
