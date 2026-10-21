# front-station — 编辑部皮肤（avision 提取）

> **定位**：`src/components/editorial/`、`src/styles/editorial.css`、`tokens.css` 的
> `--ed-*` 与 `.theme-editorial` 的唯一出处。**刻度与令牌的仲裁仍是
> [`DESIGN.md`](./DESIGN.md) §2**，本文只记录「这套皮肤从哪来、映射成什么、
> 有意改掉了什么、怎么接到真实页面」。交互行为判据仍见 [`UX.md`](./UX.md)。
>
> **样本**：`D:\WWW_PHP\avision`（Colorlib «Avision» 杂志模板，`index/category/post`
> 三张页 + Bootstrap 4.6 / jQuery 3.2 / Owl Carousel 2.2 / masonry / jQuery.mb.YTPlayer /
> FontAwesome 4.7 / Google Fonts Ubuntu + Work Sans）。
>
> **预览**：`lab/editorial/` 是**独立参考项目，不属于站点**——自带 Astro 配置、
> 自己的 `src/pages`/`public`/输出目录/dev 锁，不进站点 `src/pages`、不产生路由、
> 不参与 `npm run build` 与 `npm run verify`，整目录可删。
>
> ```bash
> cd lab/editorial && npx astro dev     # → http://localhost:4397（站点 dev 是 4399）
> ```
>
> 参考页按原模板三张页面分节复刻：`#home` / `#category` / `#post`（另加 `#dark`）。
> 它仍然 import `src/components/editorial`——参考的价值就是「所见即发布的组件」。
> 示例图在 `lab/editorial/public/assets/`（Unsplash 来源，仅本地演示）。

## 1. 这套设计为什么好看（结构判断）

avision 的说服力不在配色，而在**三组对比**被贯彻到底：

1. **满幅摄影 vs 灰纸底**：首屏 100svh 的 cover 图 + 底部 70px 灰色速览条，下一屏立刻
   落到 `#f7f7f7` 纸面。图片永远是主角，界面本身没有阴影、没有描边噪声。
2. **两个声音的字排版**：Ubuntu 只做「标签」（12–14px、全大写、字距 .075–.1em、
   字重 700），Work Sans 只做「阅读」（14/16/18/36px、行高 1.27–1.875、字重 400–600）。
   同一页里，凡是短句都是标签腔，凡是句子都是阅读腔——层级靠**字距与大小写**，不靠颜色。
3. **一个强调色，且只做填充**：`#2ddf80` 只出现在播放环、折扣角标、评论按钮的 10%
   底色上，从不用于正文。暖灰 `#937c6f` 只在悬停时露一次头。

度量上它是极克制的：容器 1170px、9/3 分栏、圆角 6px、区块间距 80px、卡片内距
25px、所有过渡 200ms ease。**没有一处 box-shadow 用于静态元素**（只有吸顶头部与
下拉菜单各一处）。

## 2. 令牌映射（提取 → 本仓）

`tokens.css` 的 `.theme-editorial` 只重指既有语义令牌，另加一组 `--ed-*`；
因此工具类（`bg-card` / `text-muted-foreground` / `border-border`）在皮肤下自动换气，
调用点零改动。

