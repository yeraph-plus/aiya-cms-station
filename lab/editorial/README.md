# lab/editorial — avision 皮肤的实现参考

> 这是**参考页，不是站点页面**。`lab/editorial` 是一个独立的 Astro 项目：
> 自己的 `src/pages`、`public`、输出目录、dev 锁与依赖缓存。站点构建
> （`npm run build`）看不到它，`npm run verify` 不检查它，路由表里也没有它；
> 整目录删掉不会影响任何产品代码。
>
> 它仍然 import `src/components/editorial` 与 `src/styles/*`——参考页的价值
> 就在于展示的是真正发布的组件，而不是截图。

## 运行

```bash
cd lab/editorial
npx astro dev          # → http://localhost:4397
```

端口 4397，和站点的 `npm run dev`（4399）互不干扰，可以同时开。
Astro v7 没有 `--root` 参数、项目根取当前目录，所以要从本目录启动；
依赖仍走仓库根目录的 `node_modules`。

## 三节对照

| 区块        | 原模板          | 复刻内容                                                                                    |
| ----------- | --------------- | ------------------------------------------------------------------------------------------- |
| `#home`     | `index.html`    | 满幅封面轮播、三块速览、拼贴信息流、视频墙、四列最新、灰色侧栏、广告位、活动                |
| `#category` | `category.html` | 360px 静默封面带、面板 + 胶囊标签 + more、九张卡（图/文/背景图）、加载更多                  |
| `#post`     | `post.html`     | 封面标题块、署名/分享面板、白色正文卡（图注/引文/标签）、底部面板、相关文章、评论与表单示意 |
| `#dark`     | —               | 同一套组件在 `.dark .theme-editorial` 下的表现                                              |

## 结构

```
lab/editorial/
  astro.config.mjs      # 独立项目：srcDir/publicDir/outDir/port，@ → ../../src
  src/data.ts           # 演示数据（EditorialStory / SpotlightSlide / VideoItem）
  src/pages/index.astro # 页面外壳：头、四节索引、页脚订阅
  src/sections/*.astro  # 三张原页面的复刻
  src/styles/lab.css    # Tailwind 入口：复用站点令牌/配方 + 声明扫描路径
  public/assets/*.jpg   # 模板自带示例图（Unsplash 来源，仅本地演示）
  .dist/ .astro/ node_modules/   # 预览自己的产物/锁/依赖缓存（git 忽略）
```

## 两条约束

1. **组合契约**：从 `.astro` 渲染 React 组件时只传可序列化数据或其它 React
   元素。原生 HTML 当 prop（例如 `action={<span/>}`）会被 Astro 包成
   render-template 对象，React 抛 `Objects are not valid as a React child`
   并截断 SSR 流——页面会安静地少一半。
2. **样式来源**：`src/styles/tokens.css`（令牌 + `.theme-editorial`）与
   `src/styles/editorial.css`（合体配方）。参考页不引入任何独立设计样式，
   所以看到的就是接入真实页面后的样子。
