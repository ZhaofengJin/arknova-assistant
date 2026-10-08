#!/usr/bin/env python3
"""从 BGA 方舟动物园页面保存件中提取官方卡牌/地图数据,生成项目用的 JSON。

输入:保存的网页目录(含 cardsData.js 与 lang_arknova.js)
输出:src/data/cards.json —— 全部卡牌,官方字段原样保留 + 中文名 + 稳定 key
     src/data/maps.json  —— 地图数据(局面读取用,工单 07)

用法:python3 scripts/extract-card-data.py "<网页保存目录>"
注意:输入文件来自用户本地保存的 BGA 页面,仅供个人使用,不入库、不分发。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_js_json(path: Path, offset_pattern: str | None = None):
    """从 JS 文件中解码 JSON 对象;offset_pattern 指定从某个 key 开始(用于第二个常量)。"""
    raw = path.read_text(encoding='utf-8')
    start = raw.index(offset_pattern) + len(offset_pattern) if offset_pattern else raw.index('{')
    obj, _ = json.JSONDecoder().raw_decode(raw[start:])
    return obj


def main() -> None:
    src_dir = Path(sys.argv[1])
    cards_raw = (src_dir / 'cardsData.js').read_text(encoding='utf-8')
    dec = json.JSONDecoder()

    cards_data, end = dec.raw_decode(cards_raw[cards_raw.index('{'):])
    maps_marker = cards_raw.index('const MAPS_DATA = ')
    maps_data, _ = dec.raw_decode(cards_raw[maps_marker + len('const MAPS_DATA = '):])

    lang = load_js_json(src_dir / 'lang_arknova.js')

    out = []
    missing_zh = []
    for key, c in cards_data.items():
        name_en = c.get('name', '')
        name_zh = lang.get(name_en)
        if not name_zh:
            missing_zh.append(name_en)
        out.append({
            'id': key,                # 稳定 key,如 "A401_Cheetah"
            'number': c.get('number'),
            'type': c.get('type'),
            'supported': c.get('supported', []),
            'nameEn': name_en,
            'nameZh': name_zh or name_en,
            **{k: v for k, v in c.items() if k not in ('name', 'number', 'type', 'supported')},
        })

    (ROOT / 'src/data').mkdir(exist_ok=True)
    (ROOT / 'src/data/cards.json').write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    (ROOT / 'src/data/maps.json').write_text(
        json.dumps(maps_data, ensure_ascii=False, indent=1), encoding='utf-8')

    print(f'cards: {len(out)} 张 -> src/data/cards.json')
    print(f'maps: {len(maps_data)} 张 -> src/data/maps.json')
    print(f'缺中文名: {len(missing_zh)} 张')
    for n in missing_zh[:20]:
        print('  -', n)


if __name__ == '__main__':
    main()