| avision 原始               | 原值                         | 本仓令牌                                 | 说明                                       |
| -------------------------- | ---------------------------- | ---------------------------------------- | ------------------------------------------ |
| `body` 背景                | `#f7f7f7`                    | `--background` / `--canvas`              | 纸面灰                                     |
| 卡片底                     | `#ffffff`                    | `--card` / `--surface`                   |                                            |
| 侧栏、标签胶囊             | `#ededed`                    | `--secondary` / `--ed-rail`              | 同一灰承担两种角色                         |
| 首屏速览条                 | `#dedede`                    | `--ed-tile`                              | 图上浅色块                                 |
| 页脚 / 视频区              | `#1f1f1f`                    | `--ed-shell`                             |                                            |
| 订阅条                     | `#111111`                    | `--ed-shell-deep`                        |                                            |
| 强调绿                     | `#2ddf80`                    | `--ed-accent`（填充）                    | 文本用 `--ed-accent-strong: #0f7a44`（AA） |
| 暖灰悬停                   | `#937c6f`                    | `--ed-warm`                              |                                            |
| 标题黑                     | `#000`                       | `--foreground: #16161a`                  | 略软化，避免纯黑硬边                       |
| 元信息 `rgba(0,0,0,.4)`    | ≈ 2.8:1 对比                 | `--muted-foreground: #6b6b72`（4.9:1）   | **有意提亮**，原值不达 AA                  |
| 事件数字 `rgba(0,0,0,.15)` | —                            | `--ed-ghost` / `text-foreground/20`      | 装饰性，非文本                             |
| 圆角 6px                   | `6px`                        | `--radius`（已是 6px）                   | 无迁移成本                                 |
| h1–h5                      | 48/36/24/18/14               | 沿用站点阶梯 + `text-display-sm/md`      | 见下                                       |
| 正文                       | 14px / 1.45                  | `text-sm`                                |                                            |
| 正文（文章）               | 16px / 1.875 / 80% 墨        | 交给 `.prose-content`（`--prose-gap-*`） | **不覆盖**站点正文节奏                     |
| ubuntu 标签                | 12px / 700 / `.075em`–`.1em` | `text-label` + `tracking-brand`/`kicker` | 字体由 Station Sans 承担                   |
| 首屏标题                   | 36px / 600 / 1.27            | `text-display-md`                        |                                            |
| 文章标题                   | 24px / 600                   | `text-display-sm`                        |                                            |
| 卡片标题                   | 18/16/14px，600/600/500      | `text-lg` / `text-base` / `text-sm`      |                                            |
| 事件日                     | 40px / 800                   | `text-numeral`                           |                                            |
| 过渡                       | 200ms（菜单/浮层 400ms）     | `duration-fast` / `duration-slow`        | 颜色走 120ms，媒体缩放走 300ms             |

命名刻度只在皮肤里新增四个字号与两个字距（`@theme`，可生成 `text-label`、
`text-display-sm`、`text-display-md`、`text-numeral`、`tracking-kicker`、
`tracking-brand`）。这是 DESIGN.md §2 字号阶梯唯一的例外口，且仅限封面类元件。

### 2.1 字体：这是**不能照搬**的一处

avision 的灵魂之一是 Ubuntu + Work Sans 的双声部，但本仓 DESIGN.md §2 明令字体栈唯一
（Station Sans，自托管分片、`font-family` 字面量守卫执法）。因此皮肤把「两个声音」
翻译成**同一字体下的三档处理**：

- 标签：`text-label` + `uppercase` + `tracking-kicker`（12px 字距拉开）
- 阅读：`text-sm`/`text-base` + 正常字距
- 封面：`text-display-md` + `font-semibold` + `tracking-tight`

中文标签**不应**照搬 uppercase + 大字距：CJK 没有大小写，字距会把词语拆散。皮肤只在
拉丁 kicker（FASHION / SPORT / TOP）上使用 `tracking-kicker`；中文用 `text-xs`

- `text-muted-foreground` 即可。这条写在这里，是给调用点的判据，不是可选项。

## 3. 组件账（avision → React）

`src/components/editorial/`，统一从 `@/components/editorial` 导入。

