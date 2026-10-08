# 09: GitHub 仓库 + 自动更新

**What to build:** 建 GitHub 仓库（不宣传），存放工程源码与构建产物；userscript 元信息挂 `@updateURL`/`@downloadURL` 指向仓库产物；验证完整更新链路：安装旧版 → 推送新版 → Tampermonkey 自动升级。

**Blocked by:** 01 工程脚手架 + 面板空壳

**Status:** ready-for-agent

- [ ] 仓库建立，源码与构建产物入库
- [ ] `@updateURL`/`@downloadURL` 指向仓库产物并可访问
- [ ] 端到端验证：装旧版后能自动更新到新版
- [ ] 构建发布流程文档化（版本号规则、发布步骤）
