# front-station — shadcn 官方零件对齐计划

> **定位**：计划文档——只做规划、官方事实引用与手写面缺口盘点，**不承载稳定判据**。
> 任何一项纳入迭代时，判据先行落到 [`UX.md`](./UX.md) / [`DESIGN.md`](./DESIGN.md) /
> [`ARCHITECTURE.md`](./ARCHITECTURE.md)，再动代码、再上守卫（契约先改 → 代码后改 →
> 守卫执法）；批次完成后的记录进 [`HISTORY.md`](./HISTORY.md)。
>
> **背景（2026-10-08 拍板）**：`@shadcn/react` 已引入为 headless 底座（当前零消费方，
> 产物零增量已验证）；客服滚动面、既有交互件 Toggle 化、移动壳适配**均不纳入当期**，
> 按本计划批次回入迭代。

## 1. 官方面说明（引用基准，2026-10 核清）

### 1.1 `@shadcn/react` 包

- shadcn-ui/ui monorepo `packages/react`，npm 包 `@shadcn/react`，自述
  「Unstyled components for React」。
- 2026-06-26 首发，当前 0.3.1（2026-08-31）；peer `react >= 19`（本仓 19.2.8 满足）；
  MIT。
- 定位与 `radix-ui` 同位：headless 行为运行时；官方 registry 新件（message-scroller
  等）的 wrapper 源码依赖它。本仓已装 `^0.3.1`——0.x 阶段 caret 只进 0.3.x 补丁，
  0.4/1.0 需显式升级并按官方 changelog 重验。

### 1.2 chat 原语族（registry 实名核清）

`@shadcn/message`、`@shadcn/message-scroller`、`@shadcn/bubble`、
`@shadcn/attachment`、`@shadcn/marker` 五件在册。分工：会话容器 = MessageScroller；
消息行 = Message；气泡面 = Bubble；附件 = Attachment；系统注记/分隔 = Marker。
官方 chat 规则：chat UI 一律组合这些原语，不手写气泡 `div` 与裸滚动容器；
**MessageScroller 拥有滚动行为，不手写 `useStickToBottom`/ResizeObserver 类 hook**。

### 1.3 Message Scroller 行为面（官方文档）

- 组成：`Provider`（headless 根：开卷位置/自动滚动/锚定/可见性状态）、`Root`（框架）、
  `Viewport`（滚动元素；前插历史时保持可见行）、`Content`（转写容器，自带 live-region
  语义）、`Item`（行边界，承载测量/锚定/跳转，可包任何子件）、`Button`（跳转控制，
  无可跳方向时 inert）。
- hooks：`useMessageScroller`（`scrollToMessage` / `scrollToEnd` / `scrollToStart`，
  可在行挂载前排程目标）、`useMessageScrollerVisibility`（`currentAnchorId` /
  `visibleMessageIds`，惰性，仅在订阅时运行）、`useMessageScrollerScrollable`
  （start/end 可滚动边）。
- 行为要点：
  - **follow/hold**：`autoScroll` 只在读者位于最新边时跟随；滚离即释放，
    `scrollToEnd` 重新接合——客服轮询新消息需要的正是这个语义。
  - **turn anchoring**：Item `scrollAnchor` 把新回合钉在视口上部，
    `scrollPreviousItemPeek` 保前一行残影。
  - **历史前插**：`preserveScrollOnPrepend` 默认开——load-earlier 场景官方内建，
    等价于本仓手写的 preserveHeightRef 手法。
  - **开卷位置**：`defaultScrollPosition = "start" | "end" | "last-anchor"`
    （重开旧线程落在最后一个有意义回合，而非绝对底部）。
  - **性能**：滚动热路径不进 React state；Item 自带 `content-visibility: auto` +
    `contain-intrinsic-size`；TanStack Virtual 虚拟化作为可选示例（未默认内建）。
- wrapper 依赖：`cn`（本仓已有）、`@shadcn/react`（已装）、ui/button。

### 1.4 SSR 语义（官方两解法）

- 问题本体唯一：HTML 无法设置 `scrollTop`，SSR 直出的转写首帧停在最老消息，水合后
  跳到底部。
- **解法 A（默认）**：`defaultScrollPosition` 为 `"end"`/`"last-anchor"` 时 Viewport
  挂 `data-pending-scroll`，配套 CSS 保持隐藏直至滚动应用——不跳帧，代价是水合前
  短暂空白框。
