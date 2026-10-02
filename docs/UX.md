# front-station — 交互契约

> **定位**：交互行为的唯一判据源——什么场景用什么反馈通道、表单怎么布局、
> 卡片长什么样、弹层在小屏怎么排、移动端壳怎么组织。**稳定契约：只写
> 「是什么、什么是允许的」**，不写计划、阶段与修订记录（那些一律进
> [`HISTORY.md`](./HISTORY.md)）。视觉刻度与令牌（圆角/阴影/遮罩/动效/
> 断点/卡片配方）**只在 [`DESIGN.md`](./DESIGN.md) §2 定义**，本文引用
> 不复制；架构分层与实现契约见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。
>
> **维护约定**：新交互场景先对 §1 通道矩阵选型；系统性新约定先改本文
> 再落代码，能自动执法的落 [`DESIGN.md`](./DESIGN.md) §3 守卫或专项测试。

## 1. 反馈通道矩阵

选通道只看一个问题：**「用户下一步要做什么？」**——需要就地修正输入的走内联，
需要确认危险的走 AlertDialog，只是被告知结果的走 toast，主动查看环境信息的走
Popover。

| 通道                     | 载体                                                                                                    | 判据                                                                                                       | 典型场景                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **toast**                | sonner（AppShell 挂载；`bottom-right` 固定在 `ui/sonner` 内，移动端经 `mobileOffset` 抬到 TabBar 之上） | 动作已发出、结果异步返回，用户**不需要停留在原地修正**；或无表单上下文的拦截                               | 点赞/收藏/评分结果、Aria2 推送、图片上传失败、社区操作失败、游客触发登录动作的拦截 |
| **内联 alert / status**  | 表单内 `role="alert" text-error` / `role="status"`，紧邻提交控件                                        | 用户**需要就地修正**：字段校验、服务端拒绝且原因与输入相关                                                 | 登录失败、设置保存失败、解锁失败、兑换码错误                                       |
| **Dialog / AlertDialog** | `ui/dialog`；行内破坏性操作确认 = `ConfirmPopover` 锚定气泡                                             | ① 破坏性或不可逆操作**必须先确认**（行内动作用确认气泡，模态确认留给全局性操作）；② 需要成块输入的复杂操作 | 登录/注册、发帖、头像上传（Dialog）；删帖/删回复/删头像（ConfirmPopover）          |
| **Popover**              | `ui/popover`                                                                                            | 非模态环境信息：用户主动唤起、点外部即关、不打断阅读                                                       | 通知铃、钱包气泡、表情选择器、正文零件                                             |
| **整页 reload**          | `location.reload()`                                                                                     | **仅限会话或 SSR 状态变更**：登录/注册成功、评论进入待审——页面新状态只能由服务端重渲染表达                 | AuthDialog 成功、CommentSection 待审提示                                           |

通用判据：

- 错误文案一律 `t(locale).errors[code] ?? generic`；后端 message 永不透出
  （`/api` 代理契约）。错误码→文案映射的统一出口 = `lib/feedback` 的
  `apiErrorCopy` / `toastApiError`，不许各岛自抄；有语境差的特例（如评论
  身份校验的措辞）允许就地 switch，但兜底行仍走 generic。
- toast 不轰炸：后端幂等 409（重复点赞/重复签到）按**成功态文案**呈现，
  不当错误。
- 会话变更（登录/注册/登出）的成功吐司经 `lib/feedback` 的 `flashToast`
  一次性 sessionStorage 交接、reload 后由 Toaster 兑现——整页刷新会杀死
  当场吐出的 toast；登录失败的 toast 与弹窗内联 alert 并存（内联供就地
  重试，toast 补全局反馈）。
- 成功反馈优先内联（注意力还在触发点）；toast 用于注意力已离开触发点的
  动作（列表行内按钮、后台推送类）。

## 2. 表单规范

- 组装用 shadcn `ui/field`：`FieldLabel` **上置**；placeholder 只作格式示例，
  **不承担 label 语义**。禁止无 label 输入——单字段行内操作（解锁正文、
  搜索框、编辑器块标题）例外，可用 aria-label。
- 主按钮：移动端全宽（`w-full sm:w-auto`），`sm:` 起右对齐或行尾；**busy 态
  = `disabled` + Spinner**，杜绝双重提交。
- 错误展示统一为**表单级**：提交失败在提交控件上方/表单底部一条内联
  `role="alert" text-error`；不做逐字段红字（服务端错误码是表单级的，前端
  无字段级映射）。
- 成功展示 `role="status"`；会话类成功走 reload（§1）。
- 原生控件逃逸清零：裸 `<select>`、裸 `<input type="checkbox">` 迁回 ui/
  零件。**功能性密集控件豁免**：下载文件表格的多选框、aria2 配置预设下拉
  ——密集表格里逐行 Radix 化收益低，保留原生但必须带 `aria-label`。
- 正例：`AuthDialog` / `SettingsPanel` 的 Field 用法。

## 3. 卡片与面板配方

- 配方即 [`DESIGN.md`](./DESIGN.md) §2「卡片配方」（圆角/边框/底色/内距/
  阴影三档/圆角刻度均以彼处为准），本文不复制数值。手写层**不各写各的**，
  也**不反向覆盖 `ui/card` 出厂默认**（本地化已完成）。
- chip/徽章：导航性 chip（分类、板块）统一 `rounded-full`；计数/状态徽章
  用 `rounded`。
- 共享件：字母回退头像唯一配方 = 共享 `islands/Avatar.tsx`（守卫执法）。

## 4. loading / 空态 / 焦点态

