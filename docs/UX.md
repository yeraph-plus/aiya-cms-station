# front-station — UX 交互闭合规范

> **定位**：本文件是前端「UX 逻辑与 UI 样式统一」的唯一判据源——什么场景用什么
> 反馈通道、表单怎么布局、卡片长什么样、弹层在小屏怎么排、移动端壳怎么组织，
> 全部以这里为准。分工：视觉令牌与元件收敛路线在 [`DESIGN.md`](./DESIGN.md)；
> 架构分层与实现分布见 [`README.md`](../README.md)；三文件互相引用，职责不重叠。
>
> 2026-09-25 初版，随移动端兼容改造第一批落地。**§6 移动端壳布局合同同批兑现为
> 代码**；§1–§5 的桌面侧统一条款自本日起对新代码生效，存量偏差按 §7 迁移清单
> 分批清偿，不追溯改已上线面。

## 0. 拍板记录

| 日期       | 拍板                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | ① TabBar = 前 4 项 + 「更多」抽屉（≤5 项全直出）；② UX 规范独立成文（本文件），DESIGN.md 保持视觉层职责；③ 改造分轮：规范+壳 → 岛内审计 → UX 统一落地 |

## 1. 反馈通道矩阵

选通道只看一个问题：**「用户下一步要做什么？」**——需要就地修正输入的走内联，
需要确认危险的走 AlertDialog，只是被告知结果的走 toast，主动查看环境信息的走
Popover。

| 通道                     | 载体                                                                                                    | 判据                                                                                                       | 典型场景                                                                                         | 现状                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **toast**                | sonner（AppShell 挂载；`bottom-right` 固定在 `ui/sonner` 内，移动端经 `mobileOffset` 抬到 TabBar 之上） | 动作已发出、结果异步返回，用户**不需要停留在原地修正**；或无表单上下文的拦截                               | 点赞/收藏/评分结果、Aria2 推送、图片上传失败、社区操作失败、游客触发登录动作的拦截               | ✅ 在用；API 错误文案经 `toastApiError` 门面（2026-09-25 落地） |
| **内联 alert / status**  | 表单内 `role="alert" text-error` / `role="status"`，紧邻提交控件                                        | 用户**需要就地修正**：字段校验、服务端拒绝且原因与输入相关                                                 | 登录失败、设置保存失败、解锁失败、兑换码错误                                                     | ✅ 在用                                                         |
| **Dialog / AlertDialog** | `ui/dialog`；行内破坏性操作确认 = `ConfirmPopover` 锚定气泡                                             | ① 破坏性或不可逆操作**必须先确认**（行内动作用确认气泡，模态确认留给全局性操作）；② 需要成块输入的复杂操作 | 登录/注册、发帖、头像上传（Dialog）；删帖/删回复/删头像（ConfirmPopover——2026-09-25 统一共享件） | ✅                                                              |
| **Popover**              | `ui/popover`                                                                                            | 非模态环境信息：用户主动唤起、点外部即关、不打断阅读                                                       | 通知铃、钱包气泡、表情选择器、正文零件                                                           | ✅ 在用                                                         |
| **整页 reload**          | `location.reload()`                                                                                     | **仅限会话或 SSR 状态变更**：登录/注册成功、评论进入待审——页面新状态只能由服务端重渲染表达                 | AuthDialog 成功、CommentSection 待审提示                                                         | ⚠️ 收窄：不得用于纯数据刷新（用局部状态更新）                   |

通用判据：

- 错误文案一律 `t(locale).errors[code] ?? generic`；后端 message 永不透出（`/api` 代理契约）。错误码→文案映射的统一出口 = `lib/feedback` 的 `apiErrorCopy` / `toastApiError`（2026-09-25 落地），不许各岛自抄；有语境差的特例（如评论身份校验的措辞）允许就地 switch，但兜底行仍走 generic。
- toast 不轰炸：后端幂等 409（重复点赞/重复签到）按**成功态文案**呈现，不当错误。
- 会话变更（登录/注册/登出）的成功吐司经 `lib/feedback` 的 `flashToast` 一次性 sessionStorage 交接、reload 后由 Toaster 兑现——整页刷新会杀死当场吐出的 toast；登录失败的 toast 与弹窗内联 alert 并存（内联供就地重试，toast 补全局反馈）。
- 成功反馈优先内联（注意力还在触发点）；toast 用于注意力已离开触发点的动作（列表行内按钮、后台推送类）。

## 2. 表单规范

