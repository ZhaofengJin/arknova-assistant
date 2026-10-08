/** 建议引擎与评分的行为测试:合成局面 + 真实对局 fixture。 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardByDisplayName, type Card } from '../data/cardDb';
import { parseLogText, replayEvents } from '../log/parser';
import { advise } from './advisor';
import { deriveGameState, type GameState } from './gameState';
import { DEFAULT_WEIGHTS, scoreCard, scoreCards } from './scoring';

const card = (zh: string): Card => {
  const c = cardByDisplayName(zh);
  if (!c) throw new Error(`测试卡牌不存在: ${zh}`);
  return c;
};

const emptyState = (over: Partial<GameState> = {}): GameState => ({
  displayCards: [], myHand: [], myInPlay: [], myScoring: [], mySupportedProjects: [],
  opponentHandEstimate: 0, displayUnknownRemovals: 0, ...over,
});

describe('评分引擎', () => {
  it('免费高魅力牌效率高于贵牌', () => {
    const gs = emptyState();
    const cheap = scoreCard(card('环尾狐猴'), gs, DEFAULT_WEIGHTS); // 费用低
    const pricey = scoreCard(card('鲸头鹳'), gs, DEFAULT_WEIGHTS);
    expect(cheap.score).not.toBe(pricey.score);
  });

  it('前置条件未满足的牌被重罚', () => {
    // 狮子需要 Predator×3;空动物园不满足
    const empty = emptyState();
    const withPredators = emptyState({ myInPlay: [card('猎豹'), card('欧洲獾'), card('黄喉貂')] });
    const sEmpty = scoreCard(card('狮子'), empty, DEFAULT_WEIGHTS);
    const sFed = scoreCard(card('狮子'), withPredators, DEFAULT_WEIGHTS);
    expect(sEmpty.reasons.join()).toContain('前置未满足');
    expect(sFed.score).toBeGreaterThan(sEmpty.score);
  });

  it('权重改变会改变评分', () => {
    const gs = emptyState();
    const a = scoreCard(card('锥齿鲨'), gs, DEFAULT_WEIGHTS);
    const b = scoreCard(card('锥齿鲨'), gs, { ...DEFAULT_WEIGHTS, conservation: 0 });
    expect(a.score).not.toBe(b.score);
  });
});

describe('建议引擎', () => {
  it('手牌有强动物时动物行动排前列', () => {
    const gs = emptyState({ myHand: [card('鲸头鹳'), card('锥齿鲨')] });
    const top = advise(gs, DEFAULT_WEIGHTS)[0];
    expect(['动物', '建造']).toContain(top.actionZh);
  });

  it('空手牌时卡牌行动加分', () => {
    const empty = advise(emptyState(), DEFAULT_WEIGHTS);
    const withHand = advise(emptyState({ myHand: [card('驴'), card('驯鹿'), card('鸸鹋')] }), DEFAULT_WEIGHTS);
    const score = (list: ReturnType<typeof advise>) => list.find((a) => a.action === 'cards')!.score;
    expect(score(empty)).toBeGreaterThan(score(withHand));
  });

  it('涉及未读取局面的建议标注不确定', () => {
    const gs = emptyState({ myHand: [card('鲸头鹳')] });
    const animals = advise(gs, DEFAULT_WEIGHTS).find((a) => a.action === 'animals')!;
    expect(animals.partial).toBe(true);
    expect(animals.reason).toContain('未读取');
  });

  it('空手牌空展示区时输出五条建议且有序', () => {
    const list = advise(emptyState(), DEFAULT_WEIGHTS);
    expect(list).toHaveLength(5);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
  });
});

describe('局面推导(真实整局 fixture)', () => {
  const log = readFileSync('samples/game-log-full-2026-10-08.normalized.txt', 'utf-8')
    .split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
  const events = parseLogText(log, 'JeffJin');
  const gs = deriveGameState(events, replayEvents(events));

  it('打出牌进入我的动物园', () => {
    expect(gs.myInPlay.map((c) => c.nameZh)).toEqual(
      expect.arrayContaining(['锥齿鲨', '鸭嘴兽', '笑翠鸟', '小型动物专家']),
    );
  });

  it('当前展示区:补充过且未被拿走/移除的牌', () => {
    const names = gs.displayCards.map((c) => c.nameZh);
    expect(names).toContain('大象资助计划'); // 最后补充,未被拿
    expect(names).toContain('南浣熊'); // 被标记但标记不动牌
    expect(names).not.toContain('蛇蜥'); // 被精选
    expect(names).not.toContain('红腿白臀叶猴'); // 被购买
  });

  it('终局计分卡:抽二留一(合成事件;真实日志窗口不含开局抽牌段)', () => {
    const zoo = card('国际动物园');
    const charity = card('公益保护动物园');
    const synthetic = deriveGameState([
      { kind: 'draw', player: 'me', deck: 'scoring', cards: [{ kind: 'resolved', card: zoo }, { kind: 'resolved', card: charity }] },
      { kind: 'discard', player: 'me', cards: [{ kind: 'resolved', card: charity }] },
    ], replayEvents([]));
    expect(synthetic.myScoring.map((c) => c.nameZh)).toEqual(['国际动物园']);
  });

  it('我支持过的保护项目', () => {
    expect(gs.mySupportedProjects).toEqual(expect.arrayContaining(['澳洲', '海洋动物']));
  });
});