- **loading 唯一习语 = `Spinner`**（`islands/Spinner.tsx`）：容器级加载 =
  Spinner（+可选 label）居中；按钮内 = 内联 `<LoaderCircleIcon
className="animate-spin">`（按钮不需要带 label 的 Spinner，不算违规）；
  列表刷新可叠加容器 `opacity-60`，但不得以其为唯一指示。
- **空态唯一习语 = `ui/empty`**；单行提示用共享 `islands/EmptyNote.tsx`
  （带 `onClick` 时渲染为可聚焦按钮，如社区游客发布门）；SSR 页面级空/错误
  态用 `PageState.astro`。手写虚线框禁止。
- **焦点态双轨**（有意约定，勿「统一」）：ui/ 零件自带 ring 体系不动；
  手写层可聚焦控件统一 `focus-visible:outline-2
focus-visible:outline-focus-blue`。手写层禁用 `focus:border-*` 冒充
  焦点环。
- **遮罩两档令牌**（定义见 [`DESIGN.md`](./DESIGN.md) §2）：模态遮罩走
  `bg-scrim-modal`（dialog/alert-dialog/移动抽屉），沉浸遮罩（灯箱、全屏
  编辑器）走 `--scrim-immersive`。

## 5. 弹层移动端形态

- **表单类 Dialog**（登录/发帖/头像/会员）：小屏近全宽——`w-[min(92vw,380px)]`
  （命名容器 `--container-dialog-sm`）；高度上限统一 `max-h-[85svh]`（svh
  单位，勿混 vh）。
- **信息类 Popover**：锚定维持；`collisionPadding: 16` 是 `ui/popover` /
  `ui/dropdown-menu` / `ui/select` 三个原件的默认值，弹层与小屏视口边缘
  永远留 16px；宽度一律加 `max-w-[calc(100vw-2rem)]` 防小屏溢出。
- **触摸目标 ≥ 44×44px**：图标按钮用 `size-10` 起步或补 padding。
- **动效**：时长/缓动走 [`DESIGN.md`](./DESIGN.md) §2 动效令牌（微交互
  fast / 弹出层 base / 页面级 slow）。

## 6. 移动端壳布局合同

- **断点词汇表**：见 [`DESIGN.md`](./DESIGN.md) §2（壳切换唯一断点 992px，
  两条实测禁令在彼处）。
- **双壳并存模式**：desktop/ 与 mobile/ 两套壳同时在 DOM、纯 CSS 切隐显；
  壳交互一律**委托式原生 `<script>`**（document 级监听 + `astro:after-swap`
  重放），**shadcn 零件不得进入壳层**。同一岛屿双壳各挂一实例时必须做
  可见性去重（UserCenter 先例）。共享触发点的委托脚本（如暗色切换）全页
  只挂一份。
- **TabBar**：底部固定五槽 = 主菜单**前 4 项 + 「更多」**；主菜单 ≤5 项时
  全直出、不设更多。图标+文字（图标走 `item.icon` → URL 形状 fallback，与
  桌面侧栏同源解析）；激活态 `aria-current="page"` + `text-primary`；
  `env(safe-area-inset-bottom)` 底部安全区；触摸目标 ≥44px。
- **MobileTopBar**：sticky h-14 两段式 = **logo + 站名**（左，favicon
  `size-8 rounded-md`，站名 `min-w-0 truncate`）| **搜索 + 通知铃 + 用户槽**
  （右，`size-10` 图标钮）。搜索钮弹出**模态框**（`MobileSearch` 岛，内部
  复用桌面 `SearchBox` 零件：范围 Select + 关键词，提交 `/search/{key}/`；
  结果页由壳播种关键词与范围）。**用户槽未登录 = 头像占位钮直调登录
  模态框**（注册不设独立顶栏入口，登录框内切换；`registrationOpen` 关闭时
  注册态随之隐藏），登录后 = 头像菜单（钱包走「我的」钱包 Tab，移动顶栏
  不设积分 chip）。暗色切换不在移动顶栏——移动端跟随 `/site` 默认涂装，
  手动切换入口归设置域（桌面头部图标钮保留）。
- **抽屉（MobileMenuDrawer）**：完整主菜单树（子项缩进，`<details>` 折叠
  沿桌面侧栏手法）；TabBar「更多」**toggle 开合**；左侧滑出面板
  （`w-[280px]`），**显示层级在顶部导航栏之下**——遮罩 `z-20`、面板
  `z-[25]`，均低于顶栏 `z-30`，抽屉从顶栏底下滑出且顶栏始终浮在其上，
  因此**面板不设站名标题与关闭钮**（内容顶部预留外边距让出栏投影区）；
  关闭多路 = 遮罩点击 / Escape / 路由换页 / 再点 toggle；关闭态 `inert`；
  次级菜单维持页脚入口。
- **岛屿渲染期不许碰浏览器全局（全岛常驻判据）**：岛屿先在服务端渲染再
  水合，渲染路径（组件体、`useState` 惰性初始化函数、`useMemo`）里出现
  `document` / `window` / `localStorage` 就是服务端 `ReferenceError`；异常
  发生在流中途，响应当场截断——表现为「所有岛组件都失效」，且匿名访问
  完全正常（极难排查）。访客态一律由壳层在服务端解析后**当 prop 传进岛屿**
  （`UserMenu` 的 `user.softNsfw` ← `lib/nsfw.ts` 读 cookie，先例即修复）；
  cookie 是服务端状态，壳是唯一读点。浏览器全局只允许出现在 `useEffect`
  与事件回调里，`tests/island-ssr.test.ts` 常驻执法。
