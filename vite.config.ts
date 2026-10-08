import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'ArkNova Assistant',
        description: 'BGA 方舟动物园记牌与打法建议助手(个人学习参考用)',
        // BGA 对局页有两种地址:/N/arknova?table=ID(经典)与 /tableview?table=ID(通用,不含游戏名)
        match: [
          'https://boardgamearena.com/*/arknova*',
          'https://boardgamearena.com/tableview*',
        ],
        'run-at': 'document-idle',
        // Tampermonkey 自动更新:指向 main 分支上的构建产物(raw URL)
        updateURL:
          'https://raw.githubusercontent.com/ZhaofengJin/arknova-assistant/main/dist/arknova-assistant.user.js',
        downloadURL:
          'https://raw.githubusercontent.com/ZhaofengJin/arknova-assistant/main/dist/arknova-assistant.user.js',
      },
      build: {
        fileName: 'arknova-assistant.user.js',
      },
    }),
  ],
});
