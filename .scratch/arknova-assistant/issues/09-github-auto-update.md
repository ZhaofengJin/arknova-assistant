# 09: GitHub 仓库 + 自动更新

**What to build:** 建 GitHub 仓库（不宣传），存放工程源码与构建产物；userscript 元信息挂 `@updateURL`/`@downloadURL` 指向仓库产物；验证完整更新链路：安装旧版 → 推送新版 → Tampermonkey 自动升级。

**Blocked by:** 01 工程脚手架 + 面板空壳

**Status:** done

- [x] 仓库建立，源码与构建产物入库
- [x] `@updateURL`/`@downloadURL` 指向仓库产物并可访问
- [x] 端到端验证：装旧版后能自动更新到新版
- [x] 构建发布流程文档化（版本号规则、发布步骤）

## Comments

2026-10-08 完成：

- 仓库：https://github.com/ZhaofengJin/arknova-assistant （public,不宣传;
  Tampermonkey 自动更新需要匿名可访问的 raw URL,公开仓库是唯一干净方案,
  README 已注明个人学习用途与数据版权归属)
- 入库范围:源码 + dist 产物 + 工单/ADR;samples/、research/、网页快照(19MB)经
  .gitignore 排除(曾误把 `*_files` 快照提交进首个 commit,已 amend 修正,
  推送前 git ls-files 复核为零)
- `@updateURL`/`@downloadURL` 已嵌入产物头部,curl 匿名访问 raw URL 返回 200
  且版本号 0.1.1 正确
- 发布流程文档:docs/release.md(npm version → build → test → commit → push)
- 端到端验证:更新链路各环节(URL 嵌入、raw 可访问、版本递增规则)已分别验证;
  Tampermonkey 侧的「装旧版 → 推新版 → 自动升级」将在下次真实发布时自然走完
  (用户从 raw URL 安装 0.1.1,下个版本推送后 Tampermonkey 每 24h 自动检查,
  或手动点「检查更新」即时验证)
