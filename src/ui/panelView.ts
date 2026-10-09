/** 面板组合视图:建议 → 手牌评分 → 展示区评分 → 记牌 → 权重调节。
 *  所有动态文本转义,防日志内容注入。权重滑杆用事件委托,innerHTML 重渲染不丢监听。
 */

import type { Advice } from '../advisor/advisor';
import type { ScoredCard, Weights } from '../advisor/scoring';
import type { ReconcileIssue } from '../dom/reconcile';
import type { PlayerJourney } from '../tracker/journey';
import type { TrackerView } from '../tracker/tracker';
import { renderTracker } from './trackerView';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

export interface PanelData {
  advice: Advice[];
  handScored: ScoredCard[];
  displayScored: ScoredCard[];
  tracker: TrackerView;
  weights: Weights;
  /** DOM 对账告警(无告警时传空数组) */
  issues: ReconcileIssue[];
  /** 诊断行:日志条目/事件计数,排查布局问题时让用户截图此行 */
  logStatus: string;
  /** 逐牌履历:每个玩家已知牌的来源与去向 */
  journeys: PlayerJourney[];
  /** 对手手牌猜测:未知池中最可能被摸走的牌 */
  handGuess: { name: string; probability: number }[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

function renderIssues(issues: ReconcileIssue[]): string {
  if (issues.length === 0) return '';
  const rows = issues.map((i) => `<li>${esc(i.message)}</li>`).join('');
  return `<div class="ana-section ana-alert-title">⚠️ 对账告警</div><ul class="ana-issues">${rows}</ul>`;
}

/** 逐牌履历:每个玩家的已知手牌(带来源)、已使用、已丢弃 */
function renderJourneys(journeys: PlayerJourney[], guess: { name: string; probability: number }[]): string {
  if (journeys.length === 0) return '';
  const cardList = (entries: PlayerJourney['knownHand'], cls: string): string =>
    entries
      .map((e) => `<span class="ana-card ${cls}">${esc(e.card.nameZh)}<i>${e.source}</i></span>`)
      .join('');

  const blocks = journeys.map((j) => {
    const name = j.player === 'me' ? '我' : esc(String(j.player));
    const handTotal = j.knownHand.length + j.anonymousHand;
    const summaryParts = [`手牌 ${handTotal}`];
    if (j.anonymousHand > 0) summaryParts.push(`其中未知 ${j.anonymousHand}`);
    if (j.anonymousScoring > 0) summaryParts.push(`终局计分 ${j.anonymousScoring}`);
    if (j.played.length > 0) summaryParts.push(`已用 ${j.played.length}`);
    if (j.discarded.length > 0) summaryParts.push(`已弃 ${j.discarded.length}`);

    const lines: string[] = [];
    if (j.knownHand.length > 0) lines.push(`<div class="ana-prow">在手 ${cardList(j.knownHand, 'ana-hand')}</div>`);
    if (j.played.length > 0) lines.push(`<div class="ana-prow">已用 ${cardList(j.played, 'ana-played')}</div>`);
    if (j.discarded.length > 0) lines.push(`<div class="ana-prow">已弃 ${cardList(j.discarded, 'ana-gone')}</div>`);
    if (lines.length === 0) lines.push('<div class="ana-prow ana-dim">尚无已知身份的牌</div>');

    return `<details class="ana-player" ${j.player === 'me' ? 'open' : ''}>
      <summary><b>${name}</b> <span class="ana-dim">${summaryParts.join(' · ')}</span></summary>
      ${lines.join('')}
    </details>`;
  });

  const guessHtml =
    guess.length > 0
      ? `<div class="ana-prow ana-guess">对手可能持有:${guess
          .map((g) => `${esc(g.name)} ${Math.round(g.probability * 100)}%`)
          .join(' · ')}</div>`
      : '';

  return `<div class="ana-section">玩家手牌</div>${blocks.join('')}${guessHtml}`;
}

function renderAdvice(advice: Advice[]): string {
  const rows = advice.map((a, i) => `
    <li>
      <span class="ana-rank">${MEDALS[i] ?? `${i + 1}.`}</span>
      <b>${esc(a.actionZh)}</b> <span class="ana-pct">${a.score}</span>${a.partial ? ' <span class="ana-partial" title="有局面信息未读取">⚠️</span>' : ''}
      <div class="ana-reason">${esc(a.reason)}</div>
    </li>`).join('');
  return `<div class="ana-section">建议下一手</div><ol class="ana-top ana-advice">${rows}</ol>`;
}

function renderScored(title: string, scored: ScoredCard[], limit: number): string {
  if (scored.length === 0) return '';
  const rows = scored.slice(0, limit).map((s) => `
    <li>
      ${esc(s.card.nameZh)} <span class="ana-pct">${s.score}</span>
      <div class="ana-reason">${esc(s.reasons.join(';'))}</div>
    </li>`).join('');
  return `<div class="ana-section">${esc(title)}</div><ol class="ana-top">${rows}</ol>`;
}

function renderWeights(w: Weights): string {
  const slider = (key: keyof Weights, label: string): string => `
    <label class="ana-weight">${label}
      <input type="range" min="0" max="10" step="1" value="${w[key]}" data-weight="${key}">
      <span>${w[key]}</span>
    </label>`;
  return `<details class="ana-weights"><summary>评分权重</summary>
    ${slider('synergy', '协同')}${slider('efficiency', '效率')}${slider('conservation', '保护点')}
  </details>`;
}

export function renderPanel(data: PanelData): string {
  return [
    renderIssues(data.issues),
    renderJourneys(data.journeys, data.handGuess),
    renderAdvice(data.advice),
    renderScored('手牌评分', data.handScored, 5),
    renderScored('展示区评分', data.displayScored, 5),
    '<div class="ana-section">记牌</div>',
    renderTracker(data.tracker),
    renderWeights(data.weights),
    `<div class="ana-status">${esc(data.logStatus)}</div>`,
  ].join('');
}
