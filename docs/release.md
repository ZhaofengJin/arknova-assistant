# 发布流程

Tampermonkey 通过 userscript 头部的 `@updateURL` / `@downloadURL` 定期检查更新,
两者都指向本仓库 `main` 分支上的 `dist/arknova-assistant.user.js`(raw URL)。

## 发布步骤

```bash
# 1. 改版本号(userscript 版本取自 package.json)
npm version patch   # 或 minor / major

# 2. 重新构建(dist/ 入库,是自动更新的载体)
npm run build

# 3. 跑测试
npm run test

# 4. 提交并推送
git add -A
git commit -m "release: v$(node -p require('./package.json').version)"
git push origin main
```

推送后,Tampermonkey 默认每 24 小时检查一次更新;
也可在 Tampermonkey 面板手动「检查更新」立即拉取。

## 验证自动更新

1. 本地装旧版本脚本
2. 按上面步骤发布新版本
3. Tampermonkey 管理面板 → 已安装脚本 → 点击版本号旁的「检查更新」
4. 确认版本号变为新版本

## 注意

- `dist/` 必须入库且随发布一起提交,否则 raw URL 上的产物不会变。
- `@updateURL` 指向的文件头部版本号必须递增,Tampermonkey 才会更新。