- **解法 B（进阶）**：Viewport 后随一段内联 `<script>` 设
  `scrollTop = scrollHeight` 并摘除属性；Viewport 须加 `suppressHydrationWarning`
  （水合前 DOM 已被修改）；CSP 环境需要 nonce。**仅限 `"end"` 且消息已在 SSR HTML
  中**；`"last-anchor"` 与客户端取数的列表不适用。
- 对本仓：SupportChat 现状是客户端取数（SSR 渲染空列表），该问题整条不触发；未来
  server islands 直出线程时才需要解法 B。

### 1.5 单件：Toggle / Spinner（registry 实名核清）

- `@shadcn/toggle`：radix Toggle 原语（`radix-ui` 单体内已有）+ cva 双 variant
  （default / outline）× 三 size（sm / default / lg），`data-[state=on]` 出样式，
  按压语义（aria-pressed 等）由原语内建。依赖 `cn` + `radix-ui`，本仓均已具备——
  纳入时 `npx shadcn@latest add toggle` 零新依赖。
- `@shadcn/spinner`：官方加载指示单件；本仓 `islands/Spinner` 是手写同位物。

### 1.6 Astro 侧现状（2026-10 核清）

- 本仓组合：astro 7.3.1 + @astrojs/react 6.0.5 + React 19.2.8。Astro 7.0（2026-06，
  Rust 编译器/Vite 8）不改岛屿水合语义；7.0.9 修复「岛组件首次加载失败后永久不再
  水合」（改为可靠重试），本仓版本已含。
- React 19 把 hydration mismatch 从警告升级为硬错误（开发态抛出、生产态丢弃服务端
  HTML 重渲）；`<astro-island>` 内 mismatch 是长期已知问题（withastro/astro#7709
  一系），无银弹，唯靠「渲染路径无浏览器态」纪律——本仓 `tests/island-ssr.test.ts`
  常驻执法。
- server islands（无水合的服务端个性化块）只收 `.astro` 组件、不接 React；对「SSR
  直出个性化内容」的形态是两层组合：.astro server island 出 HTML + React 岛只接管
  交互。

## 2. 本仓手写面缺口盘点

| #   | 位置                                                           | 手写现状                                                                                         | 官方对应                                                                        | 差距/收益                                                  | 前置契约                                                                 | 建议批次                          |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| 1   | `islands/chat/SupportChat.tsx` 滚动面                          | `listRef.scrollTop` 手动贴底（stickToBottom）、前插保视口（preserveHeightRef）、20s 轮询后重贴底 | MessageScroller follow/hold + `preserveScrollOnPrepend` + jump-to-latest Button | 删两处手写滚动手法；白得锚定、跳转钮、content-visibility   | UX.md §5 chat Dialog 行补滚动判据                                        | A（客服迭代）                     |
| 2   | `islands/chat/SupportChat.tsx` 消息行                          | 手写气泡 ul/li（visitor 右 / staff 左）                                                          | Message + Bubble                                                                | 气泡视觉归官方配方；等图片附件一并重排（Attachment）       | 同上 + 契约 ChatMessage media 字段加法（依赖后端）                       | A2（若后端落图片中继）            |
| 3   | `islands/LikeButton.tsx`、`islands/FavoriteButton.tsx`         | 手写 `aria-pressed` 按钮各一处                                                                   | Toggle                                                                          | 按压语义与样式归原语                                       | UX.md §1（或 DESIGN 卡片配方）加按压态控件判据                           | B                                 |
| 4   | `islands/feed/PostLoop.tsx` 视图切换钮                         | 手写 `aria-pressed` ×3                                                                           | Toggle（outline variant）                                                       | 同上                                                       | 同上                                                                     | B                                 |
| 5   | `islands/Spinner.tsx`（5 个岛消费方）                          | 手写加载指示件                                                                                   | `@shadcn/spinner`                                                               | 删手写件，loading 唯一习语改指官方件                       | UX.md §4 loading 行改写                                                  | B                                 |
| 6   | 移动壳原生钮（MobileTopBar 暗色切换 `[data-color-toggle]` 等） | 委托式原生 script + `title` 属性，无 Tooltip                                                     | Tooltip / 岛化（桌面 ColorModeToggle 已有先例）                                 | 覆盖缺口：壳层原生钮仍靠 title；契约与桌面岛化先例存在张力 | **UX.md §6 契约修订**（「壳交互委托式原生、shadcn 零件不得进壳层」条款） | C（移动版壳适配，既定下一轮主题） |
| 7   | Tooltip 覆盖面                                                 | 桌面动作行五钮 + 回到顶部已挂；其余纯图标钮未盘点                                                | Tooltip                                                                         | 补面随批次 C 一并盘点                                      | §1 Tooltip 行已立                                                        | C                                 |
| 8   | （远期）SSR 直出个性化块                                       | 无                                                                                               | server islands 两层组合 + §1.4 解法 B                                           | —                                                          | ARCHITECTURE 加两层组合形态                                              | D（触发条件驱动）                 |

