# ArkNova Assistant(方舟助手)

BGA 方舟动物园(Ark Nova)记牌与打法建议浏览器脚本。**个人学习参考工具**,非官方产品,与 Board Game Arena 及 Ark Nova 出版方无关。

## 功能

- **记牌面板**:实时展示牌库剩余构成、弃牌堆、各玩家手牌数、展示区卡牌明细
- **打法建议**:根据当前局面(手牌、金钱、地图、行动卡强度)推荐下一手行动,并给出理由
- **日志解析**:自动读取 BGA 游戏日志,推算隐藏信息(牌库/手牌)
- **DOM 对账**:页面卡牌元素与日志推算状态互相校验,不一致时告警

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)(Chrome / Edge / Firefox 均可)
2. 点击安装:[arknova-assistant.user.js](https://raw.githubusercontent.com/ZhaofengJin/arknova-assistant/main/dist/arknova-assistant.user.js)
3. 打开 BGA 方舟动物园对局页面,右侧面板自动出现「方舟助手」

安装后脚本会自动检查更新(通过 `@updateURL`)。

## 开发

```bash
npm install
npm run build   # 产出 dist/arknova-assistant.user.js
npm run test    # vitest
npm run dev     # watch 模式
```

发布流程见 [docs/release.md](docs/release.md)。

## 项目结构

```
src/
  data/       卡牌与地图数据库(305 张官方卡牌 + 25 张地图)
  log/        BGA 游戏日志解析器
  tracker/    记牌核心:牌库/弃牌堆/手牌推算
  advisor/    建议引擎:局面评估、终局计分、行动推荐
  dom/        页面 DOM 对账
  ui/         面板 UI
  main.ts     入口
.scratch/arknova-assistant/issues/  工单(规格与进度追踪)
docs/adr/     架构决策记录
```

## 免责声明

仅供个人学习与研究使用。卡牌数据来自 BGA 游戏页面,版权归原作者与出版方所有。请勿用于任何违反 BGA 服务条款的用途。