| 组件                                          | avision 原型                                          | 实现要点                                                                           |
| --------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SpotlightHero`                               | `.home_slider` + Owl Carousel + `.home_slider_next`   | 状态机（`useState`）叠层淡入；`inert` 非活动帧；方向键/圆点/「下一则」共用一个索引 |
| `StoryCard`（6 变体）                         | `.card_*` 六个卡片族                                  | `lead/portrait/cover/text/row/row-round`；链接与署名同级，杜绝嵌套 `<a>`           |
| `StoryGrid`                                   | masonry + 555/263px 浮动                              | CSS grid + 一个 `sm:col-span-2`；顺序确定、无测量 JS                               |
| `SectionHeader`                               | `.section_panel`（标题下划线 + 胶囊标签 + more 下拉） | 下划线用 `.ed-rule`；标签行横向滚动而非按断点隐藏；more 是原生 `<details>`         |
| `Rail` / `RailSection` / `RailItem`           | `.sidebar` + `.side_post`                             | 灰栏配方；`row` / `row-round`（视频圆图）                                          |
| `EventItem`                                   | `.event_date` 幽灵数字                                | `text-numeral` + `text-foreground/20`                                              |
| `PromoCard`                                   | `.advertising`（340px）/ `.advertising_2`（140px）    | 两档几何；赞助标识由 `AdSpace` 岛负责，本件只画版                                  |
| `VideoWall`                                   | jquery.mb.YTPlayer + `.playlist`                      | facade：首帧海报 → 点击才注入 `youtube-nocookie` iframe；无 `embedUrl` 则跳转      |
| `NewsletterBand`                              | `.subscribe`                                          | 真 `<label>` + 44px 箭头 + 整条 hover 联动下划线                                   |
| `ArticleHero` / `BylinePanel`                 | `.home_content` + `.post_panel`                       | 去视差；58px 头像 + 5px 白环；分享标签 `.tracking-brand`                           |
| `ArchiveHero`                                 | `category.html` 的 `.home`（360px 静默封面带）        | 默认还原「无文字」原貌；传 `title` 时升级为带 `h1` 的档案头，并挂 `.hero-scrim`    |
| `TagList`                                     | `.post_tags` / `.post_tag`                            | 24px 高、hairline 边、`rounded-sm`；只做标签，不做导航胶囊                         |
| `Kicker` / `MetaLine` / `ArrowLink` / `Pill*` | `.post_category` / `.post_meta` / 阅读链接 / 胶囊按钮 | 全部带 `focus-visible` 环                                                          |

**数据契约**（`types.ts`）：`EditorialStory` 只收**已本地化、已格式化**的字段
（`date`、`note` 是字符串），皮肤不做日期格式化、不拼路由、不读 cookie。图片约定
`{ url, alt, width?, height? }`，`url` 已经过 `rewriteMediaUrl`。

### 3.6 三张页面的复刻对照

**`index.html`（首页）** —— 见参考页 `#home`

| 区块     | 原实现                                               | 本皮肤                                       |
| -------- | ---------------------------------------------------- | -------------------------------------------- |
| 首屏     | 100vh cover + Owl 轮播 + 375×240「下一则」+ 三块速览 | `SpotlightHero`（76/86svh，`svh` 不用 `vh`） |
| 信息流   | masonry 263/555px                                    | `StoryGrid` + `SectionHeader`                |
| 视频     | YTPlayer + 263px 播放列表                            | `VideoWall`（facade）                        |
| 侧栏     | 375px `#ededed` 栏                                   | `Rail` + `RailSection`                       |
| 页脚订阅 | `#111` 下划线输入 + 箭头                             | `NewsletterBand`                             |

**`category.html`（分类）** —— 见参考页 `#category`

| 区块     | 原实现                                                        | 本皮肤                                                             |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| 封面带   | `.home{height:360px}`，**没有任何文字**                       | `ArchiveHero` 不传 `title` 即原貌；真实档案页传 `title`（出 `h1`） |
| 主体起点 | `.category{margin-top:80px}`                                  | 容器 `py-16`                                                       |
| 面板     | `.section_panel` = 18px 标题 + 50×2 下划线 + 28px 胶囊 + more | `SectionHeader`（more 改 `<details>`，标签行横向滚动）             |
| 九张卡   | 263px：图片卡 / 纯文本卡 / 背景图卡交替                       | `StoryGrid columns=3` + `portrait` / `text` / `cover` 三种变体     |
| 加载更多 | `.load_more` 上 80 下 140，118×36 胶囊                        | `PillButton` + `mt-20`                                             |
| 侧栏     | 与首页同构                                                    | `Rail`                                                             |

**`post.html`（文章）** —— 见参考页 `#post`