- 组装用 shadcn `ui/field`：`FieldLabel` **上置**；placeholder 只作格式示例，**不承担 label 语义**。禁止无 label 输入——单字段行内操作（解锁正文、搜索框、编辑器块标题）例外，可用 aria-label。
- 主按钮：移动端全宽（`w-full sm:w-auto`），`sm:` 起右对齐或行尾；**busy 态 = `disabled` + Spinner**，杜绝双重提交。
- 错误展示统一为**表单级**：提交失败在提交控件上方/表单底部一条内联 `role="alert" text-error`；不做逐字段红字（服务端错误码是表单级的，前端无字段级映射）。
- 成功展示 `role="status"`；会话类成功走 reload（§1）。
- 原生控件逃逸清零：裸 `<select>`、裸 `<input type="checkbox">` 迁回 ui/ 零件（§7）。**功能性密集控件豁免**（2026-09-25 审查批定档）：下载文件表格的多选框、aria2 配置预设下拉——密集表格里逐行 Radix 化收益低，保留原生但必须带 `aria-label`。
- 正例：`AuthDialog` / `SettingsPanel` 的 Field 用法。

## 3. 卡片与面板配方

- 统一配方：`rounded-lg border border-border bg-surface` + 内容内距 `p-4`（紧凑 `p-3`）；可点击卡片加 `transition-colors hover:border-body-muted`。手写层**不再各写各的**，也**不再引用 `ui/card` 出厂默认**（其本地化见 §7）。
- **阴影三档**（沿 DESIGN.md §4）：`shadow-none` 静止面（卡片默认无阴影）/ `shadow-sm` 悬浮面（下拉、气泡）/ `shadow-md` 浮出层（toast、返回顶部、灯箱）。新增阴影必须能报出档位。
- **圆角刻度**：`--radius` 6px 系（`rounded-md`/`rounded-lg`）；`rounded-full` 仅限 chip、头像、圆形按钮；`rounded-xl` 禁止逸出 `ui/`（DESIGN.md P3 守卫）。图上元素（广告角标底、缩略图删除钮）的黑底白字不属于遮罩体系，豁免。
- chip/徽章：导航性 chip（分类、板块）统一 `rounded-full`；计数/状态徽章用 `rounded`。
- 共享件：字母回退头像现散落 7 处手写 → 收敛为共享 Avatar（§7）。

## 4. loading / 空态 / 焦点态 / 遮罩

- **loading 唯一习语 = `Spinner`**（`islands/Spinner.tsx`）：容器级加载 = Spinner（+可选 label）居中；按钮内 = 内联 `<LoaderCircleIcon className="animate-spin">`（按钮不需要带 label 的 Spinner，不算违规）；列表刷新可叠加容器 `opacity-60`，但不得以其为唯一指示。散落的孤立内联转圈收敛到 Spinner（DESIGN.md §6#11）。
- **空态唯一习语 = `ui/empty`**；SSR 页面级空/错误态用 `PageState.astro`。手写虚线框（约 10 处）为迁移项。
- **焦点态双轨**（有意约定，勿「统一」）：ui/ 零件自带 ring 体系不动；手写层可聚焦控件统一 `focus-visible:outline-2 focus-visible:outline-focus-blue`。手写层禁用 `focus:border-*` 冒充焦点环。
- **遮罩两档令牌**（落地随 DESIGN.md P4）：`--scrim-modal`（模态遮罩，≈ `black/50`）与 `--scrim-immersive`（沉浸遮罩：灯箱、全屏编辑器，`rgb(15 15 20 / 0.85)`）；现状四套不透明度归一到这两档。

## 5. 弹层移动端形态

- **表单类 Dialog**（登录/发帖/头像/会员）：小屏近全宽——`w-[min(92vw,<设计宽>)]`（AuthDialog 的 `w-[min(92vw,380px)]` 是正例）；高度上限统一 `max-h-[85svh]`（svh 单位，勿混 vh）。
- **信息类 Popover**：锚定维持，宽度一律加 `max-w-[calc(100vw-2rem)]` 防小屏溢出；`collisionPadding: 16` 已是 `ui/popover` / `ui/dropdown-menu` / `ui/select` 三个原件的默认值（2026-09-25 批次 3 落地），弹层与小屏视口边缘永远留 16px。
- **触摸目标 ≥ 44×44px**：图标按钮用 `size-10` 起步或补 padding（44px 行高是桌面侧栏既有先例）。
- **动效**：120ms 微交互 / 200ms 弹出层 / 300ms 页面级，统一缓动——令牌 `--duration-fast/base/slow` + `--ease-standard` 已建（批次 6）；**`prefers-reduced-motion` 全局豁免已落**（tokens.css 全局块 + 返回顶部 JS 顺从），逐点 duration 归一随 P3 调用点推进。

## 6. 移动端壳布局合同（2026-09-25 同批兑现为代码）

- **断点词汇表**：壳层桌面/移动双壳切换的唯一断点 = **992px**（`min-[992px]:` / `max-[991px]:`）；岛内自适应使用标准刻度 `sm:`(640) / `lg:`(1024) / `2xl:`(1536)。两条实测禁令：
  1. 禁用 `lg:` 做**壳**切换——992–1023px 区间会双壳全隐（历史事故，README 在册）；
  2. 禁用 `min-[1440px]:` 任意断点——Tailwind v4 实测不生成，用 `2xl:`。
