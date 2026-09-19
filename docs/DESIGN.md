# front-station — 设计系统规范与收敛路线图

> 本文件是 `src/styles/tokens.css` 头部注释引用的设计文档；也是 2026-09-17
> 启动的「设计系统收敛迭代」的唯一事实源。旧版设计规格在
> `aiya-astro-bulid/docs/`（LAYOUT.md / DESIGN.md，冻结原型），本文件接管其
> 现役部分。任何视觉细节的改动先改这里，再改代码。
>
> **本文件已按 2026-09-18 实测复核**：初版（2026-09-17）的计数与个别结论有误，
> 已在 §1 / §6 / §8 逐条标注。凡带「实测」字样的数字均为当前代码库的真实统计，
> 复核命令见 §8。

## 1. 现状诊断（2026-09-18 复核，91 → 实测 157 个源文件）

**规模实测**：`src/` 下 157 个文件 = 48 `.astro` + 44 `.tsx` + 60 `.ts` + 3 `.json`
+ 2 `.css`；其中 `src/components/ui/` 是 18 个 shadcn 原件（vendored），
**手写层 = 74 个 astro/tsx**。初版「91 个源文件」只数了 astro+tsx。

问题定性：壳层（Astro）与元件层（shadcn 岛）并存两套设计语言，且缺少
统一的规范层。四条根因：

1. **令牌双词汇表**：`tokens.css` 中 shadcn 系（`background/card/muted/secondary/`
   `accent/destructive/border/ring/sidebar…`）与原型系（`ink/canvas/surface/`
   `discussion/hairline/body-muted/focus-blue/error`）各一套，共 40 个原始自定义属性。
   两套之间目前是**手写别名**（`--color-ink: var(--ink)` 等），不是映射表。
2. **shadcn 原件出厂脸**：`ui/card.tsx:9` 默认
   `flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm`
   （实测；初版写成 `px-6` 有误，`px` 在 `CardHeader`/`CardContent` 上），
   与站点 `--radius: 6px` 紧凑 hairline 风冲突。调用处被迫反向覆盖：
   `CategoryCards.tsx:101` `gap-0 rounded-md py-0`、`CommunityFeed.tsx:725` `gap-0 py-0`。
   **病根在原件默认值，不在调用处。**
3. **细节无纪律**（实测，非 ui/ 手写层）：
   - `gap-*` 共 12 档：`gap-2`×37 / `gap-3`×27 / `gap-1.5`×26 / `gap-1`×20 /
     `gap-4`×17 / `gap-0`×10 / `gap-2.5`×7 / `gap-5`×6 / `gap-6`×5 / `gap-8`×3 /
     `gap-0.5`×2 / `gap-3.5`×1；轴变体 `gap-y-1`×6、`gap-x-2`×4、`gap-x-3`×4 等 6 种。
     （含 ui/ 时 `gap-2` 达 55。初版记的 62/58/32 与实测不符。）
   - 圆角 7 种（全仓含 ui/）：`md`×41 / `full`×37 / `lg`×34 / 裸 `rounded`×11 /
     `sm`×5 / `xl`×3 / `none`×3 + 离刻度值 `[5px]`×2（`DesktopSidebar.astro:31,33`）。
     `--radius` 6px 的刻度是 4/6/8px，**`xl` 的 12px 与 `[5px]` 都在刻度外**。
   - 阴影：**手写层几乎没有 elevation** —— 非 ui/ 仅 3 处
     （`shadow-md`×2：`ProfileCard.astro:61`、`AppShell.astro:185`；`shadow-none`×1：
     `RichEditor.tsx:283`），其余 14 处全在 ui/。（初版「混用 ×13」实为 ui/ 内计数。）
   - 硬编码 hex：**18 处** = `500.astro`×10 + `shell.css`×8。`500.astro` 是刻意
     独立的离线兜底页（其文件头注释明示 dependency-free，不引 `tokens.css`），
     `shell.css` 8 处已于本批次晋升令牌（见 §6#5）。
   - `max-w`：非 ui/ 18 处，其中任意值 **10 处 / 7 个不同值**
     （`1510px`、`760px`、`380px`、`24rem`、`220px`、`20rem`、`14rem`）。
4. **交互基建分散**：sonner 裸调 **4 岛 19 处**（`CommunityFeed`×8、`FavoriteButton`×4、
   `LikeButton`×4、`RatingRow`×3）；`animate-in/out` 各 8 处**全部在 ui/ 内**，
   手写层只有 `animate-spin`×11。**无时长/缓动规范**——时长散见
   `0.15s / 0.2s / 0.25s`，缓动散见 `ease / ease-in-out`。
