/** 卡牌数据库完整性校验:数量、必填字段、key 唯一、中文名覆盖、日志样本可反查。 */

import { describe, expect, it } from 'vitest';
import { CARDS, cardByDisplayName, cardById, mainDeckCards } from './cardDb';

describe('卡牌数据库完整性', () => {
  it('共 305 张,各类型数量符合官方构成', () => {
    expect(CARDS).toHaveLength(305);
    const count = (t: string) => CARDS.filter((c) => c.type === t).length;
    expect(count('animal')).toBe(160);
    expect(count('sponsor')).toBe(82);
    expect(count('baseProject')).toBe(13);
    expect(count('project')).toBe(27);
    expect(count('scoring')).toBe(23);
  });

  it('id 唯一(官方编号在基础版/海洋世界变体间会重复,不能当 key)', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    // 已知:8 张牌存在 bg/mw 双变体共享编号,如 F005_ConservationZoo 与 F005_ConservationZoo_MW
    const dupNumbers = CARDS.length - new Set(CARDS.map((c) => `${c.type}:${c.number}`)).size;
    expect(dupNumbers).toBe(8);
  });

  it('每张牌必填字段完整,且都有中文名', () => {
    for (const c of CARDS) {
      expect(c.id).toBeTruthy();
      expect(c.type).toBeTruthy();
      expect(c.nameEn).toBeTruthy();
      expect(c.nameZh).toBeTruthy();
      expect(c.supported.length).toBeGreaterThan(0);
    }
  });

  it('真实日志中的中文名可反查到卡牌', () => {
    // 取自 2026-10-08 对局日志样本(samples/game-log-2026-10-08.txt)
    // 注:"小型海洋馆"是建造行动里的饲养区设施而非卡牌,不在此列
    const fromLog = ['欧洲海马', '斑鬣狗围场', '发言人', '环尾狐猴', '黄喉貂', '澳洲野犬',
      '儿童游乐园', '欧洲泽龟', '亚洲貘', '空中索道', '王鹫', '西伯利亚虎',
      '倭河马', '本地蜥蜴', '国际动物园', '公益保护动物园', '锥齿鲨'];
    for (const zh of fromLog) {
      expect(cardByDisplayName(zh), zh).toBeDefined();
    }
    expect(cardByDisplayName('发言人')?.nameEn).toBe('Spokesperson');
  });

  it('按 id 查询', () => {
    expect(cardById('A401_Cheetah')?.nameZh).toBeTruthy();
    expect(cardById('nonexistent')).toBeUndefined();
  });

  it('主牌库不含终局计分卡,且海洋世界模式牌数更多', () => {
    const bg = mainDeckCards('bg');
    const mw = mainDeckCards('mw');
    expect(bg.every((c) => c.type !== 'scoring')).toBe(true);
    expect(mw.length).toBeGreaterThan(bg.length);
  });
});
