# front-station — 视觉契约

> **定位**：视觉层的唯一判据源（`src/styles/tokens.css` 头部注释引用这里）
> ——令牌、刻度、判据原则。**稳定契约：只写「是什么、什么是允许的」**，
> 不写计划、阶段、状态与修订记录（那些一律进 [`HISTORY.md`](./HISTORY.md)）。
> 交互行为与移动端布局判据在 [`UX.md`](./UX.md)，同为准契约；架构分层与
> 实现契约见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。
>
> **维护约定**：改任何刻度/令牌先改这里、再改代码（顺序见 §1），系统性
> 约定同时落守卫用例（§3）。本文件 §2 是全部刻度与令牌的**唯一出处**——
> 其他文档（含 UX.md）引用刻度时只引用、不复制。

## 1. 判据原则

- **布局不动，收敛默认值**：人工调过的版式一律保留；改动发生在
  `tokens.css` / `ui/` 原件 / 共享 class 配方层面，让页面自动继承。
- **顺序：令牌 → 元件 → 调用点**。反序等于几十个文件改两遍。
- **验收 = `npm run verify` + 浏览器实测**（1440/375 × 明/暗）。
- **壳层零水合边界不动**（vanilla 委托脚本）；动态件以岛为单一事实源，
  不维护 `.astro` 镜像实现。
- **零视觉变化的纯重构优先**：令牌晋升一律沿用原值，把「统一命名」与
  「改外观」拆成两个可独立回滚的提交。

## 2. 现役刻度与令牌（唯一出处）

- **圆角刻度**：`--radius: 6px` 系（`rounded-md` / `rounded-lg`）；
  `rounded-full` 仅限 chip、头像、圆形按钮；**`rounded-xl` 禁止逸出
  `src/components/ui/`**（shadcn 出厂 12px 在刻度外）。图上元素（广告角标底、
  缩略图删除钮）的黑底白字不属于遮罩体系。
- **阴影三档**：`shadow-none` 静止面（卡片默认）/ `shadow-sm` 悬浮面（下拉、
  气泡）/ `shadow-md` 浮出层（toast、返回顶部、灯箱）。新增阴影必须能报出
  档位。
- **卡片配方**：`rounded-lg border border-border bg-surface` + 内容内距
  `p-4`（紧凑 `p-3`）；可点击卡片加 `transition-colors hover:border-body-muted`；
  `ui/card` 出厂默认已本地化为站点配方（`gap-0 rounded-lg py-0`、去 shadow）。
- **正文节奏两档**：文章正文（`prose-content`）的纵向间隔只有两档令牌 ——
  `--prose-gap-text: 0.75rem`（段落、列表项等文本步进）与
  `--prose-gap-block: 1rem`（列表/图片/表格/引用/代码块，以及后端模板零件块：
  折叠、提示、术语表、关联卡、按钮与剪贴板槽）。标题上距从块级档派生
  （h2 ×2、h3 ×1.5、h4 ×1），标题下距用文本档。Tailwind Typography 只负责
  文字语义（字号、颜色、项目符号、引用缩进），**它的 20/32/48px 编辑节奏不
  得生效**；`shell.css` 的 `.prose-content` 段是这些间隔的唯一出处，零件盒
  内距统一 `0.75rem 1rem`（紧凑档），盒内首/末子元素外边距清零、行内表情
  与网格术语列不得继承外边距。解锁后的正文与正常正文走同一条渲染路径
  （同一个 `PROSE_CLASS`），三处门禁状态的起点与正文一致。
- **字号阶梯**：xs（元信息）/ sm（正文默认）/ base（详情正文）/ lg（页头
  标题）；xl 以上仅限首页 banner 与详情 h1。
- **字体栈**：站点字形 = 自托管 Station Sans——OFL 1.1 的 Noto Sans CJK 派生的三个
  语言族 `Station Sans SC` / `TC` / `JP`，简/繁/日字形由**族**决定，不依赖 `locl`。
  基础栈（`--font-display` 与 `--font-body` 同值）：

  ```css
  'Station Sans SC', 'Station Sans TC', 'Station Sans JP', 'PingFang SC', 'PingFang TC',
    'Hiragino Sans', 'Microsoft YaHei', 'Microsoft JhengHei', 'Yu Gothic UI',
    'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans CJK JP', system-ui, sans-serif
  ```

  `:lang(zh-Hant|zh-TW|zh-HK|zh-MO)` 让 TC 族置顶、`:lang(ja)` 让 JP 族置顶：标了
  语言的日文引文取日文字形，未标语言的中日混排按文档语言取字形（假名在三族构建里
  字形一致，混排不缺字）。Regular（400）正文、Medium（500）标题强调，六份分片 css
  由 AppShell 引入；`--font-mono` 不走 Station Sans。零依赖兜底页（gate/500）内联
  同一基础栈，web 字体不达时自然回落栈内系统黑体。手写层禁止新增 `font-family`
  字面量与 `font-[…]` 任意值，字体一律走令牌。

  分片由仓库内管线生成，不依赖任何第三方字体包：`scripts/fonts/` 取源（上游每语言
  OTF 入 `.cache/fonts/`，不入版本管理，镜像 cdn.jsdelivr.net 优先）→ 快照官方覆盖表
  `ranges.json` + 字频顺序 `order.json` → harfbuzz 子集化为
  `src/fonts/station-sans/<族>/` 的 woff2 与分片 css（管线命令 `npm run fonts:fetch`、
  `fonts:snapshot`、`fonts:build`、`fonts:check`，`verify` 已含 check）。SC 族装前段块
  与字频常用字（10,000 码位）；
  TC/JP 族只装与本族字形**实际不同**的码位（5,210 / 8,663 码位，逐字形比对轮廓哈希，
  日文专有汉字含在内），相同字形由 SC 族承担，故不存在风格断裂；三族两字重合计
  9.65MB，纯中文页只拉一两片核心片与自身汉字所在片。emoji/符号块有意排除，以免以
  单色字形遮蔽系统彩色 emoji。

