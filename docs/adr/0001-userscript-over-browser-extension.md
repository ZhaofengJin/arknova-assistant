# 用油猴脚本（userscript）而非浏览器扩展作为载体

项目最初设想是浏览器插件。权衡后决定：以正规 TS 工程（Vite + vite-plugin-monkey）开发，构建产物为单个 userscript 文件，通过 Tampermonkey 安装使用。

理由：个人自用场景下，userscript 安装和更新零门槛、无扩展商店/权限审核心智负担、注入 BGA 页面 DOM 最直接；同时工程结构保持模块化，未来若要包装成 Chrome MV3 扩展，核心代码可以直接复用。

考虑过的替代方案：Chrome MV3 扩展（每次改动需手动重载，分发重）、独立网页手动录入（脱离页面，记牌失去意义）。