| 区块      | 原实现                                                         | 本皮肤                                                                   |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 封面      | `home_content` 居中，max 440，标题 24px                        | `ArticleHero`（去视差，`hero-scrim`）                                    |
| 顶/底面板 | 108px 高，58px 头像 + 5px 白环 + meta + `SHARE`                | `BylinePanel`（正文前后各一次）                                          |
| 正文卡    | 白卡 r6，内距 69/100/59/45                                     | `.ed-article`（`clamp()` 收放），正文本身交给站点 prose 令牌             |
| 图注      | 12px 斜体居中，上距 8                                          | 正文 HTML 的 `<figcaption>`，由 prose 样式承担                           |
| 引文      | 上下 58px，来源 16/500、50% 墨                                 | 正文 `<blockquote>`，同上                                                |
| 标签      | 24px 高、3px 圆角、hairline 边、hover 灰底                     | `TagList`                                                                |
| 相关文章  | 三张 `card_small_with_image`                                   | `StoryGrid columns=3`                                                    |
| 评论      | 下划线输入 + 绿色胶囊表单；34px 头像 + `Reply` 胶囊 + 嵌套回复 | **不重造**：正式页面由 `islands/CommentSection` 接管；参考页只画静态几何 |

**未复刻（有意）**：`.menu` 抽屉与移动菜单（壳层职责，UX.md §6）、「加载更多」的
真实分页（`PostLoop` 职责）、评论提交/回复（`CommentSection` 职责）、广告位的
轮换与标注（`AdSpace` 职责）。参考页里的这些部分要么是静态示意，要么直接缺省。

## 4. 启用方式

```astro
---
// 局部换肤：包一层作用域即可，dark 自动跟随
---

<html class="theme-editorial">…</html>

<div class="dark theme-editorial">…</div>
```

- `tokens.css` 提供令牌与 `.theme-editorial` 作用域；`editorial.css` 只有 8 条
  工具类写不出的合体规则（图缩放、下划线、`<summary>` 去标记、横向滚动、文章卡内距、
  叠层淡入、封面遮罩引用），已由 `AppShell.astro` 引入，任何页面都能直接用组件。
- 非交互件（卡片/栅格/标题/订阅条）是**纯 SSR**，不加 `client:*`；
  `SpotlightHero` 用 `client:load`，`VideoWall` 用 `client:visible`。
- **组合契约（踩过的坑）**：从 `.astro` 文件里渲染 React 组件时，只能给它
  **可序列化数据**或**其它 React 元素**。把原生 HTML 标传进 prop（例如
  `action={<span/>}`）时，Astro 交出去的是内部 render-template 对象，React
  直接抛 `Objects are not valid as a React child`，服务端流在该处中断——页面
  会安静地截断（无 500）。所以 `RailSection` 的 `action` 是 `{ label, href? }`
  而不是节点；同理，需要富内容的插槽要么在 React 岛内部组装，要么改成数据 prop。
- 文案一律走 props，**不进 i18n dictionaries**：皮肤是表现层，字典属于站点语义。

## 5. 有意改掉的 12 处（旧技术栈的真正问题）

| #   | avision 原实现                                   | 问题                                  | 本皮肤                                                   |
| --- | ------------------------------------------------ | ------------------------------------- | -------------------------------------------------------- |
| 1   | Owl Carousel 2 + jQuery                          | 克隆 DOM、无法 SSR、~100KB 依赖       | 状态机叠层，服务端可渲染首帧                             |
| 2   | masonry + imagesLoaded                           | 图片加载后才排版，CLS 抖动            | CSS grid 单跨，无 JS                                     |
| 3   | jquery.mb.YTPlayer 自动挂载                      | 首屏即加载 YouTube，隐私与 LCP 双输   | facade，点击才注入 embed                                 |
| 4   | Google Fonts 两个家族                            | 第三方字体阻塞、字体守卫不允许        | Station Sans 三档字重处理，见 §2.1                       |
| 5   | FontAwesome 4.7 图标字体                         | 全量字体只为 10 个图标                | `lucide-react` 按需                                      |
| 6   | Bootstrap grid + 固定 px 卡宽（555/263）         | 1199/991/767 各断点手写覆盖，仍会溢出 | Tailwind 栅格 + `minmax(0,1fr)`                          |
| 7   | 全站 `:hover` 反馈、无 `:focus-visible`          | 键盘用户零反馈；触屏无悬停即无信息    | 双轨焦点环；悬停态均有静态基态                           |
| 8   | 元信息 `rgba(0,0,0,.4)`（≈2.8:1）                | 小字对比不达 AA                       | `--muted-foreground` 4.9:1                               |
| 9   | 强调绿直接做文字色                               | `#2ddf80` 白底 1.8:1                  | 填充用 `--ed-accent`，文字用 `--ed-accent-strong`        |
| 10  | `100vh` 首屏                                     | 移动端地址栏抖动                      | `svh`                                                    |
| 11  | 重复 `id="link_arrow_1"` / `id="custom_dots"` ×N | 重复 ID，label 失效                   | React key，无重复 ID                                     |
| 12  | 自动轮播 5s，无 reduced-motion                   | 违反动效豁免约定                      | 默认关闭；开启时尊重 `prefers-reduced-motion` 并悬停暂停 |

