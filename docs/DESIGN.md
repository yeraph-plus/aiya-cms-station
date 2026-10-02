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
- **字号阶梯**：xs（元信息）/ sm（正文默认）/ base（详情正文）/ lg（页头
  标题）；xl 以上仅限首页 banner 与详情 h1。
- **遮罩两档**：`--scrim-modal`（模态遮罩，dialog/alert-dialog 消费）与
  `--scrim-immersive`（沉浸遮罩：灯箱、全屏编辑器）。手写层禁止 `bg-black/*`
  遮罩字面量。
- **命名容器**：`--container-shell: 1510px`（AppShell/Footer 的
  `max-w-shell`）与 `--container-dialog-sm: 380px`；新增任意 `max-w-[…]`
  禁止，一律走命名容器。
- **动效**：`--duration-fast/base/slow`（120/200/300ms 语义）+
  `--ease-standard`；`prefers-reduced-motion: reduce` 全局豁免已入
  tokens.css（含返回顶部 JS 顺从）；存量偏差沿「随触摸归一」政策。
- **断点词汇表**：壳层双壳切换唯一断点 **992px**（`min-[992px]:` /
  `max-[991px]:`）；岛内自适应用标准 `sm:`(640) / `lg:`(1024) / `2xl:`(1536)。
  两条实测禁令：禁用 `lg:` 做壳切换（992–1023px 区间双壳全隐）；禁用
  `min-[1440px]:`（Tailwind v4 实测不生成）。
- **令牌词汇表映射**：`tokens.css` 的 `@theme inline` 即双词汇表
  （shadcn 系 / 原型语义系）的钉死映射（`muted→secondary`、`input→border`
  等）；新增语义色先进原始属性 + `.dark` 覆写，再挂 `@theme`。

## 3. 防回潮守卫

`tests/style-guard.test.ts` 十条 vitest 常驻执法，是本契约的可执行形态：
rounded-xl 限 ui/、禁 `min-[1440px]`、vh 上限禁用（一律 svh）、命名容器
强制、islands 遮罩字面量清零、hex 白名单（gate/500/theme/page.server 的
零依赖兜底页豁免）、字母头像单方（共享 `islands/Avatar.tsx`）、错误码出口
唯一（`lib/feedback`）、lucide-static 服务端独占（岛内图标走
props/termIconMap）、裸输入 label 钉扎。

**新增系统性约定时优先落成守卫用例，而不是口头规范。**
