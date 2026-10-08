/** T1 地图局日志(2026-10-08 晚,节选 47 行):覆盖狩猎计牌变体、蛙潜、地图效果弃牌等新模式。
 *  这些模式直接影响弃牌堆/匿名手牌推算精度,进而决定 DOM 对账(工单 05)是否误报。
 */

import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { parseLogEntry, replayEvents, type GameEvent } from './parser';

const lines = readFileSync('samples/game-log-2026-10-08-t1.txt', 'utf8').split('\n').filter(Boolean);
const events = lines
  .map((l) => parseLogEntry(l, 'JeffJin'))
  .filter((e): e is GameEvent => e !== null);
const state = replayEvents(events);

describe('T1 局日志:解析覆盖', () => {
  it('没有无法识别的行', () => {
    expect(events.filter((e) => e.kind === 'unknown')).toEqual([]);
  });

  it('没有未解析的卡名', () => {
    expect(state.unresolvedNames).toEqual([]);
  });
});

describe('T1 局日志:新模式事件', () => {
  it('地图 T1 效果弃牌 → 匿名弃牌 1 张', () => {
    const m = events.find((e) => e.kind === 'discardAnonymous' && 'reason' in e && e.reason === '地图效果');
    expect(m).toMatchObject({ player: 'ThePerty', count: 1 });
  });

  it('狩猎保留计牌变体:保留实名(秃鹳)进已知隐藏区,弃 2 张匿名', () => {
    const hunt = events.find((e) => e.kind === 'huntKeep' && 'fromAnonymousDraw' in e && e.fromAnonymousDraw);
    expect(hunt).toMatchObject({ player: 'ThePerty', discardedCount: 2 });
    expect(state.knownHiddenCardIds).toContain('A496_Marabou'); // 秃鹳
  });

  it('狩猎抽取 3 张 → 匿名摸牌,但保留的 1 张已转为已知不计入手牌估计', () => {
    expect(state.anonymous.drawn['ThePerty']).toBe(2); // 3 - 1(秃鹳转已知)
    expect(state.anonymous.discarded['ThePerty']).toBe(3); // T1 弃 1 + 狩猎弃 2
  });

  it('蛙潜:保留的海龟水族箱进我的手牌,弃除的 7 张离开我的手牌', () => {
    const scuba = events.find(
      (e) => e.kind === 'huntKeep' && e.player === 'me',
    );
    expect(scuba).toBeDefined();
    expect(state.myHandCardIds).not.toContain('A461_HorsfieldsTarsier'); // 邦加跗猴已弃
    // 弃牌堆推算 = 蛙潜 7 + T1 弃 1 + 狩猎弃 2
    expect(state.discardPileCount).toBe(10);
  });

  it('Venom 指示物弃除不进入弃牌堆计数', () => {
    // 若被误当卡牌弃除,discardPileCount 会 > 10
    expect(state.discardPileCount).toBe(10);
  });

  it('支持保护项目第二格(序号不再只认第一格)', () => {
    const support = events.find((e) => e.kind === 'projectSupport');
    expect(support).toMatchObject({ player: 'ThePerty', project: '欧洲' });
  });
});