**没有做**：整站壳层换肤。桌面侧栏 / 移动顶栏 / TabBar 按 UX.md §6 是零水合委托
脚本 + 双壳并存，替换壳层是独立的一次改动，不属于「提取一套可用的视觉语言」。
皮肤先落在内容面（封面、信息流、侧栏、文章页、页脚条），壳层保持站点原配方；
两者共存不冲突，因为皮肤只重指语义令牌。

## 6. 接入清单（落到真实页面）

1. **首页封面**：`SpotlightHero` 需要 `main` 之外的满幅位置。AppShell 的
   `<main>` 带 `px-4 … min-[992px]:px-[clamp(…)]`；建议给 AppShell 增一个
   `fullBleed` 布尔 prop 或首页 slot，把 hero 放到 `main` 之前（与 banner 同层）。
2. **首页信息流**：`PostLoop` 的 grid 视图可换成 `StoryGrid`：把
   `PostSummary` 映成 `EditorialStory`（`title`/`href`/`thumbnail`/`author.name`/
   `displayDate(...)`），外壳仍用 `SectionHeader` 的 `heading` + `more`。
   `pagination` 与无限滚动逻辑留在 `PostLoop`，皮肤只接管卡片。
3. **文章页**：`PostDetail` 顶部换 `ArticleHero`，正文上方插 `BylinePanel`；
   正文容器保持 `PROSE_CLASS`（`lib/prose.ts`），**不要**套 `.ed-article` 之外的排版。
4. **分类/归档**：`TermArchive` 的标题区换 `SectionHeader`，列表换 `StoryGrid`；
   需要封面带时在页头放 `ArchiveHero`（传 `title` 生成 `h1`）——原模板的
   `category.html` 没有标题，属于 a11y 缺口，不必照搬。
5. **侧栏/页脚**：`Rail` 放进 9/3 栅格的 3 列，`NewsletterBand` 可替换 `Footer`
   的订阅位（`Footer.astro` 是壳层，改动需单独评审）。
6. **验收**：参考页 `npx astro dev --config lab/editorial/astro.config.mjs`
   → `#home` / `#category` / `#post` / `#dark`（后端离线也能开，因为它不是站点路由）；
   站点侧提交前跑 `npm run verify`。

## 7. 可访问性与性能账

- 首帧图 `eager` + `fetchPriority="high"`，其余 `lazy`；无第三方脚本、无字体请求。
- 轮播：`aria-roledescription="carousel"`、每帧 `aria-label="幻灯片 n / N"`、
  非活动帧 `inert`、方向键可换页、按钮 ≥ 40px（移动 44px 由 `size-10` 起步）。
- 订阅条：`<label>` 视觉隐藏但存在（UX.md §2 允许单字段行内操作的 aria-label 例外，
  这里更进一步用了真 label），箭头按钮 44px。
- 「更多」是原生 `<details>`：无 JS、Esc/点外部关闭由浏览器负责；不做 hover 展开。
- 所有可聚焦控件的焦点环：纸面层 `outline-focus-blue`，图上层 `outline-white`。
- 已知取舍：`<details>` 下拉不会自动关闭兄弟节点（多开）；如要单开，改成
  `ui/dropdown-menu`（Radix）即可，皮肤不绑定实现。