5. **透明遮罩三套不透明度**（本批次新发现）：Radix 系 `bg-black/50`、
   lightbox `rgba(15 15 20, 0.85)`（`parts.tsx:408` 与 `CommunityFeed.tsx:1016`
   **两处重复**）、已删除的原生 `dialog::backdrop` `rgb(15 15 20 / 0.45)`。

## 2. 设计原则

- **布局不动，收敛默认值**：人工调过的版式一律保留；改动发生在
  `tokens.css` / `ui/` 原件 / 共享 class 配方层面，让页面自动继承。
- **顺序：令牌 → 元件 → 调用点**。反序等于 47 个 astro 文件改两遍。
- **每阶段独立可发布**，验收 = `npm run verify` + 截图 diff。
- **壳层零水合边界不动**（vanilla 委托脚本），`.astro` 镜像元件与 `.tsx`
  原件共享同一份 cva class 配方（`src/lib/recipes.ts`，P2 建）。
- **零视觉变化的纯重构优先**：令牌晋升一律**沿用原值**，把「统一命名」与
  「改外观」拆成两个可独立回滚的提交。暗色校对另立批次。

## 3. 迭代路线图

| 阶段 | 内容 | 量级 | 状态 |
|---|---|---|---|
| P0 | 截图基线（全路由×明暗×双端）+ 本文档 + 路由审计 | 小 | **文档与路由审计已落（2026-09-18）**；截图基线**需先起 Docker WP**——mock 已于同批移除，免后端的路已不存在（§6#15） |
| P1 | 令牌合并（双词汇表钉死映射）、版式刻度、暗色逐 token 校对 | 小~中 | **部分落地**：孤儿色已晋升（§6#5）、`cn` 别名已统一（§6#3）；映射表与暗色校对待做 |
| P2 | shadcn 原件本地化（出厂默认改站点默认）+ `.astro` 镜像元件 + 清理残留 | 中 | 未开始 |
| P3 | 调用点收敛（分批：feed→community→user-center→detail）+ vitest 风格守卫 | 大 | 未开始 |
| P4 | toast 门面 / ConfirmDialog 模式 / 动效词汇表 / PageState loading / 路由清理 | 中 | 未开始；#1 chips 路由**已修**（2026-09-18） |
| P5 | 版式节奏提升（PageHeader、Section 节奏、elevation 体系）——可选 | 中 | 未开始 |

**防回潮守卫**（P3 落地，vitest 扫描）：
- `rounded-xl` 禁止逸出 `src/components/ui/`；
- 新增 hex 直写禁止（品牌色经令牌）；**当前手写层已达成（`shell.css` 归零，
  唯一例外 `500.astro` 作为独立离线页显式豁免）**；
- 新增任意 `max-w-[…]` 禁止（走命名容器）。

## 4. 版式刻度（P1 定稿，此为方向）

- **卡片内距两档**：紧凑 `--card-pad: 0.75rem` / 标准 `1rem`（对应现用 p-3/p-4）。
- **阴影三档**：`none / sm / md`，语义为「静止面 / 悬浮面 / 浮出层」。
  实测手写层只有 2 处 `shadow-md`，收敛空间很大。
- **字号阶梯**：xs（元信息）/ sm（正文默认）/ base（详情正文）/ lg（页头标题）；
  xl 以上仅限首页 banner 与详情 h1。
- **动效**：120ms（微交互）/ 200ms（弹出层）/ 300ms（页面级）+ 统一缓动，
  全局 `prefers-reduced-motion` 豁免。
- **暗色**：surface/hairline/discussion 在 `.dark` 下拉开层次差（现为 provisional 值）。

> 刻度令牌**本轮不建**：`--card-pad` 等目前无消费方，先建令牌等于造死代码。
> 待 P2 改 `ui/` 原件默认值时同步落地。

## 5. 路由审计表（2026-09-18 复核，32 个 `.astro` 路由文件 + 28 个 `.ts` 端点）