- **双壳并存模式**：desktop/ 与 mobile/ 两套壳同时在 DOM、纯 CSS 切隐显；壳交互一律**委托式原生 `<script>`**（document 级监听 + `astro:after-swap` 重放），**shadcn 零件不得进入壳层**。同一岛屿双壳各挂一实例时必须做可见性去重（UserCenter 先例）。共享触发点的委托脚本（如暗色切换）全页只挂一份。
- **TabBar**：底部固定五槽 = 主菜单**前 4 项 + 「更多」**；主菜单 ≤5 项时全直出、不设更多。图标+文字（图标走 `item.icon` → URL 形状 fallback，与桌面侧栏同源解析）；激活态 `aria-current="page"` + `text-primary`；`env(safe-area-inset-bottom)` 底部安全区；触摸目标 ≥44px。
- **MobileTopBar**：sticky h-14 = 站名（左）+ 搜索切换 + 暗色切换 + UserCenter（右）；搜索按钮展开全宽搜索行，提交 `searchHref(key, 'all')` → `/search/{key}/`（`all` 范围，v1 无范围选择）。
- **抽屉（MobileMenuDrawer）**：完整主菜单树（子项缩进，`<details>` 折叠沿桌面侧栏手法）；**非模态**——遮罩点击关闭、Escape 关闭、路由换页自动关闭；开合 = data 属性 + CSS 过渡，关闭态 `inert`；次级菜单维持页脚入口。
- **PendingBanner 退役**：`shell.mobilePending` 字典键随组件一并删除。

## 7. 迁移清单（现状 → 目标）

对照点已入 DESIGN.md §6 的不重复列；此处只收 UX 判据新增的偏差。**2026-09-25 批次 4 清偿 #1/#2/#6/#7/#10/#11**（见 README 批次记录），余项按批次清偿：

| #   | 偏差                                                                                                                      | 判据出处 | 状态                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------- |
| 1   | ~~无确认对话：删帖/删回复/删头像一键直执行~~ → `ConfirmPopover` 共享件（CommunityFeed 两处 + AvatarDialog 移除头像接入）  | §1       | ✅ 2026-09-25                                |
| 2   | ~~错误码→文案映射 4 岛重复实现~~ → `lib/feedback`（`apiErrorCopy`/`toastApiError`）统一出口，6 岛 21 处调用点迁移         | §1       | ✅ 2026-09-25（裸 `fetch()` 出口统一仍开放） |
| 3   | ~~反馈通道分裂~~ → 判据全量核对：toast（异步动作结果）/ 内联（表单）/ reload（仅会话与 SSR 状态变更）三分成立，无剩余违例 | §1       | ✅ 2026-09-25                                |

| 4 | ~~表单 label 缺失~~ → CommentSection 游客两字段与 `PostEditorBlock` 标题补 `aria-label`（紧凑编辑器块按单字段例外记 §2） | §2 | ✅ 2026-09-25 |

| 5 | ~~原生控件逃逸~~ → SettingsPanel 语言下拉迁 `ui/select`（隐藏原生 select 保 FormData 语义）、AuthDialog 记住我迁新装 `ui/checkbox` + 隐藏域 | §2 | ✅ 2026-09-25 |

| 6 | ~~`ui/card` 出厂默认与站点风格冲突~~ → 原件本地化（`gap-0 rounded-lg border-border py-0`、去 shadow-sm），10 处反向覆盖清零 | §3 | ✅ 2026-09-25 |
| 7 | ~~chip 圆角两种~~ → CommunityFeed 板块章对齐 `rounded-full`（CategoryCards 的类型徽章按「计数/状态徽章」保留 `rounded`） | §3 | ✅ 2026-09-25 |
| 8 | ~~字母回退头像 7 处手写~~ → 共享 `islands/Avatar.tsx`（9 处消费：用户菜单/评论/设置/头像弹窗/社区三处/作者卡/用户中心两列表） | §3 | ✅ 2026-09-25 |

| 9 | ~~loading 三习语 / 空态三习语~~ → 内联转圈盘点全部为按钮/触发器级（合规），容器级已用 `Spinner`（DESIGN.md §6#11 结案）；空态分型：单行提示归共享 `EmptyNote`（8 处），结构化空态保留 `ui/empty` | §4 | ✅ 2026-09-25 |

| 10 | ~~遮罩四套不透明度~~ → `--scrim-modal` / `--scrim-immersive` 两档令牌，dialog/alert-dialog 遮罩与两处 lightbox 归一 | §4 | ✅ 2026-09-25 |
| 11 | ~~`max-h-[85vh]`（MembershipModal）与 `svh` 混用~~ → `max-h-[85svh]` | §5 | ✅ 2026-09-25 |
