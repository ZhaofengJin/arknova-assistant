/** 卡牌数据库查询接口。数据来自 BGA 官方页面提取(见 scripts/extract-card-data.py),只读。 */

import cardsJson from './cards.json';

export interface Card {
  id: string;            // 稳定 key,如 "A401_Cheetah"
  number: number;        // 官方卡牌编号
  type: 'animal' | 'sponsor' | 'baseProject' | 'project' | 'scoring';
  supported: string[];   // "bg"=基础版, "mw"=海洋世界
  nameEn: string;
  nameZh: string;
  [key: string]: unknown; // 官方字段原样透传(cost/appeal/ability 等)
}

export const CARDS: readonly Card[] = cardsJson as Card[];

const byId = new Map(CARDS.map((c) => [c.id, c]));
const byNameZh = new Map(CARDS.map((c) => [c.nameZh, c]));
const byNameEn = new Map(CARDS.map((c) => [c.nameEn, c]));

/** 按稳定 id 查询,如 "A401_Cheetah"。 */
export function cardById(id: string): Card | undefined {
  return byId.get(id);
}

/** 按界面显示名查询(中文界面传中文名,英文界面传英文名),日志/DOM 解析的入口。 */
export function cardByDisplayName(name: string): Card | undefined {
  return byNameZh.get(name) ?? byNameEn.get(name);
}

/** 主牌库(动物+赞助商+保护项目),终局计分卡不在其中。 */
export function mainDeckCards(mode: 'bg' | 'mw'): Card[] {
  return CARDS.filter(
    (c) => c.type !== 'scoring' && c.supported.includes(mode),
  );
}
