# 01: 工程脚手架 + 面板空壳

**What to build:** 建立 TS + Vite + vite-plugin-monkey 工程，构建出单个 `.user.js` 产物；安装到 Tampermonkey 后，打开 BGA 方舟动物园对局页面时注入一个可折叠、可拖动的悬浮面板空壳（暂无数据内容）。端到端可验证：脚本能装、面板能出现、能折叠拖动，位置状态持久化。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 工程可一键构建出 `.user.js`，含正确的 userscript 元信息（match BGA 对局页面）
- [x] 面板在对局页面注入成功，可折叠、可拖动(2026-10-08 用户实测截图确认,tableview 地址正常注入)
- [x] 面板位置与折叠状态存 localStorage，刷新后恢复（有单元测试覆盖读写）
- [x] Vitest 测试管线跑通（storage 5 个测试全过）

## Comments

2026-10-08 开工记录:脚手架完成,`npm run build` 产出 dist/arknova-assistant.user.js(4.88 kB),`npx vitest run` 5/5 通过。剩余验收项需在真实 BGA 对局页面手动目检:Tampermonkey 安装 dist 产物后打开对局页确认面板出现。
