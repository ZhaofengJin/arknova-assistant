/** 真实页面快照回归:从保存的 BGA 对局 HTML 中模拟脚本的 DOM 读取路径
 *  (找 .log[id^="log_"] 条目 → 提取文本 → 解析),验证 innerText 级别的真实标记
 *  (playername 嵌套 span、图标 div、PNS 注释)不会破坏解析。
 *  快照:zpdleld 三人局,126 条日志条目。
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLogEntry, replayEvents, type GameEvent } from './parser';

const SNAPSHOT =
  'zpdleld必须确认或者重新开始他的回合 • 方舟动物园 • Board Game Arena_files/arknova.html';

/** 模拟 innerText:剥掉标签与注释,图标 div 内本无文字,块级边界折叠为空格 */
function extractEntryTexts(html: string): string[] {
  const starts = [...html.matchAll(/<div class="log[^"]*" id="log_\d+"/g)].map((m) => m.index!);
  const texts: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : html.indexOf('id="seemorelogs"', starts[i]);
    const chunk = html.slice(starts[i], end > 0 ? end : starts[i] + 3000);
    const text = chunk
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (text) texts.push(text);
  }
  return texts;
}

const html = readFileSync(SNAPSHOT, 'utf8');
const texts = extractEntryTexts(html);
const events = texts
  .map((t) => parseLogEntry(t, 'JeffJin'))
  .filter((e): e is GameEvent => e !== null);

describe('真实页面快照:DOM 读取路径', () => {
  it('能提取到日志条目(快照含 126 条)', () => {
    expect(texts.length).toBeGreaterThanOrEqual(120);
  });

  it('除 BGA 提示框外没有无法识别的条目', () => {
    const unknown = events.filter((e) => e.kind === 'unknown');
    for (const u of unknown) console.log('unknown:', (u as { text: string }).text);
    // 唯一允许的 unknown 是「你知道吗」提示框
    expect(unknown.length).toBeLessThanOrEqual(1);
  });

  it('没有未解析的卡名', () => {
    expect(replayEvents(events).unresolvedNames).toEqual([]);
  });

  it('图标 div 不破坏行动卡与获得类模式', () => {
    expect(events.some((e) => e.kind === 'actionPlaced')).toBe(true);
    expect(events.some((e) => e.kind === 'gain')).toBe(true);
    expect(events.some((e) => e.kind === 'playCard')).toBe(true);
  });
});