| 路由 | 文件 | 状态 |
|---|---|---|
| `/` | index.astro | 正规（banner + 三 feed） |
| `/posts/` `(/page/[n]/)` | posts/* | 正规；**chips href 为 `/posts/category/{slug}/` 残留，见 §6#1** |
| `/posts/page/` | posts/page/index.astro | 302 回列表根（缺页码回退，符合契约） |
| `/posts/[slug]/` | posts/[slug].astro | 正规 |
| `/resources/` 同构三件 | resources/* | 正规 |
| `/pages/` 同构三件 | pages/* | 正规 |
| `/categories/` | categories/index.astro | 正规（一级目录页） |
| `/categories/[slug]/` `(/page/[n]/)` | categories/[slug]/* | 正规 |
| `/community/` `(/page/[n]/)` | community/* | 正规（单页应用式，CommunityFeed 岛） |
| `/community/board/` | …/board/index.astro | 302 回 `/community/` |
| `/community/board/[slug]/` `(/page/[n]/)` | …/board/[slug]/* | 正规 |
| `/community/board/[slug]/page/` | …/page/index.astro | 302 回归档根 |
| `/profile/` | profile/index.astro | 302 派发（登录→me，游客→首页） |
| `/profile/me/` | profile/me.astro | 正规（保留字，loader 显式 404） |
| `/profile/[slug]/` `(/page/[n]/)` | profile/[slug]/* | 正规 |
| `/profile/[slug]/page/` | …/page/index.astro | 302 |
| `/settings/` `/reset-password/` | settings / reset-password | 正规（账号岛） |
| `/404` | 404.astro | 正规（走 AppShell + PageState） |
| `/500` | 500.astro | **刻意独立**：文件头注释明示 dependency-free（无 shell、无数据、无岛），内联样式的 10 处 hex 是设计决定而非疏漏（修正初版「走 AppShell」的误述） |

死路由残留：无 tag/category 嵌套路由文件（`/categories/` 批已整树删除），
仅 §6#1 的 chips href 指向已删除的树。

**实测验证（2026-09-18，构建产物 + mock 模式，Docker WP 未运行）**：
文件级审计准确——32 个 `.astro` 路由文件与表中逐行对应，无多余无缺失。HTTP 级
只能验证不依赖内容数据的行：

| 探测 | 结果 | 与表一致 |
|---|---|---|
| `/` | 200（壳层正常渲染） | ✅ |
| `/posts/page/` | 302 → `/posts/` | ✅ |
| `/community/board/` | 302 → `/community/` | ✅ |
| `/profile/` | 302 → `/`（游客派发） | ✅ |
| `/404/` | 404 + 404 页 | ✅ |
| `/500/` | 500 + 离线兜底页 | ✅ |
| `/settings/` | 302 → `/` | ⚠️ 表未记：该页对游客有登录门，非缺陷但需补注 |
| `/posts/` `/resources/` `/pages/` `/categories/` `/community/` 及各 `page/[n]/` | 当时全部落 404 页状态 | ❌ 非路由缺陷——是 mock 无内容 fixture；mock 已于同日移除，该行改用 live 复测，见 §6#15 |

结论：**§5 的路由契约本身成立**，上表末行的 404 是数据层缺口而非路由缺口。

## 6. 已知问题清单

| # | 问题 | 处置 |
|---|---|---|
| 1 | ~~`posts/index.astro` 分类 chips href 指向已删除的 `/posts/category/{slug}/`~~ | ✅ **已修并实测（2026-09-18）**。修法比原记录更宽：**posts 与 resources 的「首页 + 分页页」是同一筛选契约的两份手抄件，且已经走散**——`/posts/` 读 `q`+`tag`（carry 同）、`/posts/page/[n]/` 只读 `q`+`sort`；resources 反之（index 无 `sort`，page **丢 `tag`**）。现已统一为 `q / category / tag / sort` 四键，两侧 carry 一致。chips href 改 `/posts/?category={slug}`（与 tag 参数态一致，也匹配岛内点击行为；可抓取的分类归档仍是 `/categories/{slug}/`，已在 sitemap）。实测：`/posts/` 5 个死链归零；`/posts/?category=X` 被 SSR 读到（noindex 翻转）；**区分性测试** `/posts/page/2/?category=nope` → 404 而 `/posts/page/2/` → 200，证明分页页确实读 `category`（改前会 200）。附带修正：仅带 term（无 `q`）时标题不再渲染成空的「搜索：」 |
| 16 | ~~后端完全忽略 `per_page`~~ → 实为「默认值不跟随站点设置」 | ❌→✅ **前一条是我误报，已更正；真问题已修（2026-09-18）**。<br>**误报原因**：后端注册的参数名是**驼峰 `perPage`**（`ContentController.php`），我拿 snake_case `per_page` 测，未注册参数自然被忽略。用正确名字复测：`perPage=2→2`、`5→5`、`12→12`、`20→15`、`100→15`——**`perPage` 一直是生效的**，`sitemap.xml.ts` 的 `perPage: 100` 也一直正常，上一条关于 sitemap 上限的推论随之作废。<br>**真问题**：`ContentController` 的 `perPage` 默认值是硬编码 `12`，不跟随 WP 阅读设置。已改为读 `posts_per_page`（`ContentController::defaultPerPage()`；2026-09-19 复核修订：站点设 -1「显示全部」时**映射 API 上限 100**，原「钳到 1」最偏离设置语义）；显式传值仍优先（REST arg 默认只在参数缺省时启用）。实测：站点设为 4 → 无参数请求返 4 条；恢复 10 → 返 10 条；`perPage=5` → 5 条；`perPage=100` → 15 条。phpunit 236 通过（新增 4 例）、phpstan 0 错、phpcs 无新增告警 |
| 18 | ~~前端把 `perPage` 钉死在 12，令站点设置到不了列表~~ | ✅ **已修并实测（2026-09-18，站长拍板）**。去掉了 `postsQuerySchema.perPage` 与 `resourcesQuerySchema.perPage` 的 `.default(12)`，改为 `.optional()`——**分页大小归后端决定**，前端不传就别造值；`undefined` 时 client 的 `url.searchParams.set` 自动跳过，不会出现在请求里。显式传值仍完全可用，留给自定义查询场景（首页 `client.posts({ perPage: 6 })` 与 sitemap 的 `perPage: 100` 均保留，实测 `/api/feed/posts/?perPage=4` → 4 条）。`PostLoop` 本就带可选 `perPage?: number` 且仅在truthy时拼进请求，无需改动。<br>**实测结果**（本站 `posts_per_page`=10）：`/api/feed/posts/` 不带参数 → `perPage=10`；`/posts/` 渲染 **10** 项（原 12）；`/` 首页仍 **6** 项（显式值生效）；`/resources/` 渲染 7 项 = 后端 total 7。其余 schema（comments/discussions/credits 的 20、users/favorites 的 12）**有意未动**——它们不由 `posts_per_page` 管辖 |
| 17 | 页脚次级菜单「关于本站」指向 `/posts/1/`（404） | ✅ **已修（2026-09-19，后端会话）**。定性确认：菜单 url 来自 Navigation 设置页自由填写 repeater（`PrimaryMenu::normalizeUrl` 原样放行），`/posts/1/` 是**详情路由 slug 化之前**写入的旧 ID 形态地址，纯数据问题、presenter 无 ID 形生成。已把该行改指站点现存页面 `/pages/sample-page/`，`menus/secondary` 实测返回新值。同类风险保留注明：后台自由填写的任何非 slug 详情链接后端不会改写（如需 id→slug 兼容层另行拍板） |
| 2 | `shell.css` 残留无主 `dialog::backdrop` | ✅ **已删（2026-09-18）**。实测全仓无原生 `<dialog>` 元素、无 `showModal(` 调用，现役模态仅 radix `<div>` overlay |
| 3 | `cn` 导入源为 `cn` npm 包，`components.json` 别名写 `@/lib/utils`（该文件不存在 → shadcn CLI 新增组件会生成断链导入） | ✅ **已修（2026-09-18）**。新建 `src/lib/utils.ts`（`export { cn } from 'cn'`），18 个文件的 `import { cn } from 'cn'` 全部改为 `@/lib/utils`；`components.json` 无需改动（原本就是对的，是代码侧没跟上） |
| 4 | ~~`--color-muted → --secondary` 错接~~ | ❌ **误判，结论已推翻（2026-09-18）**。`--muted` 在 shadcn 词汇里是**面（surface）**不是文字色：`bg-muted` 6 处（`parts.tsx:320,357` 的 `bg-muted/60`、`tabs.tsx:27`、`empty.tsx:36`、`alert-dialog.tsx:122`、`slider.tsx:39`）要的是浅灰底；文字色由 `--muted-foreground`（= `--body-muted` #747480）承担，接法正确。按初版建议改成 `--body-muted` 会让那 6 处变成深灰块 |
| 5 | `#e94f69`（品牌玫红）等 hex 散落 | ✅ **`shell.css` 已晋升令牌（2026-09-18）**，且为**零视觉变化**：新增 `--status-success/warning/info/danger`（告警四档 accent）+ `--spoiler-bg/-fg`（遮罩黑），`:root` 定义、`.dark` **不覆写**（原值即模式无关，mid-tone 双模式可读）。`500.astro` 的 10 处保留（独立离线页，见 §5） |
| 6 | `docs/DESIGN.md` 被引用但缺失 | ✅ **本文件** |
| 7 | 透明遮罩三套不透明度（`bg-black/50` / `rgba(15,15,20,.85)` / 已删的 `.45`） | **待收（P4 动效词汇表）**：应并为一个 `--scrim` 令牌 + 语义档位 |
| 8 | `rgba(15, 15, 20, 0.85)` lightbox 遮罩重复两处 | **待收（P4）**：`parts.tsx:408` 与 `CommunityFeed.tsx:1016` 字面重复，随 #7 一并归一 |
| 9 | `max-w-[1510px]` 重复（`AppShell.astro:152` + `Footer.astro:30`） | **待收（P3）**：页容器宽度跨文件耦合，必须同时改；应提为命名容器令牌 |
| 10 | `max-w-[380px]` 重复（`AuthDialog.tsx:93` + `AvatarDialog.tsx:141`，且前者同 className 内还有 `w-[min(92vw,380px)]`） | **待收（P3）**：同上 |
| 11 | `Spinner.tsx` 存在，但 11 处 `animate-spin` 有 10 处内联 `<LoaderCircleIcon>` 未复用它 | **待收（P3）**：收敛到 `Spinner` |
| 12 | `shell.css` 无主重复注释（smilies 双份、spoiler 双份规则） | ✅ **已并（2026-09-18）**：smilies 注释删去过期那份；`.prose-community` 与 `.aiya-comment-body` 的 spoiler 规则合并为一组选择器（特异度不变） |
| 13 | `shell.css` 中 `calc(var(--radius) - 2px)` ×2 重复了 `tokens.css:31` 的 `--radius-sm` 定义 | ✅ **已改（2026-09-18）**：改用 `var(--radius-sm)`，读数与刻度同源 |
| 14 | ~~mock 只覆壳层，覆盖不了截图基线~~ | ✅ **已由「整体移除 mock」解决（2026-09-18，站长拍板）**。原诊断：`mock.ts` 仅 101 行 / 5 条路由，`/posts/` 等内容路由全部落 404，P0 截图基线实为受阻。拍板结论：mock 是 demo 期适配、对上线项目无实际价值，不做「补 fixture」而是**整栈改为 live-only + 站点门禁**——见 §6#15 |
| 15 | 基础栈已改为 live-only + 门禁（2026-09-18） | 已落地。`mock.ts`、`dataMode()`、`AIYA_DATA_MODE`、`page.mode` 管道、四字典 `mockBadge` 全部删除，`serverClient()` 无条件指向 WP。请求路径：middleware 经进程级熔断器探活（探针即外壳所需的 `site` 调用），不可达则由 `lib/gate.ts` 返回 **503 门禁页**（`no-store` + `Retry-After: 30` + `noindex`，零组件依赖、样式内联，沿 `500.astro` 路数）——**16 个页面与全部路由文件零改动**。熔断器双 TTL（在线 10s / 失联 3s）自动恢复，仅判定翻转时记一行日志；`loadPage` 外壳失败会一手压下熔断器，消除「故障发现后仍穿透」窗口（4xx 除外，见 `isBackendOutage`）。**副作用：P0 截图基线从此必须起 Docker WP**（mock 这条免后端的路已不存在），这是拍板时接受的代价 |
| 19 | **resources 分类胶囊仍在指向已删路由**（§6#1 我自己修漏的一半） | ✅ **已补修并实测（2026-09-18）**。同一死路由家族的第三处：`resources/index.astro` 的 `chipHref()` 仍拼 `/resources/category/{slug}/`，实测 4 个胶囊（dbgcat/swtcat/tmvc/tmvp）**全部 404**——上一批我修了 posts 的胶囊与 resources 的 carry，却漏了 resources 自己的胶囊 href。已改为 query 形态 `/resources/?category={slug}`（保留 q/tag），实测两个列表页死链计数归零、`/resources/?category=dbgcat` → 200。全仓复查：仅注释里还提到该已删路由，构建产物无残留 |
| 20 | **后端重复签到把 SQL 错误打印进响应体**（aiya-core，未修） | ✅ **已修（2026-09-19，后端会话）**。`LedgerService::grant()` 的 INSERT 以 `wpdb::suppress_errors(true)` 包裹（用后即还原）：重复键是这里的**预期信号**，`last_error` 在 `query()` 内赋值、不受抑制影响，409 判定逻辑不变；被抑制的只是 `print_error` 的调试输出，真实 DB 故障仍走 `aiya_db_error` 不被吞。实测：连发两次 checkin → 200、**409 `aiya_credit_checkin_done`**，响应体无任何 SQL 痕迹（修前是 HTML+JSON、状态 200）。前端按「409 是唯一裁决」的既有改法无需再动，二次点击自动落「今天已经签到过了」文案 |
| 21 | **签到设置完全不生效：`aiya_core_opt()` 页 slug 传错**（后端，未修） | ✅ **已修（2026-09-19，后端会话，与本条诊断一致）**。`CreditSettings::read()` 三处页 slug `'sponsorship'` → `'membership'`（option 名 `aiya_core_sponsorship` 是刻意与 slug 不同，`aiya_core_opt()` 按 **slug** 查，传 option 后缀即读空）。实测：option 写 `checkin_credits=9` → `CreditSettings::read()` 返 9（修前恒落默认 true/5/30）。附带结论同本条：`aiya_core_credit` 残留行不是缺口。**教训**：早前「注册键与读取键一致」的核对只对了字段 id、漏了页 slug 这一层——两处键完全同形，反而掩盖了 slug 错配 |
| 23 | **岛 props 传函数导致整页空白**（本站自查出的真 bug，已修） | ✅ **已修（2026-09-18）**。站长报「这个页面里什么都没有」。根因：`/membership/` 把含 **9 个函数值**（`tierPrice`/`tierCycle`/`tierCredits`/`cycleDays`/`queueCycles`/`checkinGranted`/`redeemGranted`/`ledgerRemaining`/`ledgerExpires`）的 `copy` 对象当 island prop 传入。**Astro 的 island props 走 JSON 序列化，函数静默丢失**——SSR 期 props 是进程内真对象、函数可用（故服务端 HTML 完全正常），**水合后这些键变 `undefined`，React 一调用即抛错、整棵树卸载 → 空白页**。修法：改为仓内既有做法（PostLoop / ResetPasswordPanel），**岛自己 `import { t } from '@/lib/i18n'` 并按 locale 取字典**，`copy` prop 与手写 `MembershipCopy` 接口一并删除（类型改取 `ReturnType<typeof t>['membership']`，顺带消除接口与字典的漂移面）。实测浏览器：4 个岛 `hydrated: true`，游客视图与会员 6 区块齐全，签到后余额 0→5 且**账本行即时出现**（新增 `refreshLedger()`——签到响应是无 id 的 `CreditGrant`，本地无法忠实造行，故重取首页而非伪造）。<br>**教训（已写入 §7）**：我此前全部验证都只看 curl 拿到的 SSR HTML，而该 bug 在 SSR 下完全不可见——**island 相关改动必须在真实浏览器里验证水合后状态**。同类静态守卫（「岛 props 里不准出现 `=>`」）实测不可行：`categories.map((term) => …)` 这类在 SSR 期就求值成普通数组的合法写法会被误报 |
| 22 | **`/site` 未透出签到设置**（真实字段缺口，未补） | ✅ **后端已闭合（2026-09-19，形状与原提案不同）**。未走 `/site`：游客视图本就没有签到卡，公开载荷无需携带；改为 `GET /sponsorship/membership` 的 `MembershipState` **加法追加 `checkin: {enabled, credits, validityDays}`**（新 `CheckinPolicy` DTO，值即 `CreditSettings::read()` 三键）。契约快照重生成 + 前端 `checkinPolicySchema`/manifest 已同步，v1 基线未动；运行时实测会员响应带全三值。剩余动作归前端批：面板用 `membership.checkin` 显示「每天可领 N 积分」与禁用态（此前按钮恒可点、403 事后知） |

## 7. 环境注记

- **数据模式：只有 live**（2026-09-18 起）。mock 已整体移除，`AIYA_DATA_MODE`
  与 `dataMode()` 不存在。无后端可达时站点进 503 门禁（见 §6#15）。
  **唯一环境变量**：`AIYA_SITE_URL` / `AIYA_WP_API_URL` / `AIYA_API_TIMEOUT_MS` /
  `AIYA_ALLOW_LOCAL_HTTP`；本仓 `.env` 指向 `http://localhost:8000/wp-json/aiya/core/v1/`。
- **`.env` 的加载路径**：`astro dev` 经 Vite 读 `.env`（`import.meta.env`）；
  构建产物**不吃** `.env`，故 `npm start` 已补 `--env-file-if-exists=.env`。
  此前该缺失叠加 `?? 'mock'` 默认值，会让部署**静默跑成示例数据**——这是移除 mock 后
  必须一起修的真实缺陷。生产环境仍以真实环境变量为准。
- **运行依赖**：Node ≥22.12（实测 v24.20.0 / npm 11.19.0）；
  `npm run verify` = `astro check` + `vitest run` + `astro build`。
- **基线实测（2026-09-18）**：`astro check` 0 errors；vitest 9 文件 / **174 tests 全绿**
  （167 − 3 mock + 10 gate）；`astro build` 成功（仅有既存的 chunk >500 kB 提示，与本次改动无关）。
- **门禁实测（2026-09-18，用临时桩后端跑通全周期，桩已删除）**：后端缺失 →
  全部 HTML 路由 **503** + `cache-control: private, no-store` + `retry-after: 30` +
  `x-robots-tag: noindex`；后端上线 → **1s 内自动放行**（无需重启）；后端被杀 →
  发现故障的那次请求返回 502 降级壳，**其后每次请求进门禁**（原理上无法消除这一次：
  不问后端就不知道它已死）；`/api/*` 与含点路径（`robots.txt`/`sitemap.xml`/静态资源）
  **不受门禁拦截**；`robots.txt` 随可达性双向切换（`Disallow: /` ↔ 允许列表）；
  整场会话日志只出现 **1 次** unreachable + **1 次** reachable（仅判定翻转时记录）。
- **初版 §7「同步缺口」已消解**：初版记载「本副本缺失全部 `.ts` 文件（0 个）及
  `BaseHead.astro`、`.env.example`，dev/build 均不可运行」。**2026-09-18 复核为不成立**——
  `src/` 下 60 个 `.ts`、`BaseHead.astro`、`.env.example` 均在位，构建全程绿。
  该记载应属另一份不完整副本的审计结果，本副本无此问题。
- **git**：`front-station/` 目前**不是 git 仓库**（无 `.git`），因此本迭代没有
  commit 级回滚点，改动前请自行留档。
- **island 改动必须做浏览器验证（2026-09-18 教训，代价是一次空白页）**：
  Astro 的 island props 走 **JSON 序列化**，**函数会静默丢失**——SSR 期 props 是
  进程内真对象、函数可用，服务端 HTML 因此完全正常；水合后这些键变成
  `undefined`，React 一调用就抛错并**卸载整棵树 → 页面空白**。所以
  **curl / SSR HTML 检查对这类 bug 完全免疫**。规矩：岛屿的文案与格式化
  一律由岛自己 `import { t(locale) }`（PostLoop / ResetPasswordPanel 的既有
  做法），props 只传可序列化数据；凡改动 island，**用浏览器确认水合**
  （判据：`astro-island` 上的 `ssr` 属性已被摘除 → `hydrated: true`，
  且交互一次看状态变化）。详见 §6#23。
- **验证工具坑（2026-09-18 实测，务必注意）**：本工作区的 `grep` 实为
  **ugrep 7.8.4**，对**纯字面量且含 `=` / `"` 的模式会静默返回 0 匹配**，
  而带字符类（`[a-z0-9]`）的模式正常。实测：`grep -o '/membership/'`、
  `grep -o 'href="/membership/"'` 均为 0（`-F` 固定串同样为 0），
  而 `grep -o 'membership'` 正常计数。**后果**：用字面量模式统计「死链是否归零」
  会得到假的 0，把「没验到」当成「已通过」。**凡是字符计数/存在性验证，
  一律改用 `python` 或带字符类的模式**；本文档 §5/§6 中所有结论已按此复核过
  （例：`/posts/` 分页 href 实测确为 0，`/membership/` 顶部入口的
  active 态与「不在侧栏/TabBar」均由 python 计数确认）。
  另：`netstat | grep -c` 在本环境亦偶发少计，别用它判定端口/进程数。

## 8. 修订记录

| 日期 | 变更 |
|---|---|
| 2026-09-17 | 初版：全量扫描 + 四根因 + P0–P5 路线图 + 路由审计 |
| 2026-09-18 | 复核修订并落地 P1 部分：① §1 全部计数按实测重写（源文件 91→157、gap/圆角/阴影/hex/max-w 逐项更正）；② §6#4 判为**误判并推翻**（`--muted` 是 surface 非文字色）；③ §6#2/#3/#5/#12/#13 修复落地；④ §5 修正 `/500` 描述并补 HTTP 级实测验证表；⑤ §7 旧「同步缺口」判为不成立并消解；⑥ 新增 §6#7–#11 五项新发现；⑦ **新增 §6#14：mock 只覆壳层，P0 截图基线实为受阻**，并据此修正 §7 的 mock 表述 |
| 2026-09-19 | **后端闭合日（后端会话）**：① §6#17 数据修复——「关于本站」菜单行改指 `/pages/sample-page/`，presenter 核实无 ID 形生成；② §6#20 修复——`LedgerService::grant()` INSERT 以 `suppress_errors` 包裹，重复签到回归干净的 409（实测响应体无 SQL 痕迹）；③ §6#21 修复——`CreditSettings::read()` 三处页 slug `'sponsorship'`→`'membership'`，实测 option 写 9 读回 9；④ §6#22 后端闭合——改走 `MembershipState.checkin`（`CheckinPolicy` DTO，快照 + 前端 zod 同步，v1 未动），非原提案的 `/site` 形状；⑤ §6#16 措辞更新——`posts_per_page=-1`（显示全部）由「钳到 1」修正为映射 API 上限 100。另：HEAD 层 `wp_render_img_auto_sizes_contain_css` 空操作裁剪已在后端修正为 6.9+ 双段式两行摘除（壳页 `<style id="wp-img-auto-sizes-contain-inline-css">` 泄漏归零，详见 aiya-core `HeadlessModule::stripFrontendHead()`） |
| 2026-09-18（七） | **前端去门禁判断 + 后端设置错配查明**（站长定性）：① 删掉签到「今日已签」的前端预判（`hasCheckedInToday`/`dateInTimezone` 及其 5 例单测）——前端不为接口做门禁判断，409 是唯一裁决；§6#20 改记为「补丁落后端 DTO 层」。② §6#21 重写：`aiya_core_credit` **不是缺口**（残留行、无代码读取），真 bug 是 `CreditSettings::read()` 用 `aiya_core_opt('sponsorship', …)` 传了**不存在的页 slug**（真实 slug 是 `membership`，option 才是 `aiya_core_sponsorship`），三处读取全部落空 → 签到设置永不生效。已实证（写 9 读回 FALLBACK，按 `membership` 读回 9），修法为一字之差，按划定留后端会话 |
| 2026-09-18（六） | **`/membership/` 落地：内容层之外的第一块业务域接线**（站长划定：只做前端，后端归另一会话，仅在真实字段缺口时动后端）。积分账本、档位定价、签到、兑换、收银台五个面收敛到单一入口；5 个同源代理、`lib/membership.ts` 纯逻辑（含站点时区一日判定）、四字典 52+11 键、10 例单测。全路径实测：游客视图 2 区块 + 定价、登录后 6 区块、签到 200 且账本落 `source=checkin/ref=当日`、重复签到被预判挡住、收银台拿到真实易支付 `submitUrl`、爱发电未绑方案 422 命中字典、三个写代理未登录 401。新增 §6#20（后端重复签到泄漏 SQL 且状态错为 200）、§6#21（孤儿选项行）、§6#22（/site 缺签到设置字段）三条后端侧发现，均按划定未改 |
| 2026-09-18（五） | **分页大小归后端 + resources 胶囊补修**：站长拍板去掉 `postsQuerySchema.perPage` / `resourcesQuerySchema.perPage` 的 `.default(12)`（改 `.optional()`），前端不传即由后端按站点设置决定，显式值仍供自定义查询使用；§6#18 关闭，实测 `/posts/` 10 项、首页显式 6 项、`perPage=4` 仍生效。另发现并补修 §6#19：resources 分类胶囊是同一死路由的第三处（上一批修漏），现两列表页死链归零 |
| 2026-09-18（四） | **`per_page` 误报更正 + 后端默认值修复**：§6#16 前一条结论（「后端忽略 per_page」）系我用错参数名（`per_page` ≠ 注册名 `perPage`）所致的**误报**，已推翻并重写；真问题（默认硬编码 12、不跟随 `posts_per_page`）在 aiya-core `ContentController::defaultPerPage()` 修复并实测。新增 §6#18：前端 zod `.default(12)` 把 perPage 钉死，是后端新默认生效的前置条件，代价为列表 12→10，留待拍板 |
| 2026-09-18（三） | **后端上线后跑完 live 全路由矩阵**（32 路由 × 真实 slug）：全部符合 §5 契约；5 处 `page/[n]/` 404 经核对**均为正确行为**（resources 7 条 / pages 3 条 / board 13 条 / m4guide 0 条，totalPages 均为 1，越界即 404）。据此关闭 §6#1（post/resources 筛选契约统一 + chips 死链归零，含区分性实测），新增 §6#16（后端忽略 `per_page`）与 §6#17（页脚 `/posts/1/` 死链，属后台菜单数据） |
| 2026-09-18（二） | **基础栈重设计（站长拍板）**：mock 整体移除、改 live-only + 站点门禁。新增 §6#15 与 §7 门禁实测段；§6#14 关闭。副作用如实记录：**P0 截图基线从此必须起 Docker WP**。新增 `lib/reachability.ts`（可注入熔断）、`lib/gate.ts`（纯门禁文档）、`lib/aiya/health.ts`（进程级单例）；删除 `lib/aiya/mock.ts` 与 `tests/mock.test.ts`；`npm start` 补 `--env-file-if-exists=.env` |

**复核命令**（复现 §1 的计数）：

```bash
find src -type f | wc -l                        # 157
find src -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn
grep -rn "gap-[0-9.]*" src --include=*.astro --include=*.tsx | grep -v "components/ui" \
  | grep -o "gap-[0-9.]*" | sort | uniq -c | sort -rn          # gap 分布
grep -rn "#[0-9a-fA-F]\{3,8\}" src --include=*.astro --include=*.tsx   # 仅 500.astro 命中
npm run verify                                   # astro check + vitest + build
```