- **遮罩两档**：`--scrim-modal`（模态遮罩，dialog/alert-dialog 消费）与
  `--scrim-immersive`（沉浸遮罩：灯箱、全屏编辑器）。封面文字保障的英雄
  渐变 = `shell.css` 的 `.hero-scrim`（沉浸遮罩同色相的定档透明度），
  详情头图与分类卡共用。手写层禁止 `bg-black/*` 与渐变遮罩字面量。
- **命名容器**：`--container-shell: 1510px`（AppShell/Footer 的
  `max-w-shell`）与 `--container-dialog-sm: 380px`；新增任意 `max-w-[…]`
  禁止，一律走命名容器。
- **动效**：`--transition-duration-fast/base/slow`（120/200/300ms 语义：
  微交互 / 弹出层 / 页面级；Tailwind v4 duration 命名空间，生成
  `duration-fast/base/slow` 工具类，壳层 CSS 以 `var(--transition-duration-*)`
  读取）+ `--ease-standard`；组件层时长一律走令牌工具类，字面时长守卫
  禁止。一次性确认脉冲 = `animate-pop`（tokens.css 令牌，动作成功态
  翻转时触发一次，微交互档）。
  视图过渡：侧栏与双壳顶栏/底栏以 `transition:name` 持久匹配（导航时
  壳保持原位，内容区走 shell.css `::view-transition-*` 的方向性淡移，
  降级浏览器回落路由器自带 crossfade）；Toaster 以 `transition:persist`
  跨导航存活。列表入场动画只给客户端追加项（fade-up、页面级档），
  SSR 首屏与翻页/筛选的内容替换不做入场动画。
  `prefers-reduced-motion: reduce` 全局豁免已入 tokens.css（视图过渡由
  路由器自行豁免、含返回顶部 JS 顺从）；存量偏差沿「随触摸归一」政策
  （现余路由进度条循环周期一项）。
- **断点词汇表**：壳层双壳切换唯一断点 **992px**（`min-[992px]:` /
  `max-[991px]:`）；岛内自适应用标准 `sm:`(640) / `lg:`(1024) / `2xl:`(1536)。
  两条实测禁令：禁用 `lg:` 做壳切换（992–1023px 区间双壳全隐）；禁用
  `min-[1440px]:`（Tailwind v4 实测不生成）。
- **令牌词汇表映射**：`tokens.css` 的 `@theme inline` 即双词汇表
  （shadcn 系 / 原型语义系）的钉死映射（`muted→secondary`、`input→border`
  等）；新增语义色先进原始属性 + `.dark` 覆写，再挂 `@theme`。
- **编辑部皮肤（editorial，出处 [`EDITORIAL.md`](./EDITORIAL.md)）**：
  avision 模板提取的可选皮肤 = `.theme-editorial` 作用域（`<html>` 或包裹层）
  ——它只重指既有语义令牌（`--background`/`--card`/`--secondary`/
  `--muted-foreground`/`--border` 等）并另加一组 `--ed-*`（rail/tile/shell/
  shell-deep/accent/accent-strong/warm/ghost/on-shell），**不新增品牌色**：
  `--primary` 始终由后端主题驱动。配套命名刻度 `text-label`(12) /
  `text-display-sm`(24) / `text-display-md`(36) / `text-numeral`(40) 与
  `tracking-kicker`(.1em) / `tracking-brand`(.075em) 仅在
  `src/components/editorial/` 与参考页 `lab/editorial/`（独立 Astro 项目，
  不进 `src/pages`、不参与站点构建与 `verify`）使用，是「xl 以上只给首页
  banner 与详情 h1」这条阶梯的唯一例外口，且只用于封面类元件。皮肤组件
  （`src/components/editorial/`）不读浏览器全局、不做日期/路由格式化、
  文案走 props 不进字典；`editorial.css` 只放工具类写不出的合体配方。

## 3. 防回潮守卫

`tests/style-guard.test.ts` 十四条 vitest 常驻执法，是本契约的可执行形态：
rounded-xl 限 ui/、禁 `min-[1440px]`、vh 上限禁用（一律 svh）、命名容器
强制、islands 遮罩字面量清零、hex 白名单（gate/500/theme/page.server 的
零依赖兜底页豁免）、字母头像单方（共享 `islands/Avatar.tsx`）、错误码出口
唯一（`lib/feedback`）、lucide-static 服务端独占（岛内图标走
props/termIconMap）、裸输入 label 钉扎、组件层字面时长禁止（时长走
`duration-fast/base/slow` 令牌工具类）、字体栈唯一（`font-family` 字面量
只许 tokens.css 与 gate/500 内联豁免，三处基础栈逐字一致、栈首必须
`Station Sans SC`，TC/JP 族紧随其后，简/繁/日系统面与 `:lang()` 区域
重排必须在场）、正文节奏单一声明（正文与模板
零件同走 `--prose-gap-block`）、正文容器配方唯一（`prose-content` 只在
`lib/prose.ts` 组装）。

**新增系统性约定时优先落成守卫用例，而不是口头规范。**

编辑部皮肤另有一份专项守卫 `tests/editorial.test.ts`（皮肤组件 SSR 可渲染、
`--ed-*` 与 `.theme-editorial` 在场、皮肤不外泄 hex 字面量、字号刻度只走命名
令牌），与上面十四条并存。
