/** 面板组合视图:建议 → 手牌评分 → 展示区评分 → 记牌 → 权重调节。
 *  所有动态文本转义,防日志内容注入。权重滑杆用事件委托,innerHTML 重渲染不丢监听。
 */

import type { Advice } from '../advisor/advisor';
import type { ScoredCard, Weights } from '../advisor/scoring';
import type { ReconcileIssue } from '../dom/reconcile';
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
}

const MEDALS = ['🥇', '🥈', '🥉'];

function renderIssues(issues: ReconcileIssue[]): string {
  if (issues.length === 0) return '';
  const rows = issues.map((i) => `<li>${esc(i.message)}</li>`).join('');
  return `<div class="ana-section ana-alert-title">⚠️ 对账告警</div><ul class="ana-issues">${rows}</ul>`;
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
    renderAdvice(data.advice),
    renderScored('手牌评分', data.handScored, 5),
    renderScored('展示区评分', data.displayScored, 5),
    '<div class="ana-section">记牌</div>',
    renderTracker(data.tracker),
    renderWeights(data.weights),
  ].join('');
}