**明确不动项**（盘点后有意保留，勿再「统一」）：spoiler span（契约定为纯 CSS 悬停
揭示，无按压语义）；下载文件表格多选框等密集控件（UX.md §2 功能性密集控件豁免）；
`BackToTop` / `ColorModeToggle`（页面级滚动，非容器滚动，MessageScroller 不适用；
已岛化 + Tooltip）；`lib/channels` 瀑布流估算打包（无官方对应，纯函数已测试）；
ConfirmPopover / ui/empty / ui/field（已对齐现行契约习语）。

## 3. 批次拆分

- **批次 A：客服滚动面（MessageScroller 引入）**
  1. 契约：UX.md §5 chat Dialog 行补滚动判据（follow/hold、前插保持、jump-to-latest，
     滚动行为 = MessageScroller 或等价表述）；ARCHITECTURE 客服行更新实现分布。
  2. 代码：vendor `@shadcn/message-scroller` wrapper，本地化三点——`cn` 导入改
     `@/lib/utils`、Button `render` prop 接本仓 asChild Button（原语自实现 render，
     无 Base UI 依赖）、样式 token 对表 DESIGN.md。
  3. 删手写 stickToBottom / preserveHeightRef；20s 轮询与 `/api/chat/messages`
     代理取数面不动。
  4. 守卫：island-ssr 渲染测试（滚动原语渲染路径不得含浏览器全局）+ vitest 全量 +
     4321 手测清单（贴底跟随、load-earlier 不跳、jump-to-latest、双壳可见性去重）。
  5. 风险：Provider 按「每岛自持」接（岛屿无共享 React 根，Tooltip 先例）；
     `data-pending-scroll` 样式随 wrapper 进来但客户端取数下不触发。
- **批次 B：交互件 Toggle 化 + Spinner 对齐**
  1. 契约先改：UX.md §1 加按压态控件判据（Toggle；aria-pressed 语义归原语）；§4
     loading 唯一习语从 islands/Spinner 改指 ui/spinner；DESIGN.md 视觉刻度对表
     toggle variants。
  2. `npx shadcn@latest add toggle spinner`（零新依赖）→ LikeButton / FavoriteButton
     / PostLoop 三处五钮 → 删 `islands/Spinner`、改 5 个消费方导入。
  3. 守卫：现有 vitest + 明暗双模式按压态手测。
- **批次 C：移动版壳适配（既定下一轮主题，承接 §2 #6 / #7）**
  1. 契约先改：UX.md §6 修订壳交互条款（桌面岛化先例上收为双壳一致，或明确豁免
     清单）；暗色切换在移动壳的去留与「手动切换入口归设置域」条款联动。
  2. 代码随契约：移动暗色钮处置（岛化或保留原生 + title）、Tooltip 补面盘点。
- **批次 D（远期，触发条件驱动）**：客服线程或个性化块需要 SSR 直出时——server
  islands（.astro）出 HTML + React 岛只接管交互；Message Scroller 按官方解法 B 接
  开卷位置（内联脚本 + `suppressHydrationWarning` + CSP nonce）。

## 4. 风险与版本策略

- `@shadcn/react` 0.x：`^0.3.1` caret 不跨次版本；0.4+/1.0 升级时对照官方 changelog
  重验 wrapper 与 chat 原语族 API。
- 岛边界三条常驻判据不变：渲染路径无浏览器全局（island-ssr 执法）、context 每岛
  自持（Tooltip 先例）、双壳双实例可见性去重（UserCenter/SupportChat 先例）。
- bundle：零消费方零增量（2026-10-08 已验证）；每批次纳入后重验一次产物体积。
