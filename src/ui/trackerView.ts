/** 记牌面板的渲染:TrackerView → HTML 字符串。所有动态文本转义,防日志内容注入。 */

import type { TrackerView } from '../tracker/tracker';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

const TYPE_LABEL: Record<string, string> = {
  animal: '动物',
  sponsor: '赞助商',
  baseProject: '基础保护项目',
  project: '保护项目',
};

const TOP_N = 15;

export function renderTracker(view: TrackerView): string {
  const byType = new Map<string, number>();
  for (const e of view.entries) {
    byType.set(e.card.type, (byType.get(e.card.type) ?? 0) + e.unknownCopies);
  }
  const typeSummary = [...byType.entries()]
    .map(([t, n]) => `${TYPE_LABEL[t] ?? t} ${n}`)
    .join(' · ');

  const top = view.entries.slice(0, TOP_N).map((e, i) => {
    const pct = Math.round(e.deckProbability * 100);
    return `<li><span class="ana-rank">${i + 1}.</span> ${esc(e.card.nameZh)} <span class="ana-en">${esc(e.card.nameEn)}</span> <span class="ana-pct">${pct}%</span></li>`;
  }).join('');

  const warnings = view.unresolvedNames.length
    ? `<div class="ana-warn">未识别卡名:${view.unresolvedNames.map(esc).join('、')}</div>`
    : '';

  return `
<div class="ana-summary">牌库估计 <b>${view.deckEstimate}</b> 张 · 未知池 ${view.unknownTotal} · 对手手牌≈${view.opponentHandEstimate}</div>
<div class="ana-types">${esc(typeSummary)}</div>
<div class="ana-section">仍在牌库概率 Top ${TOP_N}</div>
<ol class="ana-top">${top}</ol>
${warnings}`;
}
