# front-station — 历史档案（HISTORY）

> **只读档案**：本文件收容前端迭代史的逐批记录与已关闭的审查台账。现行约定
> 不在这里——架构与实现约定见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)，视觉
> 规范见 [`DESIGN.md`](./DESIGN.md)，交互判据见 [`UX.md`](./UX.md)，项目
> 介绍与部署见 [`../README.md`](../README.md)。各附录为退役时的原文机械拷贝
> （未按现状订正，细节可能落后）；需要改动前原文时经 git 历史取回。

## 一、迭代批次档案（2026-09-10 → 2026-09-25，原 README「阶段计划」节）

> 以下为历史迭代记录（细节可能落后于现状，如详情路由已从 `[id]` 改为
> `[slug]`——0.75.0 拍板）；当前状态以 `aiya-core/docs/ROADMAP.md` 与
> `aiya-core/src/Api/Contract/` 为准，本节只读不更。

1. **基建（已落地）**：脚手架、契约重塑（对齐后端 0.29.0：线程形 Discussion、
   `{gated, canSeeLinks, items}` 附件、评论/通知/赞助/users-me/收藏全组；Topic 与
   `tweet`/`issue` 已删）、i18n、BaseHead/JSON-LD/sitemap/robots、数据层扩展。
2. **页面框架（已落地）**：`loadPage` 装配器（site/menu/session 并行 → locale 解析
   → 两级降级）、ClientRouter + 纯 vanilla 壳（sidebar-07 视觉的 Astro 复刻：折叠
   图标侧栏、汉堡按钮、原生 dialog 认证、details 下拉、底部五项移动导航）、同源
   认证代理 `/api/auth/login|register|logout`（岛内请求必须带尾斜杠——
   `trailingSlash: 'always'` 会把无斜杠 POST 301 成 GET）。
3. **逐页接线（进行中）**：路由契约已定——详情 `/posts/[id]/`、分页 `/posts/page/[n]/`
   （≥2，首页即 `/posts/`）、分类 `/category/[slug]/(+ /page/[n]/)`，全部路径化；
   **批次 A 已落地（2026-09-11）**：`/pages/[id]/`（与文章共用投影，`type` 枚举
   放行 `page`）、`/profile/{slug}/` 公开主页 + `/profile/me/` 个人中心（Bearer
   SSR；访客 302 回首页；`/users/me` 尚无 slug，公开主页互通待后端补字段）、
   `/community/` + `/community/page/[n]/`（query 筛选 + 路径分页）+
   `/community/[id]/` 只读详情；sitemap 增 pages/discussions 枚举。
   **契约修正**：DiscussionDetail 的快照/zod/冻结锁由 `contentHtml:string`
   改为 `content:{format,html}`（wire 自 0.26.0 即如此，快照反射覆盖表此前
   漏了该 DTO）。批次 B（2026-09-11 已落地）：`/settings/`（资料/密码/头像
   三表单岛 + `/api/account/*` 代理）、`/reset-password/`（申请/校验/重置
   三态岛 + `/api/auth/password-reset/*` 代理；域名白名单在 Security 页，
   未配置时后端回落 WP 源站）、`/profile/` 个人中心（收藏 + 关注 + 公开页
   入口）、公开主页改为**文章列表**（`GET /posts?author={slug}`，后端新增
   author 过滤），`Author`/`UserProfile` 契约增 `slug`（user_nicename，公开
   路由键，系统生成）；follow 组五方法入 client；`loadPage` 有会话 cookie
   时整页走访问者 bearer（修 `/users/me*` SSR 读）。e2e：注册 → 改资料 →
   关注 → 重置密码（validate/reset/新密码登录/旧密码 401）全通。
   **批次 C 已落地（2026-09-11）**：文章详情加 `LikeButton` 岛（POST like
   代理，IP 去重）与 `CommentSection` 岛（SSR 首页 + GET 代理加载更多 +
   登录-only Composer，held 态提示、guest 走 `aiya:open-auth` 桥）；社区写
   操作全开——`/community/new/`（CreateThread 岛，guest 登录门）、详情页
   `ReplyComposer` + `ThreadActions`（inline 编辑/关闭/删除，AlertDialog
   确认，can* 旗标全部服务端下发）；写代理六件（comments/like/discussions/
   replies）。**修复**：`lib/wp-env.ts` 的 `process.env` 直读在浏览器 bundle
   抛 ReferenceError，导致引用 `lib/media.ts` 的岛（CommentSection）全量
   加载时水合即崩——已加 `typeof process` 守卫。批次 B/C e2e 均以浏览器
   实测（发帖→回复→评论→点赞，含管理按钮组）。
   **posts 列表/分页/详情/分类已接线并 live 验证**（PostCard/Pagination 零件、
   分类 tabs、搜索 `?q=` noindex、view 计数代理 `POST /api/content/[id]/view/` +
   详情页 keepalive beacon、正文 `safeContent` + `/media/` 隐身、Article/Breadcrumb
   JSON-LD）。设计规格见本仓 `docs/`（DESIGN.md 视觉令牌、UX.md 交互/布局合同、LAYOUT.md 页面结构存档）。
   **批次 D 已落地（2026-09-12，全量审查 + 收尾）**：`/resources/` +
   `/resources/page/[n]/` + `/resources/[id]/`（ResourceCard 变体、resource_category
   筛选、评论岛与 view beacon 复用；附件面板等 ExternalFiles 域重开后补、like 按
   计数作用域不适用）；首页真实化（最新文章/资源/社区三 feed 并行 allSettled、
   单 feed 失败只隐藏该板块、`websiteJsonLd` 接线、BaseHead 空 title = 裸站名）；
   FavoriteButton 岛 + `/api/account/favorites/`（POST/DELETE）代理、profile 增
   followers 页签。**同批修复审查发现**：重置密码 `key` prop 被 React createElement
   吞掉（P0，改名 `resetKey`，找回密码闭环恢复）；改绑邮箱 `currentPassword` 被
   zod 剥离（profileUpdateSchema 补字段，403 再认证链路 e2e 实测）；双壳 UserCenter
   双实例同听 `aiya:open-auth` 弹两个 Radix 对话框（按可见性去重）；重置失败落
   "saving" 卡死（Status/errorCode 拆分）；全部代理错误响应带机器码 `code`、
   ZodError 统一 400、authClient 去掉 localhost 隐患回退与无条件 HTTP 放行、
   重置链接 origin 不再回退 Host 头、头像上传 5MB/图片类型预检、评论头像在
   代理侧重写（客户端拿不到 WP origin）、like 代理转发会话 token、媒体代理
   Content-Type 白名单 + 200 才发长缓存 + 条件请求转发、`post.seo` 消费、
   og:image 绝对化回归修复、JSON-LD 不泄 WP origin、搜索/社区翻页携带筛选参数、
   侧栏 `lg:` → `min-[992px]:flex`（992–1023px 导航消失）、路由进度条补
   ClientRouter 事件驱动、back-to-top 隐藏态不可聚焦、面包屑 aria-current 仅
   末位、sitemap 并行枚举 + 补分类/资源 + robots 声明 Sitemap + 爬虫端点
   `public, max-age=300`。
   **批次 E 已落地（2026-09-13）：通用 feed 岛**——`PostLoop`（文章 loop 岛，0. 批次 G 起 chips 直接收进岛内 props，原 TermFilter 岛与 `aiya:feed-filter`
   事件桥已删）+ 同源 `GET /api/feed/{posts|resources}/` JSON
   端点，通用于主循环、分类页、作者页、资源页（八个列表路由已重接）。架构
   分工（拍板）：**Astro 拥有参数解析、初始请求、路由形状与设计参数**——页面把
   `route`（index 路径 + `pagePattern` 的 `{page}` 槽 + `carry` 查询白名单）、
   `query`（当前筛选态）、variant/columns/showTags 等作为 props 传岛；**岛只
   负责渲染与交互**——换页/筛选经同源 feed 端点即时更新，随后
   `history.pushState(history.state, url)` **克隆 ClientRouter 的历史状态**推进
   URL，后退/前进完全由 ClientRouter 的 popstate 全量 SSR swap 接管（岛不监听
   popstate，无双处理；router.js 的 onPopState 对 state === null 的外来条目
   直接忽略，克隆条目带 astro index 故按正常导航处理，已实测）。筛选 chips 是
   真实 `<a>`（可爬取、无 JS 时由 ClientRouter/浏览器接管），岛内托管时才
   preventDefault 就地筛选；每个 chip
   携带它所代表状态的 route 形状（如分类筛选激活后分页 URL 落在
   `/category/{slug}/page/{page}/` 而非 `/posts/page/{page}/`，筛选重置页码）。
   **媒体掩蔽边界**：`lib/media.ts` 新增 `cloakPostSummaryMedia`——初始 SSR
   props 与 feed 端点响应共用同一掩蔽（缩略图 + 作者头像），岛内不做客户端
   改写；未经掩蔽的 DTO 不得直接传岛（实测曾泄漏 WP host）。卡片的 React
   渲染镜像 PostCard.astro 的 row 形状（grid 变体内置，`columns` 控制；.astro
   卡片仍服务首页等纯 SSR 面）。社区列表（DiscussionCard）沿用旧路，待后续
   以同模式接入 discussions feed。
   **批次 F（2026-09-13）：loop 卡重设计 + 视图切换**——`PostLoop` 增列表/卡片
   布局切换（`defaultView` 设计参数给初值，访客选择写 localStorage
   `aiya-loop-view` 全站共享，effect 内读取避免水合失配；切换按钮
   aria-pressed + sr-only 文案）；卡片 = 无外边距首图（列表模式左侧
   `self-stretch` 贴满卡高、固定 200px 宽；卡片模式顶部 `aspect-video`，移动
   端 `h-[180px]` 固定占位防加载零高抖动；注意 Tailwind v4 任意断点
   `min-[1440px]:` 实测不生成，五列用标准 `2xl:`）+ 右/下三行信息：徽章
   （sticky/password/private，契约 `badges`）+ 首分类 + 标题；摘要
   `line-clamp-2`；头像+作者名、类型徽签（文章/页面/资源）、浏览、评论、
   **按计数作用域切换点赞/评分**（resource 显示**黄色五星**——10 分制逐颗
   折算：满 2 分记一整星、余 1 分记半星（单星渐变填充，useId 保证引用
   id 唯一）、空星补齐 5 颗；屏上无数字、人数走 title 提示，无评分为五颗
   灰星）。**契约加法演进（v1 政策首例）**：后端 `PostMetrics` 增
   `ratingScore`/`ratingCount` 可空字段（presenter 读 `rating_score`/
   `rating_count` 协议键，缺失为 null；139 tests / 320 assertions + phpstan
   全绿），快照重新生成同步前端，`postMetricsSchema` 补齐。首页文章/资源段
   改用 PostLoop（静态单页 pagination，feed 永不触发）；PostCard.astro/
   ResourceCard.astro 退役删除——loop 卡设计此后只有 FeedCard 一个事实源。
   **批次 G（2026-09-13）：loop 工具栏合并 + 卡定高**——筛选 chips 收进
   `PostLoop` 的可选 `chips` prop，与视图切换按钮合成**一行工具栏**
   （chips 居左、切换居右 `ml-auto`；无 chips 时切换仍右对齐），TermFilter.tsx
   与 `aiya:feed-filter` 桥删除（筛选与 loop 同岛，无跨岛通信）；列表模式卡
   **锁定高度 `sm:h-[132px]`**——行一不再换行（徽章/分类 shrink-0、标题
   `truncate`）、行三 `flex-nowrap overflow-hidden`，整列表等高一致，超出裁剪；
   徽章与分类字号放大（text-[10px]/[11px] → text-xs，徽章图标 size-3）。
   **`showViewToggle` 设计参数**（默认 true）：纯展示段（首页各 feed）关
   闭切换行——每段一个岛实例各自渲染按钮行会吊在段头下形成孤行，首页两段
   已传 false，访客偏好仍由任一完整列表页写入后全站生效。
   **批次 H（2026-09-13）：标签归档路由补齐**——自派生路由计划（分类/标签/
   作者）至此收齐：`/tag/{slug}/` + `/tag/{slug}/page/{n}/`（PostLoop 渲染，
   术语 name/404 校验走 `/terms?taxonomy=tag` 一处取；后端 `/posts` 列表补
   `tag` 查询参数——ContentQuery tax_query 多腿 AND，category+tag 可叠加）。
   入口：文章详情标题下 tag chips（`/tag/{slug}/` 链接）；sitemap 增 tag 归档
   枚举；`postsQuerySchema`/feed 端点透传 tag。作者页/分类页此前已落地。
   **批次 I（2026-09-13）：作者路由合并**——`/profiles/{slug}/` 并入
   `/profile/{slug}/`：`/profile/me/` = 登录用户的用户中心（静态路由天然
   优先于 `[slug]`；`me` 为保留字，公开页 loader 对其显式 404，防
   nicename 碰撞）、`/profile/` = 入口重定向（登录 → `/profile/me/`，游客
   → 首页）。全部页面 URL 由前端自拼（后端契约只给 `slug`），API 端点
   `/wp-json/…/profiles/{slug}` 不属页面路由、按 v1 锁保持不变。 登录用户菜单（头像下拉）全部链接切到 me 路由：用户中心/我的收藏/我的
   关注/账号设置 = `/profile/me/` + tab 深链，公开主页 = `/profile/{slug}/`
   唯一 slug 入口（文案 `shell.profile` 改「用户中心」、新增
   `publicProfile` 键）。**顺带修复后端列表可见性 bug**：ContentQuery 对
   登录（无 read_private_posts）访问者把 author 钉死为本人，登录用户看
   /posts/ 只剩自己的文章（公开列表清空）——删掉该过滤，private 附加语义
   交由 WP 核心状态 SQL 自带的自有行限定（139 tests + phpstan 绿，登录
   bearer live 实测 13 篇公开文可见）。 菜单项全部带 lucide 图标（dropdown item 默认 svg 样式），「公开主页」
   入口从菜单移除（公开页由 hub 内入口承载），退出登录改 shadcn
   `variant="destructive"`（红字 + 焦点红衬色）。账号卡横排化（批次 J）：
   两页共用 `components/content/ProfileCard.astro`——大头像居左，信息列三
   行（用户名+角色/赞助徽章、简介、ID+注册时间），最右侧 `actions` slot
   （me = 公开主页链接，公开页 = FollowButton）。**批次 K**：stats 三数据
   （文章数/被关注数/被收藏数）改为顶部行内、按钮左侧一排（无分隔线、
   卡内垂直居中），me 页同样显示（`/users/me` 加 `stats` 可空字段，
   `ProfileStats` 加 `followers`——加法演进；`FavoriteService::countForAuthor`
   聚合被收藏数，文章数走 `count_user_posts`）；信息行重排：ID+注册时间
   并入徽章行，简介第二行（空简介显示占位文案）。卡片**保留浮出大头像**
   ——128px 头像绝对定位浮出卡顶左角一半（白描边 + 阴影），根节点 mt-20
   预留浮出空间，窄屏退化为卡内 pt-24 + 竖排。
   **批次 L：排序切换占位**——无 chips 的归档（分类/标签/作者页及其分页）
   工具栏左侧放排序方向切换（`showSortToggle`，最新/最早两态按钮，
   aria-pressed），补齐分类 tab 缺位时的左侧控件；切换重置页码并以
   `?sort=oldest` 走 pushState（newest 保持无 query 的干净 URL），翻页
   carry 白名单含 `sort`，前进/后退照旧归 ClientRouter。**Select 化**：
   排序改 shadcn `Select` **位于 chips 滚动区内部**（分类 tab 行最后一项，
   随行滚动、不提升位置级别；无 chips 页照常显示），`showSortToggle`
   判断删除；非选中 chips/视图/分页按钮统一
   白底（outline + `bg-surface`，secondary/ghost 透明底观感废弃），当前页
   分页链接 primary 边框加字重。
   **封面取值收敛（批次 M）**：后端 `resolveFor` 恒返回图（`_thumb` 合成 →
   特色图 640×360 派生 → 默认占位图），feed 12 篇零 null 实测——前端删除
   `fallbackThumb` 兜底与页面 props，封面只认 `item.thumbnail`（前台不再
   参与默认图逻辑）。列表卡白条修复：定高卡内容区 130px vs 信息行 121px
   的 9px 背景露出——`<a>` 补 `h-full` 拉伸，图片铺满全高（图片下方
   间距实测 0）。后台尺寸基准：卡图 640×360、详情 featured 1000×640。
   **loop 卡外壳换 shadcn `Card` 件**（`gap-0 py-0` 覆盖保持贴边封面，
   圆角覆盖 `rounded-md` 对齐站点 6px 半径体系——Card 默认 rounded-xl
   12px 偏大），列表定高逻辑不变。
   **社区推特式重构**：（分页器已移除——底部哨兵进入视口即追加下一页
   （600px 预取 + 滚动兜底轮询，防后台标签页 IO 不触发），加载中显示
   Spinner、到底显示「已经到底了」；板块/排序切换重置回第一页）`/community/` 改为左板块列表（含每板块讨论数，
   sticky）+ 右内容流两栏；内容流顶部是**内联发布编辑器**
   （`CommunityComposer` 岛——折叠态占位点击展开标题/板块/正文表单，
   游客走登录提示 + `aiya:open-auth` 桥，发布成功 reload 让 SSR 流接住
   新帖）；状态（进行中/已关闭）筛选移除、仅保留卡片上的状态点提示；
   分页路由同步去 status；`/community/new/` 与 CreateThread 岛删除
   （编辑器即流顶组件，旧链接 404——未上线无兼容负担）。
   **社区单页化（app 式）**：整页交由 `CommunityFeed` 岛（Astro 只转发初始
   数据与接口）——**Tiptap 富文本编辑器**（starter-kit + image + placeholder，
   B/I/插图工具栏，图片经 `/api/uploads/image/` 新代理直传后端 pic-bed 管线
   并回填 `/media/…` 地址）**常驻**不再折叠；帖子**全量内联展示**（标题+净化
   正文+图片宫格+状态点，不再跳详情子页，`/community/{id}/` 路由与 sitemap
   枚举移除）；**回复在帖内折叠区**懒加载（GET /api/discussions/{id}/replies/
   新代理，内容服务端净化）+ 底部回复框，不新增子路由；列表 DTO 加
   `contentHtml`（后端加法演进 + 快照 WIRE_SHAPES 同步），`lib/community.ts`
   作为统一的净化+媒体掩蔽边界（正文去 img 留给宫格、URL 回填 /media/）；
   整页宽度收窄至 760px，板块栏 112px（约四字宽），板块切换/排序/翻页全部
   岛内客户端完成。**编辑块合并与标题可选**：标题输入并入编辑器同一视觉
   块（底部细线分隔、占位文案标注「可选」），后端 create/update 的 title
   放宽为可空（空标题渲染为正文卡、列表回退正文摘录，REST args 与前端
   zod 同步 `.default('')`）；图片上传在编辑器块底部增加动作反馈行（上传
   中显示 Spinner + 文件名，完成后光标处插入图）；板块选择默认第一个
   板块（composerBoard 与 feed 筛选分离，不再空选）。**板块栏徽章化与
   微博式卡片**：左侧板块计数改圆角徽章（选中项徽章反白），选中态由
   `bg-secondary` 改主题色 `bg-primary text-primary-foreground`；帖子卡重排
   为微博式——头像列（40px）+ 昵称行（板块徽章、编辑/删除右置），灰色
   元信息行承载状态点与日期，标题与正文/宫格缩进到昵称列，底部操作条
   （上边框分隔）左侧回复折叠钮、右侧主题色话题标签；顺带清偿 astro
   check 14 处类型债（编辑器插入图契约改由 RichEditor 收口、空标题摘录
   回退、站点回退对象补 comments、陈旧测试夹具补 badges/locked/metrics、
   页面残留的 showSortToggle/showTags 死 prop 移除）。**卡片细节调整**：
   状态字（进行中/已关闭）从卡片隐藏，板块徽章移入灰色元信息行（昵称
   行只留作者名）；卡片最外层改 shadcn `Card` 零件壳（`gap-0 py-0` 自管
   内距），列表容器 `flex gap-4` 补卡片间距；编辑/删除改带文字按钮移到
   回复折叠行右侧，**编辑表单并入折叠区**（点编辑即展开，取消/收起同步
   折叠——折叠区只呈现编辑表单或已加载回复，杜绝空 Spinner 态）；回复框
   改两行（输入框整行 + 发布按钮第二行右置不再挤压）；**上传修复**：composer
   的 `onImageFile` 曾用 `void` 包装回调丢弃 Promise，编辑器拿不到上传
   URL 不插图——改直传回调返回值，curl 全链路实测登录→multipart→图床
   落盘→`/media/` 掩蔽地址 200（Astro dev 的 `checkOrigin` 对无 Origin
   的 curl multipart 返回 403 属预期防护，浏览器同源 fetch 不受影响）。
   **列表工具栏与搜索**：「讨论区」标题+排序切换从页面顶部移至发布器
   下方即 loop 列表顶部，同行新增关键词搜索框（400ms 防抖，q 走
   discussionsQuerySchema，GET 代理补转发；board/sort/搜索跨切换保留，
   自动加载下一页同携带 q）；话题标签从操作条移到标题行下方（微博式
   主题色 hashtag），**点击标签即把闭环全段 `#标签#` 填入搜索框触发搜
   索**（q 子串匹配正文，闭环形态避免裸词误命中普通正文），操作条右侧默认
   空置（仅权限按钮出现时占用）。**删除气泡确认**：帖子与回复删除改
   shadcn Popover 气泡（正文=删除后无法恢复 + 取消/红色删除，busy 期间
   锁定开合），window.confirm 全部移除。**PostEditorBlock 通用编辑器块**：
   标题行+正文编辑器+上传反馈行收进 RichEditor.tsx 导出的单一组件，内部
   仅以 `mode: composer|edit` 区分占位文案——顶部发布器去掉外层双重
   边框（编辑块自身即边界，板块选择/发布按钮移到块下方一行），编辑表单
   同用一块，正文区补 `px-3 py-2.5` 与工具栏 `px-1.5` 对齐内距；编辑表单
   顺带放开标题必填（标题已可空）。**代理权限修复**：GET /api/discussions/
   曾恒用 serverClient（guest 上下文）——客户端刷新（搜索/排序/翻页）后
   canEdit/canDelete 全部丢失只剩 SSR 首屏正确；改为有会话时 authClient
   转发，权限与 SSR 一致（浏览器实测客户端刷新后编辑/删除按钮保留）。
   **回复区定稿（视觉与分页）**：发布器整体再套 Card 外壳（套在布局层，
   编辑块自身保留单层边框，编辑模式在帖卡内不会出现两层外边）；工具栏
   换位为「标题 → 窄排序（文案缩短为 最近/最新）→ 搜索框最右」；编辑
   模式改回**卡内直切**——点编辑原位把标题/标签/正文/宫格换成编辑块，
   编辑钮变取消，不再借用回复折叠区；回复折叠区**只装回复**：首屏渲染
   3 条，其余走「加载更多」（后端回复列固定 50/页分页、无嵌套回复——
   评论回复评论按拍板不做，加载更多先展开已取页再按 hasNext 续拉下一
   页，发自己的回复自动展开）；回复框与列表分离为独立块——岛新增
   `user` prop（SSR 传当前用户昵称+头像），左头像右输入框 + 发布键。
   **回复条数与图片宫格微调**：默认展开回复 3→5 条；图片区宽度桌面端
   收窄至约 68%（`w-full sm:w-[68%]`，移动端 100%），宫格按 1–9 图自适应
   布局——1 图 aspect-video 单幅、2/3 横排、4=2×2、5=3+2（grid-cols-6，
   首行 col-span-2 ×3 次行 col-span-3 ×2）、6=2×3、7/8 四列、9=3×3；
   后端 images 提取按 src 去重（DiscussionContent::images seen 表），
   临时 5/9 图帖实测布局后清理。**防剧透补 CSS 与图片附件条**：防剧透
   mark 此前缺渲染样式（shell.css 漏落地）导致编辑与显示两端都「无效」
   ——补 `.prose-community span[data-spoiler]` 固定黑底黑字悬停显字（双
   色模式恒定），实测编辑器打标输出 `span[data-spoiler]` 且卡片渲染为
   黑块；图片上传不再插入编辑器文档（inline setImage 曾致编辑区异常）
   ——改附件条模式：`PostEditorBlock` 内置只读缩略图行（方块 64px +
   ×移除钮 + 上传中虚线 tile），上传回调仅回传 URL 由父级收集，发布/
   保存时把附件条以 `<img>` 拼进 content（编辑表单预载帖子现有图，修
   复编辑含图帖会静默丢图的数据缺口）；编辑模式下操作条编辑按钮隐藏
   （编辑块自带取消，双取消误导）。**图片灯箱（社区）**：调研后引入
   `yet-another-react-lightbox` 3.32（React 19 peer 明确支持、零依赖、
   MIT、维护活跃；候选 photoswipe/react-photo-view 停更 1.5–2 年）——
   `ImageGrid` 图片变可点（cursor-zoom-in），帖子与回复宫格共用一个
   Lightbox 状态挂岛根部，多图时挂 Zoom + Counter 插件（x/N 计数）、
   单图仅 Zoom，关闭态保持 slides 以保留淡出动画；Esc/方向键/焦点圈
   定由库内建；图片 src 沿 `/media/` 单源无需处理。详情页正文图灯箱
   （`.prose-content` 微岛）暂缓待接。**灯箱观感调优**：`carousel.padding
'4%'` 让超屏图片只轻微缩小、四周留边（小于视口的图保持原分辨率不
   放大——Viewer.js 语义，`.yarl__slide_image` 本就是 max-w/h 封顶）；
   背景由纯黑改站点对话框同源深色半透明 `rgba(15,15,20,.85)`（styles
   container 覆盖）；`controller.closeOnBackdropClick` 点击背景直接收起。
   **社区细节收尾**：发布按钮不再检测标题（有正文或附件即可发）；工具
   栏排序切换移到搜索框左侧、标题「讨论区」加主题色气泡图标（size-5）；
   回复折叠区去掉段顶分隔线，每条回复正文改浅灰气泡（`bg-secondary/50`）
   并放宽条目间距（gap-4）。**回复输入富文本化**：回复框从 Textarea 换成
   与发帖器同款的 `RichEditor`（七键工具栏 + 图片上传 + 附件条）——
   `AttachmentStrip` 从 PostEditorBlock 抽出共用，回复附件图在提交时以
   `<img>` 拼进 content；`FeedReply` 契约同步升级：`content` → 净化后的
   `contentSafe`（`cloakReply` 过 `sanitizeDiscussionHtml`），回复渲染改
   `dangerouslySetInnerHTML`（旧纯文本回复经净化转义保留换行）。**社区
   移动端闭合**：板块栏移动端改横排
   菜单（每项前 `chevron-right` 箭头、非选中无底色纯文字悬停浅灰、主
   题色选中 + `-mx-4 px-4` 贴屏出血横滚、隐藏滚动条，sm+ 恢复竖排栏）；
   帖子卡重构为「头像/昵称/元信息首行 + 正文
   通栏在下」——移动端 32px 头像、text-sm 昵称、正文不再为头像列预留
   缩进（上一版整卡 pl-0 使头像贴边突出属误改，已回退），桌面端正文经
   `sm:pl-[68px]` 回到昵称列对齐、视觉不变；发布器与回复区内距移动端
   收窄至 px-3。**社区整体审查轮**：①静默失败治理——AppShell 全局挂载
   sonner `Toaster`（client:only="react"，主题跟随色模式），发布/回复/
   编辑/删除/上传失败统一 `toast.error(community.failed)`，删除气泡改为
   仅成功关闭（onConfirm 返回布尔）；②信息流竞态守卫——`feedSeq` 序号
   使被更新的请求（翻页追加 vs 换板块/排序/搜索）作废不再回写列表；
   ③编辑保存移除内部 `?page=1` 裸取数（会丢失 board/sort/q 上下文），
   刷新统一走父级带上下文的 `fetchFeed`；④同步并行会话的 `/site` 契约
   变更（smilies 进出 siteSchema，回退对象与夹具跟随）；⑤排查岛不水合
   ——vite 预构建缓存缺 sonner（主岛新引用，deps 404 致模块加载失败静
   默中断水合），清 `.vite` 重启 dev 解决。**表情包零件（0.62–0.64 对
   接）**：新增 `GET /api/smilies/` 代理（serverClient 读 pack 列表），
   `SmiliesPicker` 工具栏零件——笑脸钮开 Popover，pack 间 Tabs 分组、
   组内滚动网格（max-h-72），选中插入闭环 `::code::` 令牌（code 为令牌
   体，需自补双井号），URL 过 `/media/` 代理；接入三处编辑器（发布器/
   编辑表单/回复框，工具栏第一位）。**媒体代理 AC 表情包适配**：smilies
   文件名含字面 `%`（AC 混码命名），双重编码守卫与 decodeURIComponent
   的抛错路径都会 404——重命名 506 个文件为安全顺序名（a001…，py 脚
   本），代理改容错逐组解码 + `%XX` 残留序列守卫 + 字面 `%` 重编码
   `%25` 上游转发；净化器放行 `img.aiya-smilie`（exclusiveFilter 剥离
   其余 img 防宫格双渲染）。**发布/回复/编辑按钮统一**：SquarePen 组稿
   图标 + 请求中 LoaderCircle 旋转器。**表情面板二稿**：shadcn Tabs 换
   自定义轻量 pack pills（主题色选中圆角胶囊，占位远小于 TabsList）；
   表情按论坛式嵌入渲染——选择器内 64px 高自然宽大图（`h-16 w-auto`
   object-contain，flex items-end 换行），正文侧全局
   `img.aiya-smilie { height: 4rem }` 定尺寸；图片宽高不进后端契约
   （固定高渲染下仅省加载瞬间布局，暂无必要）。**资源 tag 过滤后端补
   全 + 术语图标解析**：后端（aiya-core 工作区，随并行批次走）资源类
   型的 tag 过滤此前只命中 `wpCategoryTaxonomy('tag')` 的第一个词法
   （resource_original）——`PublicType` 增 `wpTagTaxonomies()` 返回全
   部 tag 词法，`ContentQuery` 的 tag 腿改「单词法平铺、多词法嵌套
   OR」（顶层与 category 腿保持默认 AND），实测五词法命中/AND 组合/
   posts 单词法回归全过，phpunit 196/481 全绿；孤儿 term 关系
   （post 已删 count 残留）实测空结果属正确行为。前端 icon 解析——
   term 的自由文本 icon meta 经 `iconInner`（lucide-static 按名解析，
   未知名返回 null 不渲染兜底字形）落三处：`LoopChip.icon` 携带预解析
   SVG、工具栏 chip 图标+文字（posts/resources 两页构建时解析）；
   posts/resources 详情页标签 chips 图标+文字（服务端 Astro 渲染，
   inline svg 12px）。loop 岛内 CardInfo 的分类文字暂不带图标（岛内
   客户端 refetch 拿到的是 icon 文本，客户端解析需拖全量 lucide-react，
   刻意不做）。dev 库留两个演示值：m4guide=book、验证标签=tag。
   **Loop 列表移动端闭合
   与卡片高度锁定**：卡片视图（grid）列数整体升一级且不再低于两列——
   `grid-cols-2 sm:3 lg:4 xl:5 2xl:6`（旧 1/2/3/4/5 档在手机上单列退化
   为整屏 aspect-video 图片墙）；高度锁定双管齐下——标题行与摘要行各
   `min-h-10` 占满两行（有描述无描述同行同高、meta 基线对齐），meta 行
   改单行 `overflow-hidden` 裁剪并**去掉作者**（两列起卡面太窄，类型+
   浏览+评论+点赞已占满；列表视图作者保留），卡片视图标题降 text-sm
   匹配更小卡面。**列表视图移动端只显示图片的真 bug**：卡片链接恒
   `flex-row` 而图片 `w-full shrink-0`——sm 以下信息列被挤成 0 宽只剩
   图；修法保持行式不堆叠（首版堆叠修复会让移动端列表退化成卡片样式，
   已否）——缩略图改 `w-[120px] sm:w-[200px]` 满高小槽位（flex stretch
   撑高、去掉固定 h 类），手机端成紧凑「小图+文字」行、sm+ 恢复原样，
   meta 间距移动端收 `gap-x-2`；摘要移动端改单行固定高
   （`h-5 line-clamp-1 sm:line-clamp-2`，卡片视图 sm+ 仍 `min-h-10`
   占位锁高）。**行式改造引入的卡片方向回归**：改列表行式时把卡片链
   接 flex 方向写成了常量 `flex-row`，丢掉网格模式的 `flex-col` 分支
   ——网格卡片图片 `w-full` 又一次挤瘪文字列（手机端表现为巨图无字，
   且截图时值恰逢页面滚动难以直读，靠量 DOM 计算尺寸定位）；恢复
   `vertical ? flex-col : flex-row` 三元后四组合（双端 × 双视图）全部
   实测归位。浏览器实测 390/1440 双端双视图，回归
   check 0 错误 / 167 测试 / build 正常；顺带补 page.server 站点回退
   对象缺失的
   seoKeywords/seoDescription/gaId 三键（siteSchema 加法后 check 报
   错归零）。**折叠标签筛选层**：工具栏分隔线右侧、视图切换钮左边新增
   「筛选」钮（SlidersHorizontal 图标 + 文案，面板展开或有选中 tag 时
   主题色实底、aria-expanded），点开下方折叠面板列出标签分组——posts
   单组平铺（无组标题）、resources 按五个 tag 词法分组（组标题走 i18n
   vocab* 键，未知词法码回退码名；空词法整组省略），组内标签胶囊
   （bg-secondary、选中 bg-primary、再点取消，单选；icon meta 的
   lucide SVG 同步渲染）；`applyTag` 复用 fetchState 通路（query.tag
   进 fetch 参数、翻页/加载更多自动携带、URL pushState 按 carry+tag
   惯例、乐观选中态同 chips 模式）；resourcesQuerySchema 补 `tag`
   （后端本就支持）+ /api/feed 代理统一转发；两列表页 SSR 直读
   `?tag=` 深链（canonical/noindex 跟随）。E2E：资源页选/消 SWT-T1
   （1 卡 ↔ 6 卡、URL 进出 tag）、posts 单组面板选验证标签（1 帖）、
   深链 SSR 生效；check 0 错误 / 167 测试 / build 全绿。排查注记：
   dev 模式 feed 请求 ~1.7s（vite 中间件 + WP 往返），岛内交互验证
   需留足等待窗口，直连同 URL 秒回曾误判为挂起。**筛选面板二稿**：
   ①排序 Select 移出 chips 滚动区、进面板首行（「排序：」描述行 +
   最新在前/最早在前两胶囊，applySort 的 URL 补齐 carry+tag 不再丢
   上下文）；②筛选钮去文本换 ChevronDown 图标钮（size-8 与视图切换
   同款，展开时图标 rotate-180）；③清除选中改 outline 按钮（X 图标 +
   文案）放折叠钮右侧工具栏内、仅选中时出现；④面板去白卡包裹改行式
   ——「排序：」「标签：」「词法名：」描述行 + 胶囊，胶囊统一 shadcn
   Button（default/outline + size sm），与分类 chips 同族等高（32px
   实测一致）；三稿微调——面板上下 `border-y` 分隔线夹持（不再悬空
   贴列表），清除筛选按钮移到折叠钮左侧（chevron 右侧原位让给视图
   切换）；四稿——折叠钮与视图切换之间再加一条分隔竖线（随筛选钮存
   在，无筛选钮不重复）。**分类卡片增强批**：卡片名称旁补 term 图标解析（lucide，加载器
   预解析为 SVG 下岛）；字号放大——标题 text-xl、徽章 text-sm、计数
   text-sm；封面容器 max-h-64 限高（object-cover 裁切）；名称 truncate
   溢出隐藏（description 已 line-clamp-2）；/categories/[slug]/ 的
   slot 卡片外加 mb-5 下边距。排版层级——sr-only h1 保留（卡片可见名
   为 span，页面仍持唯一 h1）。
   **分类页头拆分批**：/categories/[slug]/ 详情页弃用卡片岛（卡片岛 +
   下方列表卡形成两层 UI）——页头改 Astro 直写的同款样式横幅（封面/
   渐隐/徽章+h1/计数/描述），h1 归位页头、TermArchive 增 hideTitle
   prop 去重 sr-only 标题；卡片岛仅存于 /categories/ 汇总页网格。
   **汇总页岛屿化批**：/categories/ 目录页换 CategoryCards 岛屿渲染
   （client:idle，grid 一行三列）——可复用 `CategoryCard` 同时挂到
   /categories/[slug]/ 页头（原 Astro 可见头部移除，sr-only 标题保留）；
   卡片 = shadcn Card 外壳 + 封面（无封面回退 site.defaults.thumb 默认
   预览图）+ 黑色渐隐叠层 + 横排文本（左类型徽章+标题、右计数）+ 独立
   描述行。**关键约束：岛屿 props 无法序列化函数**——countLabel 等
   locale 格式化全部在 Astro 侧预格式化为字符串（countText/typeLabel
   下沉进卡片数据），函数 prop 会在水合时变 undefined 令整岛崩溃卸载
   （实测抓到）。
   **/categories/ 一级路由批**：拍板弃用 /posts|resources|pages/category/
   嵌套归档（连同 tag 路由残留整树删除，404 不留壳）——改为统一一级
   路由：①`/categories/` 目录页——三类分类入口卡片（封面/类型徽标/
   名称/描述/计数，loadCategoriesIndex 聚合三类型 /terms）；②
   `/categories/[slug]/(+page/[n]/)` 统一分类页——`loadCategoryHub()`
   按 posts→resources→pages 优先级探测词法归属后复用 loadTermArchive
   （头部封面/标题/描述、无筛选器分页 PostLoop、描述注入 head meta
   均为既有能力），未知 slug 经 loadPage 框架构造 404 视图（壳完整、
   状态正确，加载器零抛错）；chips href、sitemap 分类路径改指
   /categories/{slug}/（Set 去重）；i18n 增 categories.title/empty。
   已知限制：跨类型同名 slug 按优先级解析为单一入口。
   **词法筛选多选 + category 入口页批**：①后端——category/tag 参数改
   逗号分隔多选（ContentQuery slugList 清洗 + tax_query IN；控制器
   sanitize_title 整串清洗会把逗号熔成连字符，改 text_field，逐段清洗
   归 slugList），五词法 OR 嵌套内同样 IN，与另一词法腿保持 AND；
   maxLength 100→200。②Term 契约加法补 `cover`（media 库 thumbnail_id
   → attachmentImage 解析，PostPresenter 自带镜像助手），快照重生成 +
   termSchema/mock 同步。③PostLoop 多选化——chips/tag 胶囊改 toggle
   集合语义（activeCategories/activeTags 乐观集合，失败回滚），URL 经
   `historyUrlFor()` 全参数携带；LoopChip 去掉 active/route 死字段；
   fetch 单飞闸门改**最新请求排队**（busy 期间的状态变更不再丢弃，
   finally 排空队列），快速连选不丢点击。④category 专页补可见入口
   头部（封面 aspect-[3/1] + 标题 + 描述，字段下游注册已有）；⑤tag
   专页退场——/posts|resources/tag/[slug]/ 变 302 派发壳
   （→ /?tag=slug），正文页标签 chips 直链参数态，sitemap 撤 tag 归档
   （薄内容 noindex 一致）。E2E：双标签并集（URL 逗号参数、双胶囊
   高亮）、双 chips 快速连点（排队合并不丢）、入口页封面/标题渲染、
   302/404 矩阵；check 0 错误 / 167 测试 / build 正常。
   **分类页双层壳修复**：/categories/[slug/] 原壳文件自己套 AppShell、
   内部 TermArchive 又渲染一遍 AppShell——侧边栏等布局整棵重复两次
   （「两层 UI」真因）。重构：壳文件不再持有布局，改为纯薄
   「CategoryCard 岛屿按 slot 传入 TermArchive」结构（TermArchive 增
   header slot + hideTitle prop），单壳 + 岛屿页头；TermArchive 保留
   sr-only h1（卡片可见名为 span，页面仍持唯一 h1）。
   **尾斜杠规范化批**：无斜杠形态（/categories 等）在全站 404——Astro 7
   的 trailingSlash 检查先于用户中间件执行，always 模式直接 404 且中间
   件无法介入。修复：astro.config trailingSlash 改 'ignore'（路由双形
   态皆可匹配），中间件首段补统一规范化——GET/HEAD 页面请求 308 到斜杠
   形态（query 保留；/api/、带点文件、/media/ 豁免），POST 不受影响。
   顺带修复 API 无斜杠 GET（/api/smilies 曾 404）。**dev 服务器重启
   两次**（中间件与 config 均不热重载）。
   **词法专页核对批**：站内链接全量扫描 + 两跳爬站确认无死链后，按规格
   核对词法/标签专页（通用 PostLoop、无筛选器、分页器版）——筛选
   chevron 本就不挂载；修工具栏悬空分隔线（无 chips 时不再渲染首分隔
   竖线，hasChips 门控）；详情页 502 系并行会话后端中断所致非路由问题。
   文内链接与零件重做待后续批次。
   **SEO 基础设施集中批**：①robots 策略收进 lib/seo 的 `robotsTxt()`——
   黑名单机制（`Disallow: /api/`、`Disallow: /*?*` 挡 JSON 与过滤态）+
   十个 AI 爬虫（GPTBot/OAI-SearchBot/ChatGPT-User/PerplexityBot/
   Perplexity-User/ClaudeBot/Claude-User/Google-Extended/
   Applebot-Extended/CCBot）逐个显式 Allow 段——白名单段落作为政策
   声明，未来收紧通配不影响；mock/坏境 fail-closed 全禁。②BaseHead 补
   keywords（站点级统一 seo_keywords，页级关键词明确不做）与 GA4
   gtag.js 双脚本（后台只填 gaId，前台拼 googletagmanager 引用 +
   dataLayer 初始化；`import.meta.env.PROD` 门控，dev 流量不进统计，
   已在生产构建产物 grep 验证）。③描述下游注册式：词法归档
   description=term.description、板块页=board.description（空回退站点
   描述），详情页沿用 seo.description||摘要——BaseHead/AppShell 链路
   不变，页级传参即注册。④tag 归档（posts+resources）恒
   noindex,nofollow（薄内容）；分类归档可索引；修渲染器 showList 与
   加载器 overRange 语义不一致（空归档曾被误判 404+noindex）。dev 库
   留演示值：seo_keywords/ga_measurement_id（G-TEST12345）/m4notes 与
   SWT-T1 的 term description。
   **路由重构批（2026-09-16 拍板）**：①讨论详情端点移除——
   轻社区刻意单页应用，`GET /discussions/{id}`（后端路由+死方法
   detail()、前端 client.discussion()）确认零调用后删除，编辑/删除/
   回复路由不受影响，phpunit 219/540 全绿；②社区板块路径化——新增
   `/community/board/[slug]/(+page/[n]/)`，`?board=` query 退役，四种
   形态（首页/分页/板块/板块分页）收敛进共享加载器
   `loadCommunityBoard()`（lib/community-board.ts）+ 渲染器
   CommunityBoardPage.astro——**关键教训：`Astro.response.status` 只在
   页面 frontmatter 生效，组件 frontmatter 里赋值被静默忽略（404 变
   200）**，故取数/状态赋值全部下沉 .ts 由页面调用；③分类/标签按类型
   嵌套——`/posts|resources|pages/category/[slug]/(+page)` 与
   `/posts|resources/tag/[slug]/(+page)`（pages 无 tag 词法不挂载），
   旧 `/category/[slug]/`、`/tag/[slug]/` 整树删除，共享
   `loadTermArchive()`+TermArchive.astro（板块/标签名经 /terms 解析，
   未知 slug 404；**空归档 totalPages=0 时第 1 页不得判 overRange**）；
   资源分类 chips 从 query 改链路径、文章详情标签 chips 链
   /posts/tag/、chips route carry 去掉 category；④sitemap——社区板块
   路径、三类词法归档新路径、作者主页（从内容条目作者 slug 去重收集）
   全部补入。i18n 增 boardTitle/pages.category*/resources.tag* 四语言。
   全路由矩阵 curl 实测（含旧路径 404、未知板块/词法 404、空归档
   200），check 0 错误 / 167 测试 / build 正常。**无 slug 形态回退**：
   `/community/board/`、`/{posts|resources|pages}/(category|tag)/` 六处
   302 回各自列表根；`…/[slug]/page/`（缺页码）302 回归档根；畸形
   `/posts/category/page/`（slug='page'）诚实 404 不自重定向。**分页根
   回退**：`/{posts|resources|pages|community}/page/` 与
   `/profile/[slug]/page/` 缺页码形态 302 回各自列表/主页根（文内链接
   与零件重做待后续批次，先跳过）。
   **Loop 零件整理审查轮**：删三个未用 lucide
   导入（Bookmark/MoreHorizontal/UserRound，hint 39→36）；fetchState/
   appendNext 重复的拼参+取数+解析收进共享 `requestFeed` 助手；修两
   处陈旧注释（工具栏「sort select on the left」、CardInfo 高度锁定
   的摘要有为两行描述——移动端摘要已单行）；新增失败回滚——fetch
   失败/响应不可用时回退乐观选中态（chips activeSlug 与标签
   activeTag），不再留幽灵高亮。冒烟复测筛选/清除链路正常。**富文本编辑器**：
   共享 `RichEditor` 组件（Tiptap 3——
   StarterKit + Underline + Image + Placeholder + 自定义 SpoilerMark），
   发布器与帖子编辑表单共用同一实例组件；工具栏七键（粗体/斜体/下划线/
   删除线/引用/防剧透/插图）标签走 i18n；**防剧透**=自定义 mark 输出
   `span[data-spoiler]`（黑底黑字、悬停显字），渲染端净化白名单放行
   `u`/`span[data-spoiler]`。SSR 安全：editor 实例在客户端 effect 创建
   （`new Editor` 直接挂载，服务端渲染占位框）。**20 帖种子实测**：创建限流（5/h）按预期 429 后改
   wp-cli 直插 20 帖（三板块、带图/带标签/长标题/多段落 + 5 条回复），
   全量回归出三处修复——讨论 images 的 url 接受 /media/ 相对路径、
   width/height 允许 0（无尺寸声明时前端定尺寸）、上传代理响应按信封
   data.url 解析；回复为纯文本按转义文本节点渲染（非 HTML）；回复删除
   后岛内同步回退帖子计数。
   **自动加载（autoLoad 参数）**：`PostLoop` 增 `autoLoad`（默认 false，
   Astro 页面开关）——posts/resources 主入口及其分页、首页两段开启；
   开启后分页器隐藏，列表底部 sentinel 进入视口（rootMargin 600px 预取）
   即追加下一页（busy 闸门防重入，**不推历史**——前进/后退仍归
   ClientRouter 的 SSR swap），加载到底显示「已经到底了」终态。分页器
   字号整体降一级（text-xs / h-8）。**page 类型列表路由补齐**：
   `/pages/` + `/pages/page/[n]/`（PostLoop + autoLoad，feed 端点扩展
   `pages` 类型——与 posts 同查询参数），page 类型自此拥有与 posts/
   resources 对齐的列表入口（此前只有 `/pages/{id}/` 详情）。
   加载态统一为共享 `Spinner` 小件
   （lucide LoaderCircle + animate-spin + 描述文案）——自动加载底部与
   通知弹窗的「…」占位替换（新键 `posts.loading`、
   `shell.notificationsLoading`）。**并行会话提醒**：Sponsorship 域
   停用中且 Credit 域重构未定，client 的 plans/redeem/afdian 订单方法
   暂时移除（payload 形状待域落定后随接线批重建）——**该批已于
   2026-09-18 落地**，见下条。
   **会员与积分接入 /membership/（2026-09-18）**：积分账本、档位定价、
   签到、兑换、收银台五个面收敛到单一 `/membership/` 入口，这是内容层
   之外的第一块业务域接线。数据面：`tiers()` 公开（后端 `/sponsorship/
plans` 匿名可读），故游客看得到定价与登录提示，不做重定向；会员
   状态与账本仅在带 session 时读取，且**401 只降级为游客视图**（陈旧
   token 不该让整页空白），其余错误照常报错。写路径新增四个同源代理
   `/api/credits/{checkin,redeem,entries}` 与 `/api/sponsorship/
{orders,afdian-order-url}`（读的 `entries` 只服务「加载更多」）。
   新增 `lib/membership.ts`（`purchasableTiers` / `paymentMethods` /
   `displayDateTime` / `displayDay`）——**纯展示层，不做任何接口门禁判断**：
   签到按钮恒可用，`409 aiya_credit_checkin_done` 是「今日已签」的唯一
   来源；档位是否可买同样只认后端给的 `enabled`。日期一律按**站点时区**
   渲染（后端按站点日历日划分周期，用访客本地时区会与服务器分歧）。
   client 的 `afdianOrderUrl()` 补上后端真正接受的 `month` 参数（1–36；
   此前无参，深链无法定制周期）。四个字典增 `membership` 分区 52 键 +
   11 个新错误码，结构对齐由测试锁住。**踩坑记录**：首版把含函数值的
   `copy` 对象当 island prop 传入，SSR 正常但**水合后函数变 undefined、
   React 抛错卸载整棵树 → 页面空白**（island props 走 JSON，函数静默丢失）。
   已改为与 PostLoop/ResetPasswordPanel 一致的「岛自己 `import { t }`」，
   props 只留可序列化数据。教训：island 改动不能只验 SSR HTML，
   必须在浏览器里确认 `astro-island` 的 `ssr` 属性已摘除。
   **基础栈改为 live-only + 站点门禁（2026-09-18）**：mock 是 demo 期适配、
   对上线项目无价值——`lib/aiya/mock.ts`（101 行、仅 5 条路由）连同
   `dataMode()`、`AIYA_DATA_MODE`、`page.mode` 管道与四字典的 `mockBadge`
   一并删除，`serverClient()` 无条件指向 WP。请求路径改为：middleware 先经
   `lib/core/health.ts` 的进程级熔断器探活（探针就是外壳要用的 `site` 调用），
   不可达即 `lib/gate.ts` 直接返回 503 门禁页（`no-store` +
   `Retry-After: 30` + `noindex`，依赖零组件、样式内联，与 `500.astro` 同
   路数），**16 个页面与任何路由文件均无需感知门禁**。熔断器双 TTL
   （在线 10s / 失联 3s）自动恢复，仅在判定翻转时记一行日志；`loadPage`
   的外壳失败会把熔断器一手压下，消除「发现故障的那次请求之后仍穿透」的窗口，
   4xx 除外（证明后端在应答，不该把访客挡在门外）。`robots.txt` 复用同一
   熔断器，索引能力与可达性始终一致。`npm start` 补
   `--env-file-if-exists=.env`——此前构建产物不读 `.env`，叠加
   `?? 'mock'` 默认值会让部署静默跑成示例数据。新增
   `tests/gate.test.ts`（门禁转义/状态码/熔断 TTL/并发去重/故障分类 10 例）。
   **全量审查修复 + 五项拍板（2026-09-19）**：全量审查（安全 / 契约 / 路由 SEO / 岛屿 props）修复——详情页三岛改收 `cloakPostDetail` 服务端掩蔽（媒体 URL + 正文 HTML 一次过界；unlock 代理与评论 `bodyHtml` 同批补口；`parts.tsx` 浏览器端 rewrite 调用删除——客户端无 WP origin，改写恒 no-op）；净化器收紧（`aiya-smilie` 类名不再单独信任，src 必须落在 `/media/` 上）；死分支清理（AppShell 已兜底错误态，14 个页面的页内 `!page.ok` 分支与 `retry` 字面量地雷删除，活的越界 notFound 分支保留）；SEO 补缺（sitemap 增 `/pages/` `/categories/`、robots 补 `Sitemap:` 声明、`/categories/[slug]/page/` 302 壳、`/profile/me/` 恒 noindex、`canonicalPath` 可选化）。**拍板落地**：①首页零件全删待重规划——现为裸壳（banner + WebSite JSON-LD + sr-only h1）；②`/community/{id}/` 详情页取消（社区单页化定案，LAYOUT.md 对应行作废——LAYOUT.md 为冻结只读，偏离以本文件为准）；③移动端壳=布局层两套（desktop/ 与 mobile/ 各自成套）+ 各页岛内自适应，现 `PendingBanner` 占位待替换；④个人主页横幅不做（后端无预留），从缺口清单移除；⑤反代桥闭合见上（实现契约·过渡期代价已解除）。
   **loop 岛左槽标题 + 切换器恒右对齐（2026-09-20）**：`PostLoop` 的工具栏本就是两态零件——有 chips（分类/标签筛选）时为筛选模式，无 chips 时左槽空置。本轮把无筛选态补齐：新增 `heading` / `headingIcon` 两个可选 prop（图标仍走服务端 `iconInner` 解析后传 inner SVG，与 chips/tagGroups 同惯例），**仅有 chips 时不渲染**（两态互斥，一页不会同时出现两者）；右槽控件簇（分隔线 + 清除筛选 + 筛选 chevron + 视图切换）包进一个 `ml-auto` 容器——此前 `ml-auto` 只存在于文档记忆里，无 chips 的页面（`/pages/`、分类归档）切换器实际左浮，现任何页面都恒右对齐，且左槽为空时不再渲染悬空分隔线（`hasChips || hasHeading` 门控）。作者主页两路由（`/profile/[slug]/` 与 `/profile/[slug]/page/[n]/`）为首个消费方：`heading={copy.profile.articlesTitle}` + `newspaper` 图标，页面里原有的可见 `<h2>` 删除——标题搬进工具栏，语义层（h1 用户名 → h2 发布的文章）与视觉位置均不变；分类/标签归档页自有封面页头，不入此列。验证：`astro check` 0 错误、vitest 219、build 通过；浏览器实测四态——作者主页列表/卡片两视图（左标题 + 右切换器，切换写 localStorage）、`/posts/` 筛选模式无回归、`/pages/` 无 chips 无标题时切换器贴右（行右缘与按钮组右缘同为 1382px）。
   **搜索域落地：顶栏搜索岛 + `/search/{key}/`（2026-09-20）**：顶栏那个纯 Astro `<form action="/posts/">`（只搜文章、无范围概念）拆成岛 `islands/SearchBox.tsx`——shadcn `InputGroup` 组装「放大镜提交按钮 + 关键词输入 + 范围 Select（全部/文章/页面/资源）」，Select 侧 `ui/input-group`（新装件）装配，样式沿用顶栏原来的填充式凹槽（`border-transparent bg-foreground/10`，含 dark 覆写）而非组件默认描边。**两处踩坑**：① Radix Select 会渲染一个隐藏原生 `<select>`，表单因此存在第二个控件，浏览器**可能不再执行 Enter 隐式提交**（实测 Chrome 不提交）——放大镜因此做成真 `type="submit"` 按钮（鼠标可点），并在输入框上显式处理 Enter（`onKeyDown` → preventDefault + 跳转），双保险；② 岛的提交目标是动态路径，无 JS 时本就无意义，故不再保留原生 `action`。**路由**：`/search/index.astro` 恒 302 回首页（无关键词 = 无事可做），`/search/[key].astro` 与 `/search/[key]/page/[n].astro` 共用一个 `content/SearchResults.astro` 渲染体（首页与分页页不再各写一份 loop props——posts/resources 那次的「两份手抄件走散」教训）。关键词**走路径**（`/search/{key}/`，可分享、可深链），范围走 `?type=`（搜索域保持 SSR，无预渲染契约要守，且 robots 已黑名单 `/search/` + 页面恒 noindex）。**范围语义（`lib/search.ts` 一处定义，路由/feed 端点/岛三方共用）**：`type` 有值 = 该类型单腿分页读（端点原生分页原样透传）；`all` = **并集读**——同时取三个类型同一页码再轮转交错（post→page→resource），`totalPages` 取三者最长，因此「全部」也有真实分页，而不是停在分组答案的首页（后端分组模式 `SearchGroup/SearchResult` 仍是契约的一部分，客户端拆成 `search`/`searchGrouped` 两个精确类型读避免联合返回型：`search` 恒为列表形，分组模式留给将来的「快捷结果」面板）。feed 端点新增 `search` 分支，按同一条 `loadSearchPage` 读，SSR 与客户端翻页不会各算一套。i18n 增 `search` 分区 9 键、删 `shell.searchPlaceholder`（占位改「搜索…」，范围可选后不再专属资源）。`robotsTxt()` 增 `Disallow: /search/`。新增 `tests/search.test.ts` 9 例（路径编码/范围校验/轮转交错/并集分页边界）。验证：`astro check` 0 错误、vitest 228、build 通过；浏览器实测——顶栏输入「排版」回车 → `/search/排版/`；结果页顶栏 SSR 预填关键词与范围（`?type=post` 时显示「文章」）；范围内切换即刻重跑（仅当输入框仍是已提交关键词，编辑中的文本不会被误搜）；并集顺序实测 `文章/页面/资源/页面`（post 1 条 + page 2 条 + resource 1 条轮转）；`/search/` → 302 首页、空白键 → 302 首页、越界页 → 404。
   **移动端壳就绪 + UX 闭合规范（2026-09-25，拍板③兑现）**：新立 **`docs/UX.md`（UX 交互闭合规范）**——反馈通道矩阵（toast/内联 alert/Dialog·AlertDialog/Popover/reload 五通道判据）、表单规范（Field 上置 label、移动全宽主按钮、表单级错误）、卡片与面板配方（`rounded-lg border-border bg-surface` + 阴影三档语义）、loading/空态/焦点态/遮罩收敛、弹层移动端形态（Dialog `w-[min(92vw,…)]`、触摸目标 ≥44px）、**移动端壳布局合同（§6，同批兑现）**；存量偏差收进 §7 迁移清单 11 项留后续批次（岛内审计修补、UX 统一落地 ≈ DESIGN.md P2–P4 另轮推进）。DESIGN.md 保持视觉层职责，两文件交叉引用。**壳代码**：`TabBar.astro` 重写——图标+文字（`menuIconName()` 从 DesktopSidebar 提取进 `lib/icons.ts`，双壳同源）、**前 4 项 + 「更多」**（主菜单 ≤5 项全直出、不设更多；抽屉收纳完整主菜单树含子项）、`env(safe-area-inset-bottom)` 安全区、触摸目标 56px 行高；新增 `MobileMenuDrawer.astro`——非模态抽屉（遮罩点击/Escape/路由换页三路关闭），关闭态 `inert`，开合走 root `data-open` + `group-data-[open]:` 纯 CSS 过渡，委托脚本、焦点进出有管理；`MobileTopBar.astro` 增强——搜索切换钮 + 展开行（提交 `searchHref(key, 'all')`，`/search/{key}/` 结果页 SSR 预填，v1 无范围选择）+ 暗色切换钮，**暗色监听上移 AppShell**（双壳共享 `[data-color-toggle]` 契约，单监听防双翻）；`PendingBanner.astro` 删除，`shell.mobilePending` 四语言摘除，增 `shell.mobileMore`/`shell.close`。i18n 净增 2 键。**浏览器实测抓到三处缺陷当场修**：① 抽屉遮罩 div 漏写 `data-drawer-overlay`，委托选择器匹配不上导致点遮罩不关（Escape 正常因为走 keydown 分支）；② 抽屉开合不同步触发按钮的 `aria-expanded`（打开恒 false）；③ 移动搜索行 **Enter 隐式提交不触发 submit 事件**（桌面 SearchBox 的 Select 双控件先例之外的又一处——IAB/合成回车下同样不触发），沿同一手法显式接管 Enter keydown + preventDefault，submit 事件路径（点击按钮）保留。实测矩阵全绿：抽屉开合三路（按钮/遮罩/Escape）+ 链接导航自动关 + inert 关闭态 + 焦点进出 + aria-expanded 同步；搜索行展开/SSR 预填/按钮与 Enter 双提交路径；暗色切换双壳共用单监听；TabBar 激活态；992px 两侧切换；岛屿全部 hydrated。**环境发现（预先存在，与本批无关）**：本地 `astro dev` 在 Node 24 下启动即崩（`react/index.js` 报 `module is not defined`，干净树复现、清 `.vite` 无效）——容器 `aiya-cms-build` 与 `npm start` standalone 不受影响，本地实测改走 standalone；修复另立议题。
   **本地启动修复（2026-09-25 第二批，接上条议题）**：两层根因、两处修复。**① `ssr.noExternal: true` 破坏 dev**——该旗标为 standalone 镜像自包含而生（全依赖打进 dist/server），但它对 dev 同样生效：Vite 8 的 module runner 把 noExternal 的 react（CJS `index.js`）当 ESM 直接 eval，`module.exports` 无处安放即崩。**② 函数式顶层配置被静默丢弃（Astro 7.3.1 缺陷，本轮新踩）**——为修 ① 而改成 `defineConfig(({ command }) => …)` 后 dev 起来了但全站 500：`loadConfigWithVite` 对 `.mjs` 配置直接 `config.default ?? {}` **从不调用函数**，`mergeConfig` 随后把函数展开成 `{}`，整份配置无声蒸发，dev 落到出厂默认 `output: 'static'`——全路由 `routeData.prerender=true`，middleware 的 `Astro.clientAddress` 在取值前就被 `PrerenderClientAddressNotAvailable` 拦截（站内逐层探针实证：probe1 打进 `fetch-state.js` 看 `prerender=true`，probe2 打进 `getRoutePrerenderOption` 看 `config.output='static'`，cfg-probe 证明配置函数零调用）。**最终修法**：顶层配置回归纯对象（函数式配置在 7.3.1 不可用，构建期同样会丢）；「构建期才打包 SSR 依赖」改由**内联 integration 钩子按 `command` 注入**（`astro:config:setup` 的 `updateConfig` 只合并纯对象，绕开函数式缺陷），dev 保持默认外置化。三路实测：dev 全路由 200 + 六岛 hydrated、build 照常产 standalone（react 已打进 `dist/server/chunks/`）、`npm start` 200。**教训入册：改配置后必须核对自己的配置真被加载（探针一行 `console.log` 即可），Astro 对无效配置的降级是静默的。**
   **逐岛移动端审计 + 修补（2026-09-25 第二批，批次 3）**：375px 视口全路由横向溢出扫描（排除关合态抽屉、以 `scrollWidth` 为准）——详情三岛/列表/分类/社区/搜索/404 **零横向溢出**；登录态走查（wp-cli 探针用户，事后清零：账本行、`stats_active` 行、月表 granted/granted_checkin −5、用户删除、通知零残留）覆盖 UserHub 五 Tab、设置面板、钱包气泡（签到 0→5 + 内联成功文案）、通知气泡、表情选择器（三包 Tab + 网格）、会员弹窗（档位卡横滚）、评论富文本与缩进回复、AuthDialog 92vw 约束——形态全部成立。**两处修补**：① **P0 详情标题 0 宽**——`parts.tsx` 的 `TitleRow`「标题截断 + 操作组锁右」在 375px 被约 270px 的操作组挤成 `w=0`，标题与作者名完全不可见；修为移动端纵向堆叠（标题行 `flex-wrap`、操作组独立成行），`sm:` 起恢复单行锁右布局，hero 遮罩内同构生效；② **P2 弹层贴死视口边缘**——钱包/通知气泡在移动端 `x=0`（Radix `collisionPadding` 默认 0），沿 DESIGN.md「收敛在原件层」原则把 `collisionPadding: 16` 设为 **`ui/popover` / `ui/dropdown-menu` / `ui/select` 三个原件的默认值**（调用点可覆写），五个业务弹层与用户菜单自动继承，UX.md §5 同步记档。桌面 1280px 回归：标题行 `flex-direction: row`、高 32 单行、操作组锁右，与改前一致。`npm run verify` 全绿。
   **UX 统一落地第一批（2026-09-25 批次 4，UX.md §7 清偿 #1/#2/#6/#7/#10/#11）**：① **toast/错误文案门面**——新建 `lib/feedback.ts`：`apiErrorCopy(code, locale)`（代理信封 `aiya_*` 码 → `errors` 字典，未知落 generic）+ `toastApiError`，为全站唯一出口；迁移 4 个内联 alert 岛（SettingsPanel/ResetPasswordPanel/AvatarDialog/MembershipPlans 的手抄查表）与 3 个互动岛（LikeButton/FavoriteButton/RatingRow 加 `locale` prop、信封解析补 `code`）与 CommunityFeed 十处 + PostDiscussions 两处——社区/发帖失败 toast 从静态 `copy.failed` 升级为**按响应码取文案**（限流/锁定等有了具体话术），兜底行统一落 `errors.generic`；CommentSection 的语义 switch（游客身份校验措辞与登录墙不同）保留并记入 UX.md §1 特例条款；四字典删除失去消费方的 `common.favoriteFailed`/`posts.unfavoriteFailed`/`posts.likeFailed`/`posts.ratingFailed`/`community.failed`。② **ConfirmPopover 共享件**——CommunityFeed 的局部 DeleteConfirm（Popover 锚定确认气泡，成功才关）提升为 `islands/ConfirmPopover.tsx`，**AvatarDialog 移除头像接入确认**（补 `settings.avatarRemoveConfirm`/`settings.cancel` 四语言键，remove() 改返回成功布尔）；UX.md §1 的「删除类必须 AlertDialog」措辞对齐现实为「行内破坏操作 = 锚定确认气泡」。③ **Card 原件本地化（DESIGN.md P2 核心）**——`ui/card.tsx` 出厂默认改站点配方（`gap-0 rounded-lg border-border py-0`、去 `shadow-sm`、`rounded-xl→rounded-lg`），**10 处调用点反向覆盖清零**（各点人工选择的 `rounded-md`/`p-4`/`overflow-hidden` 保留）。④ **遮罩两档令牌**——tokens.css 新增 `--scrim-modal`/`--scrim-immersive`（模式无关，沿 status 色先例），`ui/dialog`/`ui/alert-dialog` 遮罩换 `bg-scrim-modal`（同值零视觉变化），两处 lightbox 的 `rgba(15,15,20,.85)` 字面量改读 `var(--scrim-immersive)`（DESIGN.md §6#7/#8 关闭）。⑤ 零散：MembershipModal `max-h-[85vh]`→`85svh`；CommunityFeed 板块章对齐 `rounded-full`（CategoryCards 类型徽章按「状态徽章」保留 `rounded`）。验证：`astro check` 0 错误、vitest 266（含四语言字典结构锁）、build、prettier 全绿；浏览器实测——卡片圆角 8px 生效、钱包气泡 16px 视口边距、游客评分拦截 toast（「请先登录。」）正常、Dialog 遮罩同值渲染。§7 余项（#3 通道对齐存量、#4 表单 label、#5 原生控件、#8 共享头像、#9 loading/空态收敛）留后续批次。
   **UX 统一落地第二批（2026-09-25 批次 5，§7 清偿 #3/#4/#5/#8/#9——清单全数关闭）**：① **共享 `islands/Avatar.tsx`**——字母回退头像单一配方（首字符/空名落 `?`、`bg-secondary` 圆盘、尺寸走 className），收敛 9 处手写（用户菜单/评论/设置/头像弹窗/社区三处/详情作者卡/UserHub 两列表；CommunityFeed 的局部响应式助手一并删除，`lg` 变体改显式 `sm:` 类）；② **表单 label 补齐**——CommentSection 游客两字段与 `PostEditorBlock` 标题补 `aria-label`（紧凑编辑器块按 §2 单字段例外记档）；③ **原生控件逃逸清零**——SettingsPanel 界面语言裸 `<select>` 迁 `ui/select`（Radix 的隐藏原生 select 携 `name=locale` 参与 FormData，实测保存「已保存。」）、AuthDialog 记住我迁**新装 `ui/checkbox`**（按钮型不进 FormData，配隐藏域保持 `remember === 'on'` 语义，勾选联动实测 hidden=on）、死常量 `inputClass` 删除；④ **loading/空态分型结案**——逐点盘点现存内联转圈全部为按钮/触发器级（UX.md §4 合规），容器级已用 `Spinner`，DESIGN.md §6#11 按规则结案；空态两型定稿：单行提示归新共享件 `islands/EmptyNote.tsx`（8 处虚线框收敛，MembershipPlans 缺 `bg-surface` 的变体一并归一），结构化空态（门禁/解锁/评论图标空态）保留 `ui/empty`；⑤ **#3 通道对齐核验**——reload 仅存 AuthDialog（会话）与 CommentSection 过审（SSR 重渲染）两处合法点，toast/内联分野与 §1 矩阵一致，清单关闭。回归实测：字母盘渲染、checkbox↔hidden 联动（勾选 → hidden=on）、语言选择器显示当前值 + 表单端到端保存、探针用户（含 MAU 行）事后清零。`npm run verify` 全绿。**UX.md §7 迁移清单 11 项全部关闭。**
   **完成情况审查批（2026-09-25，UX 规范 + 移动端壳五批交付验收）**：25 项静态断言（断点合同/圆角守卫/遮罩字面量/头像配方/空态分型/错误出口/字典键/壳规格点）+ 双端浏览器回归（375 抽屉三路与导航关闭、搜索 Enter、暗色、详情标题、横向溢出扫描；1280 桌面布局）+ verify 复核。**抓到三处批次 4/5 的真漏网当场修**：① `parts.tsx` MetaRow 作者头像、② `PostLoop.tsx` 列表行作者头像（两处 `slice(0,1)` 手写未收敛，迁移时的盘点盲区）；③ `WalletBubble.tsx` 签到/余额错误仍走手抄查表（批次 4 迁移遗漏）→ 全部接共享件。断言修正两处为豁免并记档：Card 本地化断言误报（card.tsx 注释里的出厂默认字样）、虚线框的门禁结构态与虚线分隔线为结构化形态。规范补两条豁免条款：功能性密集控件（下载表格多选、aria2 预设下拉）保留原生但必须 aria-label；图上元素黑底白字不属遮罩体系。**遗留债务核对**：`rounded-xl` ×2（CommunityFeed:660、ProfileCard:52）为 DESIGN.md §6#24 在册的 P3 逸出（批次 5 之前既有，非本五批回归），随 P3 清偿。审查后 `npm run verify` 全绿。
   **守卫批（2026-09-25 批次 6，DESIGN.md P3 守卫 + P4 词汇表 + §6#9/#10/#24 清偿）**：① **rounded-xl 逸出清零**——CommunityFeed 登录门条改共享 `EmptyNote`（同配方 radius 归刻度）、ProfileCard `rounded-lg`，§6#24 在册的两处逸出关闭；② **命名容器令牌**——tokens.css 非内联 `@theme` 建 `--container-shell: 1510px` 与 `--container-dialog-sm: 380px`（变量同时落 :root，`w-[min(92vw,var(…))]` 可引用），AppShell/Footer 改 `max-w-shell`、两对话框改 `sm:max-w-dialog-sm` + var 形态（§6#9/#10 关闭）；③ **风格守卫 vitest 化**——`tests/style-guard.test.ts` 九条常驻执法：rounded-xl 限 ui/、禁 min-[1440px]、vh 上限禁用、命名容器强制、islands 遮罩字面量清零（AdSpace 角标底 `bg-black/50` 值同 `--scrim-modal` 直接归令牌而非豁免）、hex 白名单（gate/500/theme/page.server）、字母头像单方、错误码出口唯一、三处裸输入 label 钉扎——审查批的手工脚本升级为每次 vitest run 的自动回归；④ **动效词汇表 + 减动效**——`--duration-fast/base/slow` + `--ease-standard` 令牌落地；`prefers-reduced-motion: reduce` 全局块（动画/过渡收即时、smooth 回 auto）入 tokens.css，返回顶部 JS 以 matchMedia 顺从（LAYOUT.md 可访问性合同兑现）。验证：`npm run verify` 全绿（vitest 275 = 266 + 9 守卫）；浏览器抽查——`max-w-shell` 计算值 1510px、AuthDialog 380px + 8px 圆角、ProfileCard 8px。
   **广告岛固定比例渲染（2026-09-25 批次 7，站长两轮拍板终版）**：广告素材按 **1200×200（6:1）** 计划上传，原实现卡片**写死 200px 高 + object-cover**——移动端 343px 宽只显示素材中部约 1/3。第一版改「比例跟随素材」（DTO 真实宽高驱动），**站长复核推翻**：任何上传尺寸都应渲染进**同一固定比例**。终版（2026-09-25 三轮：6:1 移动端实测过窄，站长改拍 **5:1**）：`img` 自持 `aspectRatio: AD_RATIO = '5 / 1'`+ `w-full` + `object-cover`——计划素材零裁切，任意乱比例素材中心裁进同一形状，卡高随卡宽缩放（移动 375 实测 335×69、桌面 2-up 484×98、单卡 236×49，触摸目标 69px 达标）。**踩坑两则**：① aspect-ratio 放在 grid 拉伸的卡片元素上会被行拉伸覆盖（移动端单列实测失效）——比例必须放 img 本体、卡片 `self-start` 包裹；② 卡片宽度含边框致实测比值 5.83/5.88 而非整 6（border-box，视觉无感）。几何仍走内联样式（该岛两度遭遇 dev 陈旧 utility CSS 的防陈旧惯例）；DTO 宽高字段不再被此岛消费（`width`/`height` 属性摘除）。
   **文档分层重构（2026-10-02）**：README=介绍与部署、ARCHITECTURE=架构与实现约定、DESIGN=视觉令牌、UX=交互判据、HISTORY=本档案；LAYOUT.md 退役仅存墓碑。
   **设计收敛复盘（2026-10-02）**：原 DESIGN.md §3 的 P0–P5「设计系统收敛」路线图逐项核对代码后收口——P0 截图基线、P2 `.astro` 镜像元件、P4 PageState loading 作废；P1 映射表已在 tokens.css 完成；P1 原型词汇收敛、P3 gap/圆角/阴影存量归一、P4 duration 归一撤销专项改「随触摸归一」；P1 暗色校对与 P5 版式节奏并入唯一现役阶段「页面整理与完善」（十步走查清单落 DESIGN §3）。
   **页面整理十步走查（2026-10-03，走查顺序 1–10 全关，每步 `npm run verify` + 1440/375 × 明暗实测）**：**修复 9 处**——① 移动抽屉遮罩 `bg-foreground/50` → `bg-scrim-modal`（暗色下原值变浅色水洗，批次 4 遮罩归一时漏掉的壳层实例，守卫当时只扫 islands）；② 移动顶栏站名换行 → `min-w-0 truncate`（0.96.0 通知铃铛加宽右侧钮群挤出两行）；③–⑥ 焦点态补齐 ×4（TabBar 链接/移动顶栏站名/页脚两排/面包屑，UX §4 手写层判据，真实 Tab 键验证生效）；⑦ 桌面侧栏 `rounded-[5px]` 归 `rounded-md`（§2 6px 刻度）；⑧ **`/pages/page/[n]/` 筛选契约走散**（不读 `q/category/sort`、route 无 carry——§二#6#1 同类在 pages 对漏网），对齐 posts 分页页模式，实测 308 带 query、filtered noindex；⑨ **社区游客发布门死文本接桥**——EmptyNote 增可选 `onClick`（同配方渲染为带焦点环的按钮），社区门接 `aiya:open-auth`（git 考古确认桥在社区重写时丢失）。**数据实测**：社区帖/回复经 API 直种验证卡片全要素（表情内联图/板块徽章/回复折叠）后全量清理；钱包气泡签到 0→5 全链路（toast + 头部 chip 同步）；搜索全链路；详情三型/列表三型/分类/账号域双端双模式；`ui/slider` 零消费方删除。**环境事项**：`.vite/deps` 预打包过期（tiptap/lightbox/sanitize-html 504）致 PostDetail 岛水合静默死亡——在册盲区复现，杀残留 dev 进程 + 删 `.vite` 重启恢复；并行会话在途改 Auth/UserCenter 与后端两次间歇 500（门禁按设计闭合自恢复），登录 UI E2E 留待其收尾重验（curl 登录 200 可证后端路径无恙）。**测试数据卫生**：孤儿作者帖（探针用户已删）前端优雅降级；评论 20/42 死表情令牌 `::a007::`（旧命名方案）修为存活码 `::ac051::` 并实测读时渲染管线；临时用户/账本行/测试帖全数清理。
   **站长拍板三项（2026-10-03）**：① 页脚版权写死「AIYA CMS」系有意为之，勿改站点名；② 页脚链接走后台设置维护，前台不管；③ 首页 feed 段重设计作废——首页改走区块加载（home_sections 区块配置承接，属产品功能接线，不进样式走查）。
   **文档契约化重构（2026-10-03）**：DESIGN/UX 收敛为**纯契约**（只写「是什么、什么是允许的」，维护约定写进各自文件头）——DESIGN 移除路线图与长期教训（§ 收敛为 判据原则/刻度令牌唯一出处/防回潮守卫 三节），UX 移除拍板记录与已关闭迁移清单、去重刻度（一律引用 DESIGN §2，不复制数值），原 §3 复盘与十步走查记录即本节上文，教训统一记 §三。引用方向从此单向：契约 → HISTORY 允许，反向仅限文件头导航。
   **移动壳重排（2026-10-03，站长规格：外部调研对齐小程序式布局）**：① **移动顶栏两段式**——左 = logo（favicon `size-8`）+ 站名（`truncate`），右 = 搜索 + 通知 + 用户槽三钮；② **搜索改模态框**——新 `MobileSearch` 岛（图标钮 + Dialog 内**复用桌面 `SearchBox` 零件**；零件增可选 `className` 放置类，桌面默认 `hidden min-[992px]:block` 不动，对话框传全尺寸可见类——首版对话框空白即因零件写死 992px 以下隐藏）；③ **用户槽未登录 = 头像占位钮直调登录框**（`UserCenter` 增 `variant` prop：mobile 游客单钮、登录后仅头像菜单无积分 chip——钱包走「我的」钱包 Tab；注册无独立顶栏入口，登录框内切换），桌面分支不变；④ **抽屉改层级衬垫**——左侧滑出面板 z 序压到顶栏之下（遮罩 z-20/面板 z-25 < 顶栏 z-30），从顶栏底下滑出、顶栏恒浮其上，**去自身站名标题**（内容 `pt-14` 让出栏投影区，关闭钮悬于栏线下），「更多」toggle 开合（原单向开改翻转），面板去自身关闭钮、内容顶部预留外边距（pt-[4.5rem]）避免与顶栏 logo 贴合。暗色切换按规格移出移动顶栏（移动端跟随 /site 默认，手动入口归设置域留后续批）。UX.md §6 合同同步重写。375 实测：头部三钮布局、搜索框输入提交直达结果页、游客头像唤起登录框、抽屉 toggle/遮罩/层级全过、零溢出；1440 桌面回归无变化（SearchBox/登录注册钮/抽屉隐藏）。
   **桌面品牌块字号调整（2026-10-03，站长要求）**：侧栏站点标题 5 字被裁——logo 40→36px、标题 text-2xl→text-xl（5 字 94px 恰满容器实测零裁切，可容 6 字）、描述行 text-xs→text-[11px]/h-5→h-4；折叠态不受影响（标题隐藏、logo 居中）。
   **列表卡封面比例重排（2026-10-03，站长要求）**：后台封面固定 16:9（640×360 管线），列表模式原 132px 定高 + 满高裁切改为**比例驱动**——缩略图 `aspect-video` 原比例显示（不再满高裁切）、`sm:w-[288px]`（162px 高，行高 132→162）、`self-center` 垂直居中，去掉 `sm:h-[132px]` 定高锁（行高由图片比例驱动）；链接行 `items-center` 文字块随行居中；摘要行增 `mb-2`，meta 行与摘要间距实测 14px（两模式同享）。grid 模式本就 aspect-video，仅获得摘要间距。375/1440 双视图实测：288×162 (1.78) / 120×68、零溢出。
   **列表卡质量返工（2026-10-03，站长四点要求）**：① 缩略图从单一 288px 改**五档断点尺寸**（120/160/200/240/288px @ base/sm/md/lg/2xl，恒 16:9）——中小屏不再被大图挤压；② 列表文本列取消垂直居中改**顶对齐拉伸**：摘要固定两行（`line-clamp-2 h-10`，不分断点），meta 行 `mt-auto` 贴卡底，剩余空间成为行内留白；③ 卡片视图标题 `text-sm→text-base`（比摘要大一号，`min-h-12`）仍两行截断；④ **类型标签（文章/页面/资源）整体取消**（meta 行只剩 浏览/评论/点赞或评分）；⑤ **分类全部显示**——列表模式全部类名前置内联，卡片模式分类独占一行（标题下 `flex-wrap`）。375/768/1280/1536 四宽度双视图实测零溢出。
   **广告位取消单卡居中兼容（2026-10-03，站长要求）**：单广告「半宽居中」兼容实为缩水 bug——网格项的百分比宽度相对**网格区域**（=容器一半）解析，`w-[calc(50%-…)]` 实渲染只有容器 ~1/4。取消该兼容、固定两列：单广告占左列、与双卡同尺寸（桌面 561×112 5:1 实测，原 ~276px），移动端单列全宽（343×70）不受影响。
   **dev 登录不自旋修复（2026-10-03，站长报「toast 登录成功但页面不切换」）**：根因**不是水合**——login/register 响应里 `legacySessionDeleteHeader()`（清 pre-0.5.2 host-only 旧形态）与新鲜会话 Set-Cookie **同名同路径**；该删除头的设计前提是新 cookie 为域限定（Domain=root，删除头只打 host-only 旧形态），但 `resolveScope` 在 localhost/局域网部署返回 undefined → 新 cookie 也是 host-only → 浏览器按序应用同键 Set-Cookie，**删除头把刚发的会话原地抹掉**：toast 弹出、reload 落地仍是游客。修法：`setSessionCookie` 返回实际应用的 scope，login/register 仅在**域限定**（scope 非 undefined）时才追加删除头；host-only 部署跳过（无旧形态可清）。logout 为纯删除无自毁风险，不改。页内 fetch 登录 200 → 刷新 → sponsorship 200 + header 已登录实测；生产（域限定）行为不变。
   **域名侧域限定路径实测（2026-10-03，站长提供 local.host hosts 解析）**：`.env` 的 AIYA_SITE_URL 切 `http://local.host:4321`（hosts 指向 127.0.0.1），astro.config `vite.server.allowedHosts: ['local.host']`（Vite DNS-rebinding 防护默认 403 非 localhost Host）+ dev `--host 0.0.0.0`（astro dev 默认只绑 ::1，hosts 形态的 127.0.0.1 会被拒）。原子脚本实测（建号→测试→即删，避开并行会话的测试用户清理）：域名侧登录 Set-Cookie 双头按设计共存——`Domain=local.host` 域限定会话 + host-only 删除头；cookie jar 实证域限定会话在删除头之后存活（另一 cookie 身份），带 jar 的 sponsorship 200；logout 按 Domain 删 + 头清 host-only，两形态均净。**dev 域限定路径自此可用**：.env 停在 local.host（要回 localhost 改回即可），sibling 子域共享会话的生产语义在 dev 可复现。
   **设置面板布局重排（2026-10-03，站长要求）**：① 基本资料表单桌面端 `sm:grid-cols-2` 两列（昵称|语言 / 简介跨两列 / 链接|NSFW 开关），表单长度减半；② **「修改密码 / 邮箱」合并组**——邮箱从基本资料迁出，与新密码/确认同组，共用一个当前密码输入；提交自动路由：邮箱变更 PATCH profile（当前密码复验）、密码字段非空 POST password（同一当前密码），密码成功仍登出重定向；邮箱基线 `savedEmail` 在提交成功后才前移（重试不会重发）；按钮「无变更即禁用」。字典四处 `passwordTitle→accountTitle`（值为「修改密码 / 邮箱」）+ `newPasswordHint`（留空则不修改密码）+ `currentPasswordHint` 文案更新；me.astro/settings.astro 的显式 copy 构造同步换键（首版漏改 me.astro 致标题空，已修）。临时用户 E2E：改邮箱（后端确认）→ 改密码（登出重定向）→ 新密码登录 200，双端布局实测，用户已删。
   **赞助钮移出钱包气泡（2026-10-03，站长要求）**：购买入口从气泡第一层移到**顶栏独立按钮**（皇冠图标，紧邻积分 chip，同款 chip 样式对齐）——共用 WalletBubble 的一次会员态拉取，**有生效赞助时按钮直接显示档位名**（`queue` 生效窗口行的 `tierName`，`max-w-40 truncate` 防长名），否则显示「赞助」；气泡第一层只剩余额与生效计划行。移动顶栏本就无钱包 chip（走「我的」钱包 Tab），不涉及。种活跃赞助行实测：按钮显示「进阶方案」、点击开会员模态框；未开通态显示「赞助」；测试行与用户已删。

---

## 二、设计收敛台账（原 DESIGN.md §1/§5/§6，问题至 2026-09-25 全部关闭或转守卫）

## 1. 现状诊断（2026-09-19 复核，91 → 157 → 实测 166 个源文件）

**规模实测**：`src/` 下 166 个文件 = 50 `.astro` + 45 `.tsx` + 69 `.ts` + 2 `.css`；
其中 `src/components/ui/` 是 18 个 shadcn 原件（vendored），**手写层 = 77 个
astro/tsx**。初版「91 个源文件」只数了 astro+tsx。
（2026-09-18 复核为 157 = 48+44+60+3+2 / 手写层 74；本日增量来自 `/menus` 折入
`/site` 与 `/search` 契约镜像两批。）

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
3. **细节无纪律**（2026-09-19 复核，非 ui/ 手写层；括号内为 09-18 旧值）：
   - `gap-*` 共 12 档 / 177 处：`gap-2`×44 / `gap-1.5`×27 / `gap-3`×27 /
     `gap-4`×22 / `gap-1`×21 / `gap-0`×10 / `gap-5`×8 / `gap-2.5`×7 /
     `gap-6`×5 / `gap-8`×3 / `gap-0.5`×2 / `gap-3.5`×1（旧：37/27/26/20/17/10/6/7/5/3/2/1）。
   - 圆角（非 ui/）：`full`×34 / `md`×31 / `lg`×31 / 裸 `rounded`×13 /
     `none`×2 / **`xl`×2**。`--radius` 6px 的刻度是 4/6/8px，**`xl` 的 12px 仍在刻度外**
     ——且 09-18 记的「`xl` 仅存于 ui/」已不成立：`ProfileCard.astro:49`、
     `CommunityFeed.tsx:671` 两处逸出，P3 守卫若此刻开启即报红（见 §6#24 同批）。
   - 阴影：非 ui/ 共 4 处（旧 3 处）——`shadow-md`×2（`ProfileCard.astro:61`、
     `AppShell.astro:181`）、`shadow-xs`×1（`RatingRow.tsx:84`）、
     `shadow-none`×1（`RichEditor.tsx:283`）。
   - 硬编码 hex：**88 处** = `tokens.css`×64（令牌定义本身，合规）+
     `gate.ts`×10 + `500.astro`×10 + `theme.ts`×3 + `page.server.ts`×1。
     `500.astro` 与 **`gate.ts`** 均为刻意独立的零依赖兜底页（文件头注释明示不引
     `tokens.css`），是设计决定而非疏漏；`theme.ts`/`page.server.ts` 的 4 处待查
     （见 §6#25）。§6#5 记的「唯一例外 `500.astro`」已需补上 `gate.ts`。
   - `max-w`：非 ui/ 任意值 **12 处 / 9 个不同值**（旧 10 处 / 7 值）：
     `1510px`×2、`760px`×2、`380px`×2、`220px`、`20rem`、`24rem`、`14rem`、
     `12rem`、`10rem`。
4. **交互基建分散**：sonner 裸调 **4 岛 19 处**（`CommunityFeed`×8、`FavoriteButton`×4、
   `LikeButton`×4、`RatingRow`×3）；`animate-in/out` 各 8 处**全部在 ui/ 内**，
   手写层**14 处 `animate-spin`**；`LoaderCircle` 在非 ui/ 出现 24 次（8 个文件各一
   次 import + 16 处使用），其中 **10 处仍是内联图标、未复用 `Spinner`**（§6#11）。
   **无时长/缓动规范**——时长散见 `0.15s / 0.2s / 0.25s`，缓动散见 `ease / ease-in-out`。
5. **透明遮罩四套不透明度**（本批次复核补一档）：Radix 系 `bg-black/50`、
   lightbox `rgba(15 15 20, 0.85)`（`parts.tsx:406` 与 `CommunityFeed.tsx:1016`
   **两处重复**）、`RichEditor.tsx:329` 的 `bg-black/60` + `bg-black/80`、
   已删除的原生 `dialog::backdrop` `rgb(15 15 20 / 0.45)`。

## 5. 路由审计表（2026-09-18 复核，32 个 `.astro` 路由文件 + 28 个 `.ts` 端点）

| 路由                                      | 文件                      | 状态                                                                                                                                             |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                       | index.astro               | 正规（banner + 三 feed）                                                                                                                         |
| `/posts/` `(/page/[n]/)`                  | posts/*                   | 正规；**chips href 为 `/posts/category/{slug}/` 残留，见 §6#1**                                                                                  |
| `/posts/page/`                            | posts/page/index.astro    | 302 回列表根（缺页码回退，符合契约）                                                                                                             |
| `/posts/[slug]/`                          | posts/[slug].astro        | 正规                                                                                                                                             |
| `/resources/` 同构三件                    | resources/*               | 正规                                                                                                                                             |
| `/pages/` 同构三件                        | pages/*                   | 正规                                                                                                                                             |
| `/categories/`                            | categories/index.astro    | 正规（一级目录页）                                                                                                                               |
| `/categories/[slug]/` `(/page/[n]/)`      | categories/[slug]/*       | 正规                                                                                                                                             |
| `/community/` `(/page/[n]/)`              | community/*               | 正规（单页应用式，CommunityFeed 岛）                                                                                                             |
| `/community/board/`                       | …/board/index.astro       | 302 回 `/community/`                                                                                                                             |
| `/community/board/[slug]/` `(/page/[n]/)` | …/board/[slug]/*          | 正规                                                                                                                                             |
| `/community/board/[slug]/page/`           | …/page/index.astro        | 302 回归档根                                                                                                                                     |
| `/profile/`                               | profile/index.astro       | 302 派发（登录→me，游客→首页）                                                                                                                   |
| `/profile/me/`                            | profile/me.astro          | 正规（保留字，loader 显式 404）                                                                                                                  |
| `/profile/[slug]/` `(/page/[n]/)`         | profile/[slug]/*          | 正规                                                                                                                                             |
| `/profile/[slug]/page/`                   | …/page/index.astro        | 302                                                                                                                                              |
| `/settings/` `/reset-password/`           | settings / reset-password | 正规（账号岛）。**2026-09-19 补注**：`/settings/` 对游客有登录门，302 回 `/`（见下表末行）——`/reset-password/` 无门，游客可达                    |
| `/404`                                    | 404.astro                 | 正规（走 AppShell + PageState）                                                                                                                  |
| `/500`                                    | 500.astro                 | **刻意独立**：文件头注释明示 dependency-free（无 shell、无数据、无岛），内联样式的 10 处 hex 是设计决定而非疏漏（修正初版「走 AppShell」的误述） |

死路由残留：无 tag/category 嵌套路由文件（`/categories/` 批已整树删除），
仅 §6#1 的 chips href 指向已删除的树。

**实测验证（2026-09-18，构建产物 + mock 模式，Docker WP 未运行）**：
文件级审计准确——32 个 `.astro` 路由文件与表中逐行对应，无多余无缺失。HTTP 级
只能验证不依赖内容数据的行：

| 探测                                                                            | 结果                                                                                                                                                                 | 与表一致                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                             | 200（壳层正常渲染）                                                                                                                                                  | ✅                                                                                                                                                                                                                                       |
| `/posts/page/`                                                                  | 302 → `/posts/`                                                                                                                                                      | ✅                                                                                                                                                                                                                                       |
| `/community/board/`                                                             | 302 → `/community/`                                                                                                                                                  | ✅                                                                                                                                                                                                                                       |
| `/profile/`                                                                     | 302 → `/`（游客派发）                                                                                                                                                | ✅                                                                                                                                                                                                                                       |
| `/404/`                                                                         | 404 + 404 页                                                                                                                                                         | ✅                                                                                                                                                                                                                                       |
| `/500/`                                                                         | 500 + 离线兜底页                                                                                                                                                     | ✅                                                                                                                                                                                                                                       |
| `/settings/`                                                                    | 302 → `/`                                                                                                                                                            | ⚠️ 原表未记，**2026-09-19 已补注进 §5 路由表**：该页对游客有登录门，非缺陷                                                                                                                                                               |
| 后端在跑时的 live 复测（2026-09-19）                                            | `/` `/posts/` `/resources/` `/pages/` `/categories/` `/community/` `/membership/` 全 **200**；`/settings/` `/profile/` **302**；`/robots.txt` `/sitemap.xml` **200** | ✅ 全部符合 §5 契约。**注意这是修复 §6#24 之后的结果**——同一批路由在修复前**全部 503**。注 2026-09-24：`/membership/` 路由其后已退役——会员入口迁往 `/profile/me/` 钱包气泡 + 会员弹窗，旧链 middleware 308 兜底（见 README「实现分布」） |
| `/posts/` `/resources/` `/pages/` `/categories/` `/community/` 及各 `page/[n]/` | 当时全部落 404 页状态                                                                                                                                                | ❌ 非路由缺陷——是 mock 无内容 fixture；mock 已于同日移除，该行已由上一行的 live 复测取代                                                                                                                                                 |

结论：**§5 的路由契约本身成立**，上表末行的 404 是数据层缺口而非路由缺口。

## 6. 已知问题清单

| #   | 问题                                                                                                                      | 处置                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | ~~`posts/index.astro` 分类 chips href 指向已删除的 `/posts/category/{slug}/`~~                                            | ✅ **已修并实测（2026-09-18）**。修法比原记录更宽：**posts 与 resources 的「首页 + 分页页」是同一筛选契约的两份手抄件，且已经走散**——`/posts/` 读 `q`+`tag`（carry 同）、`/posts/page/[n]/` 只读 `q`+`sort`；resources 反之（index 无 `sort`，page **丢 `tag`**）。现已统一为 `q / category / tag / sort` 四键，两侧 carry 一致。chips href 改 `/posts/?category={slug}`（与 tag 参数态一致，也匹配岛内点击行为；可抓取的分类归档仍是 `/categories/{slug}/`，已在 sitemap）。实测：`/posts/` 5 个死链归零；`/posts/?category=X` 被 SSR 读到（noindex 翻转）；**区分性测试** `/posts/page/2/?category=nope` → 404 而 `/posts/page/2/` → 200，证明分页页确实读 `category`（改前会 200）。附带修正：仅带 term（无 `q`）时标题不再渲染成空的「搜索：」                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 16  | ~~后端完全忽略 `per_page`~~ → 实为「默认值不跟随站点设置」                                                                | ❌→✅ **前一条是我误报，已更正；真问题已修（2026-09-18）**。<br>**误报原因**：后端注册的参数名是**驼峰 `perPage`**（`ContentController.php`），我拿 snake_case `per_page` 测，未注册参数自然被忽略。用正确名字复测：`perPage=2→2`、`5→5`、`12→12`、`20→15`、`100→15`——**`perPage` 一直是生效的**，`sitemap.xml.ts` 的 `perPage: 100` 也一直正常，上一条关于 sitemap 上限的推论随之作废。<br>**真问题**：`ContentController` 的 `perPage` 默认值是硬编码 `12`，不跟随 WP 阅读设置。已改为读 `posts_per_page`（`ContentController::defaultPerPage()`；2026-09-19 复核修订：站点设 -1「显示全部」时**映射 API 上限 100**，原「钳到 1」最偏离设置语义）；显式传值仍优先（REST arg 默认只在参数缺省时启用）。实测：站点设为 4 → 无参数请求返 4 条；恢复 10 → 返 10 条；`perPage=5` → 5 条；`perPage=100` → 15 条。phpunit 236 通过（新增 4 例）、phpstan 0 错、phpcs 无新增告警                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 18  | ~~前端把 `perPage` 钉死在 12，令站点设置到不了列表~~                                                                      | ✅ **已修并实测（2026-09-18，站长拍板）**。去掉了 `postsQuerySchema.perPage` 与 `resourcesQuerySchema.perPage` 的 `.default(12)`，改为 `.optional()`——**分页大小归后端决定**，前端不传就别造值；`undefined` 时 client 的 `url.searchParams.set` 自动跳过，不会出现在请求里。显式传值仍完全可用，留给自定义查询场景（首页 `client.posts({ perPage: 6 })` 与 sitemap 的 `perPage: 100` 均保留，实测 `/api/feed/posts/?perPage=4` → 4 条）。`PostLoop` 本就带可选 `perPage?: number` 且仅在truthy时拼进请求，无需改动。<br>**实测结果**（本站 `posts_per_page`=10）：`/api/feed/posts/` 不带参数 → `perPage=10`；`/posts/` 渲染 **10** 项（原 12）；`/` 首页仍 **6** 项（显式值生效）；`/resources/` 渲染 7 项 = 后端 total 7。其余 schema（comments/discussions/credits 的 20、users/favorites 的 12）**有意未动**——它们不由 `posts_per_page` 管辖                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 17  | 页脚次级菜单「关于本站」指向 `/posts/1/`（404）                                                                           | ✅ **已修（2026-09-19，后端会话）**。定性确认：菜单 url 来自 Navigation 设置页自由填写 repeater（`PrimaryMenu::normalizeUrl` 原样放行），`/posts/1/` 是**详情路由 slug 化之前**写入的旧 ID 形态地址，纯数据问题、presenter 无 ID 形生成。已把该行改指站点现存页面 `/pages/sample-page/`，`menus/secondary` 实测返回新值。（注：`/menus/*` 端点已随 0.83.0 摘除并入 `/site.blocks`，此处当时的验证口径已死，现对应 `site.blocks.secondary`）同类风险保留注明：后台自由填写的任何非 slug 详情链接后端不会改写（如需 id→slug 兼容层另行拍板）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2   | `shell.css` 残留无主 `dialog::backdrop`                                                                                   | ✅ **已删（2026-09-18）**。实测全仓无原生 `<dialog>` 元素、无 `showModal(` 调用，现役模态仅 radix `<div>` overlay                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 3   | `cn` 导入源为 `cn` npm 包，`components.json` 别名写 `@/lib/utils`（该文件不存在 → shadcn CLI 新增组件会生成断链导入）     | ✅ **已修（2026-09-18）**。新建 `src/lib/utils.ts`（`export { cn } from 'cn'`），18 个文件的 `import { cn } from 'cn'` 全部改为 `@/lib/utils`；`components.json` 无需改动（原本就是对的，是代码侧没跟上）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4   | ~~`--color-muted → --secondary` 错接~~                                                                                    | ❌ **误判，结论已推翻（2026-09-18）**。`--muted` 在 shadcn 词汇里是**面（surface）**不是文字色：`bg-muted` 6 处（`parts.tsx:320,357` 的 `bg-muted/60`、`tabs.tsx:27`、`empty.tsx:36`、`alert-dialog.tsx:122`、`slider.tsx:39`）要的是浅灰底；文字色由 `--muted-foreground`（= `--body-muted` #747480）承担，接法正确。按初版建议改成 `--body-muted` 会让那 6 处变成深灰块                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | `#e94f69`（品牌玫红）等 hex 散落                                                                                          | ✅ **`shell.css` 已晋升令牌（2026-09-18）**，且为**零视觉变化**：新增 `--status-success/warning/info/danger`（告警四档 accent）+ `--spoiler-bg/-fg`（遮罩黑），`:root` 定义、`.dark` **不覆写**（原值即模式无关，mid-tone 双模式可读）。`500.astro` 的 10 处保留（独立离线页，见 §5）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | `docs/DESIGN.md` 被引用但缺失                                                                                             | ✅ **本文件**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7   | ~~透明遮罩三套不透明度~~（`bg-black/50` / `rgba(15,15,20,.85)` / 已删的 `.45`）                                           | ✅ **已收（2026-09-25 批次 4）**：`--scrim-modal` / `--scrim-immersive` 两档令牌（tokens.css），dialog/alert-dialog 遮罩走 `bg-scrim-modal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 8   | ~~`rgba(15, 15, 20, 0.85)` lightbox 遮罩重复两处~~（`parts.tsx` 与 `CommunityFeed.tsx`）                                  | ✅ **已收（2026-09-25 批次 4）**：两处改读 `var(--scrim-immersive)`，字面量清零                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 9   | ~~`max-w-[1510px]` 重复（`AppShell.astro` + `Footer.astro`）~~                                                            | ✅ **已收（2026-09-25 批次 6）**：tokens.css 命名容器 `--container-shell: 1510px`，两处改 `max-w-shell`；vitest 守卫执法                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 10  | ~~`max-w-[380px]` 重复（`AuthDialog.tsx:93` + `AvatarDialog.tsx:141`，且前者同 className 内还有 `w-[min(92vw,380px)]`）~~ | ✅ **已收（2026-09-25 批次 6）**：`--container-dialog-sm: 380px`，`sm:max-w-dialog-sm` + `w-[min(92vw,var(…))]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11  | ~~`Spinner.tsx` 存在，但 11 处 `animate-spin` 有 10 处内联 `<LoaderCircleIcon>` 未复用它~~                                | ✅ **按 UX.md §4 规则结案（2026-09-25 批次 5）**：逐点盘点现存内联转圈全部为按钮/触发器级（合规），容器级已用 `Spinner`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 12  | `shell.css` 无主重复注释（smilies 双份、spoiler 双份规则）                                                                | ✅ **已并（2026-09-18）**：smilies 注释删去过期那份；`.prose-community` 与 `.aiya-comment-body` 的 spoiler 规则合并为一组选择器（特异度不变）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 13  | `shell.css` 中 `calc(var(--radius) - 2px)` ×2 重复了 `tokens.css:31` 的 `--radius-sm` 定义                                | ✅ **已改（2026-09-18）**：改用 `var(--radius-sm)`，读数与刻度同源                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 14  | ~~mock 只覆壳层，覆盖不了截图基线~~                                                                                       | ✅ **已由「整体移除 mock」解决（2026-09-18，站长拍板）**。原诊断：`mock.ts` 仅 101 行 / 5 条路由，`/posts/` 等内容路由全部落 404，P0 截图基线实为受阻。拍板结论：mock 是 demo 期适配、对上线项目无实际价值，不做「补 fixture」而是**整栈改为 live-only + 站点门禁**——见 §6#15                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 15  | 基础栈已改为 live-only + 门禁（2026-09-18）                                                                               | 已落地。`mock.ts`、`dataMode()`、`AIYA_DATA_MODE`、`page.mode` 管道、四字典 `mockBadge` 全部删除，`serverClient()` 无条件指向 WP。请求路径：middleware 经进程级熔断器探活（探针即外壳所需的 `site` 调用），不可达则由 `lib/gate.ts` 返回 **503 门禁页**（`no-store` + `Retry-After: 30` + `noindex`，零组件依赖、样式内联，沿 `500.astro` 路数）——**16 个页面与全部路由文件零改动**。熔断器双 TTL（在线 10s / 失联 3s）自动恢复，仅判定翻转时记一行日志；`loadPage` 外壳失败会一手压下熔断器，消除「故障发现后仍穿透」窗口（4xx 除外，见 `isBackendOutage`）。**副作用：P0 截图基线从此必须起 Docker WP**（mock 这条免后端的路已不存在），这是拍板时接受的代价                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 19  | **resources 分类胶囊仍在指向已删路由**（§6#1 我自己修漏的一半）                                                           | ✅ **已补修并实测（2026-09-18）**。同一死路由家族的第三处：`resources/index.astro` 的 `chipHref()` 仍拼 `/resources/category/{slug}/`，实测 4 个胶囊（dbgcat/swtcat/tmvc/tmvp）**全部 404**——上一批我修了 posts 的胶囊与 resources 的 carry，却漏了 resources 自己的胶囊 href。已改为 query 形态 `/resources/?category={slug}`（保留 q/tag），实测两个列表页死链计数归零、`/resources/?category=dbgcat` → 200。全仓复查：仅注释里还提到该已删路由，构建产物无残留                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 20  | **后端重复签到把 SQL 错误打印进响应体**（aiya-core，未修）                                                                | ✅ **已修（2026-09-19，后端会话）**。`LedgerService::grant()` 的 INSERT 以 `wpdb::suppress_errors(true)` 包裹（用后即还原）：重复键是这里的**预期信号**，`last_error` 在 `query()` 内赋值、不受抑制影响，409 判定逻辑不变；被抑制的只是 `print_error` 的调试输出，真实 DB 故障仍走 `aiya_db_error` 不被吞。实测：连发两次 checkin → 200、**409 `aiya_credit_checkin_done`**，响应体无任何 SQL 痕迹（修前是 HTML+JSON、状态 200）。前端按「409 是唯一裁决」的既有改法无需再动，二次点击自动落「今天已经签到过了」文案                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 21  | **签到设置完全不生效：`aiya_core_opt()` 页 slug 传错**（后端，未修）                                                      | ✅ **已修（2026-09-19，后端会话，与本条诊断一致）**。`CreditSettings::read()` 三处页 slug `'sponsorship'` → `'membership'`（option 名 `aiya_core_sponsorship` 是刻意与 slug 不同，`aiya_core_opt()` 按 **slug** 查，传 option 后缀即读空）。实测：option 写 `checkin_credits=9` → `CreditSettings::read()` 返 9（修前恒落默认 true/5/30）。附带结论同本条：`aiya_core_credit` 残留行不是缺口。**教训**：早前「注册键与读取键一致」的核对只对了字段 id、漏了页 slug 这一层——两处键完全同形，反而掩盖了 slug 错配                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 23  | **岛 props 传函数导致整页空白**（本站自查出的真 bug，已修）                                                               | ✅ **已修（2026-09-18）**。站长报「这个页面里什么都没有」。根因：`/membership/` 把含 **9 个函数值**（`tierPrice`/`tierCycle`/`tierCredits`/`cycleDays`/`queueCycles`/`checkinGranted`/`redeemGranted`/`ledgerRemaining`/`ledgerExpires`）的 `copy` 对象当 island prop 传入。**Astro 的 island props 走 JSON 序列化，函数静默丢失**——SSR 期 props 是进程内真对象、函数可用（故服务端 HTML 完全正常），**水合后这些键变 `undefined`，React 一调用即抛错、整棵树卸载 → 空白页**。修法：改为仓内既有做法（PostLoop / ResetPasswordPanel），**岛自己 `import { t } from '@/lib/i18n'` 并按 locale 取字典**，`copy` prop 与手写 `MembershipCopy` 接口一并删除（类型改取 `ReturnType<typeof t>['membership']`，顺带消除接口与字典的漂移面）。实测浏览器：4 个岛 `hydrated: true`，游客视图与会员 6 区块齐全，签到后余额 0→5 且**账本行即时出现**（新增 `refreshLedger()`——签到响应是无 id 的 `CreditGrant`，本地无法忠实造行，故重取首页而非伪造）。<br>**教训（已写入 §7）**：我此前全部验证都只看 curl 拿到的 SSR HTML，而该 bug 在 SSR 下完全不可见——**island 相关改动必须在真实浏览器里验证水合后状态**。同类静态守卫（「岛 props 里不准出现 `=>`」）实测不可行：`categories.map((term) => …)` 这类在 SSR 期就求值成普通数组的合法写法会被误报                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 22  | **`/site` 未透出签到设置**（真实字段缺口，未补）                                                                          | ✅ **后端已闭合（2026-09-19，形状与原提案不同）**。未走 `/site`：游客视图本就没有签到卡，公开载荷无需携带；改为 `GET /sponsorship/membership` 的 `MembershipState` **加法追加 `checkin: {enabled, credits, validityDays}`**（新 `CheckinPolicy` DTO，值即 `CreditSettings::read()` 三键）。契约快照重生成 + 前端 `checkinPolicySchema`/manifest 已同步，v1 基线未动；运行时实测会员响应带全三值。**前端剩余动作亦已闭合（2026-09-19）**：`MembershipPanel` 此前不读 `checkin`（`checkin.enabled` 零引用）——描述行恒为泛文案、按钮恒可点、开关关掉也只能事后吃 403。现改为**描述行由策略渲染**（`checkinPolicy(credits, days)` →「每天可领 5 积分，有效期 30 天。」；`enabled:false` 时整行换 `checkinClosed` →「签到暂未开放。」）**+ 按钮 `disabled={checkinBusy \|\| !membership.checkin.enabled}`**；字典四语言同步（删 `checkinDesc`，增 `checkinPolicy(credits, days)` 函数键与 `checkinClosed`）。浏览器实测两端：开关开 → 文案带 5/30、按钮可点、点击得「签到成功，获得 5 积分。」、余额 0→5；开关关 → 「签到暂未开放。」且 `isEnabled() === false`。测试数据已还原（选项、专用测试用户及其账本行）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 24  | **一个相对路径 URL 让整站进 503：`/site` 手工填写的链接字段被 schema 收窄**                                               | ✅ **已修并实测（2026-09-19）**。启动 dev 时全部 HTML 路由 **503**，日志是 `[gate] backend unreachable` ——**指向了错误的方向**（后端 200，`/site` 也 200）。真因：`siteSchema.blocks.adsTop[0].url = "/promo/"` 过不了 `adSlotSchema.url: httpUrlSchema`（要求绝对 http/https），契约错误被熔断器按「后端不可达」处理（`reachability.ts:27` 明确把 contract drift 归为 outage），于是**一个相对路径的广告链接把整站挡在门禁页后面**。<br>**定性**：错在前端 schema，不在数据。后端 `AdSlot`/`CarouselSlide` 的 docblock 都明写「a front-end path or external URL」，`ContentBlocks::normalizeUrl()` 的职责正是**把指向本站的 URL 收敛成裸路径**（`/promo/` 是它的正常产出）；`menuItemSchema.url` 早就用了 `z.union([sitePathSchema, httpUrlSchema])`，而 `/menus` 折入 `/site` 那批只把 primary/secondary 接对了，**ads/carousel 沿用了旧的绝对 URL 约束**。<br>**修法**：新增具名 `linkTargetSchema = z.union([sitePathSchema, httpUrlSchema])`，`menuItemSchema` / `adSlotSchema` / `carouselSlideSchema` / `beianLinkSchema` 四处**统一共用**。<br>**同批揪出第二处同类（尚未发作）**：`beianLinkSchema.url` 也是 `httpUrlSchema`——备案链接是后台自由填写字段（`FrontendModule` 的 `beian_links` repeater，`ValueNormalizer::url()` 用 `esc_url_raw()` 清洗），而 WP 的 `esc_url()` 对 `/` 开头的值**原样放行**（`formatting.php`：`if ( '/' === $url[0] ) { $good_protocol_url = $url; }`），所以 `/about/` 能进库、能被 `SitePresenter` 原样吐出。**实测复现**：写入 `{"url":"/about/"}` → `/site` 校验 FAIL（`footer.links.0.url \| Invalid URL`）→ 修后 OK，页脚真实渲染 `/url: /about/`。测试数据已还原（`beian_links` 回 `[]`）。<br>**回归守卫**：`tests/contracts.test.ts` 新增 3 例（`authored link targets accept both shapes`）——三种形状各取一例接受相对路径、仍接受外链、仍拒 `//evil.example/x` / `/a/../../b` / `/a%2fb` / `https://u:p@…`。vitest 219 全绿 |
| 25  | **`allow_path` 只是后台输入框开关，存储层从不强制**（同批查清，决定前端容忍策略）                                         | **结论已定，不再单独立项**。后端 url 字段有个 `allow_path` 标志，但全仓只有一处消费方——`Admin/FieldRenderer.php:146`，作用是**把 HTML 输入从 `type="url"` 换成 `type="text"`**（因为浏览器原生 `type="url"` 校验会拒掉 `/posts/` 这类站内路径）。菜单/广告/轮播显式开了它，备案链接没开。而存储侧 `ValueNormalizer::url()` 对两者一视同仁，都只过 `esc_url_raw()`。**所以「后台手填 URL」的完整集合就是 §6#24 那几处共用的 `linkTargetSchema`，前端一律按「路径 ∪ 绝对」容忍**（注 2026-09-24：`carouselSlideSchema` 已随 0.93.0 删除——CarouselSlide DTO 退役、`/site.blocks` 改 `sections`——判据集合相应收窄，容忍规则本身不变）；`userSchema.url`（用户资料网址）本就是 `z.string()`、`beianLinkSchema.iconUrl` 同理，本就安全。其余 `httpUrlSchema` 都是后端/网关/上游生成（`imageSchema`、附件、上传结果、`submitUrl`、爱发电深链），不受此影响                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 26  | **两处仍需后端归一化的 `/site` 字段**（低概率触发，未改前端契约）                                                         | **上报后端会话，前端不动**。① `siteSchema.name: z.string().min(1)` 读的是 `get_bloginfo('name')` → `get_option('blogname')`，`sanitize_option` 对它只做 `esc_html()`、**无非空强制**，且核心「设置→常规」表单是 `novalidate` 且该 input 无 `required` —— 站长留空站点标题即可让 `name: ''` 触发同一类整站 503（空标题的合理降级是顶栏品牌留白，不是门禁）。建议后端给 `SitePresenter::present()` 兜一个非空回退。② `defaultCommentsPage` / `commentOrder` 直读 `get_option('default_comments_page'/'comment_order')`，而这两键在 `sanitize_option()` 里**没有任何 case**、后端 `commentsSettings()` 也未白名单——核心设置页只有 newest/oldest 与 asc/desc，越界值需非核心写入。建议照 `colorMode()` 的既有手法加 `in_array` 白名单。<br>**为什么不改前端**：这两个值是前端要 switch 的语义枚举，放宽成 `z.string()` 只会把非法值漏进逻辑层；正确的边界是写入侧归一化。**且它们与 §6#24 不同——不是后台正常操作能产生的形状**，故不按同一优先级处理                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

## 三、环境注记与修订记录（原 DESIGN.md §7/§8；2026-10-03 起长期教训统一记在本节，契约文档（DESIGN/UX）不再承载教训与计划）

## 7. 环境注记

- **数据模式：只有 live**（2026-09-18 起）。mock 已整体移除，`AIYA_DATA_MODE`
  与 `dataMode()` 不存在。无后端可达时站点进 503 门禁（见 §6#15）。
  **环境变量**：`AIYA_SITE_URL` / `AIYA_WP_API_URL` / `AIYA_API_TIMEOUT_MS` /
  `AIYA_ALLOW_LOCAL_HTTP`，2026-09-19 反代桥再增 `AIYA_PROXY_SECRET` 与可选
  `AIYA_CLIENT_IP_HEADER`（共六项，以 `.env.example` 为准）；本仓 `.env` 指向 `http://localhost:8000/wp-json/aiya/core/v1/`。
- **`.env` 的加载路径**：`astro dev` 经 Vite 读 `.env`（`import.meta.env`）；
  构建产物**不吃** `.env`，故 `npm start` 已补 `--env-file-if-exists=.env`。
  此前该缺失叠加 `?? 'mock'` 默认值，会让部署**静默跑成示例数据**——这是移除 mock 后
  必须一起修的真实缺陷。生产环境仍以真实环境变量为准。
- **运行依赖**：Node ≥22.12（实测 v24.20.0 / npm 11.19.0）；
  `npm run verify` = `astro check` + `vitest run` + `astro build`。
- **基线实测（2026-09-19）**：10 个改动文件之外无其他差异；`astro check` **0 errors /
  0 warnings / 9 hints**；vitest **11 文件 / 219 tests 全绿**（09-18 为 9 文件 / 174）；
  `astro build` 成功（仅有既存的 chunk >500 kB 提示，与本次改动无关）。
- **`/site` 的整份 schema 校验是全站单点故障（2026-09-19 教训，代价是一次全站 503）**：
  门禁的探针就是外壳所需的 `site` 调用，而 `reachability.ts` 把 **contract drift 与
  网络故障一并判为 unreachable**（该文件注释是刻意写的，不是疏漏）——于是
  **`siteSchema` 里任何一个过严字段 = 整站停机**，且报错文案是
  `[gate] backend unreachable`，**把排查方向指向后端**（本次后端 200、`/site` 也 200，
  真因是一个相对路径的广告 URL，见 §6#24）。规矩：**动 `siteSchema` 的字段时，
  先问「后端会不会合法地吐出别的形状」**；凡是**后台手填**的值（路径/链接/颜色/枚举），
  一律按后端实际能产出的形状放开，不要按「理想输入」收紧。判据是后端那侧的三个真相源：
  DTO docblock、`normalizeUrl()` 一类归一化函数、`ValueNormalizer` 的清洗手法。
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
- **git**：`front-station/` 已于 2026-09-19 初始化为 git 仓库（首提交即 0.81.0
  契约镜像状态），此后改动有 commit 级回滚点。
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

| 日期             | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-03       | **零路由消费面 + 通知软锚 + 会话/环境收敛**（与 aiya-core「路由引用解耦」「@提及」「通知软锚」批次配套）：① **契约 url 字段退役**——PostSummary/Breadcrumb/Discussion 的 url 随零路由原则从 zod/快照（v1 基线同步修订）移除，路由全部前台自建：`postRoute(type, slug)` 六 kind 前缀、`refHref` 解析 `data-aiya-ref` 句柄、共享 `anchorTransform` 接入 safeContent/sanitizeDiscussionHtml/sanitizeCommentHtml 三 sanitize 边界（补 href、剥传输属性、句柄不可用降级惰性文本）；JSON-LD 路由自建、面包屑仅 label+position；详情 prev/next/related 卡与 `[ref]` 标记同通道。② **修复 refHref comment 分支句柄错位**——原读 `data-aiya-post-slug`（后端不存在该属性，且 `undefined !== ''` 恒真使守卫失效），真实标记会解析成 `/posts/undefined/#comment-N`；对齐为后端实发的 `data-aiya-slug`。③ **通知标题消费面**——title 升级为通知 HTML（后端 NotificationLinker 软锚），新增 `sanitizeNotificationHtml` 最小面（a+href/title）在 FeedRow 消费，头版气泡与 /notifications/ 页共用；浏览器 E2E：评论行点击导航 `/posts/{slug}/#comment-67` 且 `:target` 命中、post 行 type+slug、积分行无锚纯文本、全 feed 零 data-aiya 残留。④ **session 修复**——host-only 部署（localhost/LAN）登录时 legacy 删除头会擦掉刚写入的同名会话（toast 成功、刷新仍是游客）；`setSessionCookie` 返回作用域，删除头仅在 domain 作用域时追加。⑤ **环境收敛**——`AIYA_WP_API_URL` 只配 origin，冻结契约根 `/wp-json/aiya/core/v1/` 常量化追加（全路径值兼容）；astro dev `allowedHosts: ['local.host']`（dev 域名 cookie 作用域实测）。⑥ **设置面板账户表单合并**——邮箱+密码共享一个 current-password，提交自动路由（改邮箱 PATCH profile / 改密码 POST 并全端登出重登），savedEmail 基线防重发。⑦ **移动壳**——MobileSearch 岛新增，MobileTopBar/MobileMenuDrawer 重构，`ui/slider.tsx` 退役。⑧ **文档分层落地**——ARCHITECTURE.md（分层/实现分布/实现契约，含零路由消费面与通知标题两节）与 HISTORY.md（本档）新建，LAYOUT.md 退役为存档，README 瘦身为项目介绍与部署。**验证**：vitest 325/325、astro check 0 错、`npm run verify` 全绿、浏览器 E2E 全链路过（dev server 需 `--host`——Astro 默认仅绑 IPv6，`local.host` 是 IPv4 别名）。 |
| 2026-09-17       | 初版：全量扫描 + 四根因 + P0–P5 路线图 + 路由审计                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-19（二） | **全站 503 真因查明并修复 + §6#22 前端收口（前端会话）**：① **§6#24 新增并修复**——启动 dev 时全部 HTML 路由 503、日志指认「backend unreachable」而实为 `/site` 契约校验失败；根因是 `/menus` 折入 `/site` 那批把 `adsTop`/`carousel` 的 url 留在绝对 URL 约束上，而后端对「后台手填链接」的契约本就是**路径 ∪ 外链**（`normalizeUrl()` 会把站内链接收敛成 `/promo/`）。新增具名 `linkTargetSchema` 四处共用，同批修掉**尚未发作的同类** `beianLinkSchema.url`（实测复现 → 修 → 页脚真实渲染 `/about/`）；`tests/contracts.test.ts` 加 3 例守卫，vitest 219 全绿。② **§6#25 查清** `allow_path` 仅是输入框 `type` 开关、存储层从不强制，据此定下「后台手填 URL 一律容忍」的完整集合与判据。③ **§6#26 上报**两处待后端归一化的字段（空站点标题、未白名单的评论选项），并说明为何不在前端放宽语义枚举。④ **§6#22 前端剩余动作闭合**——会员面板此前零引用 `membership.checkin`，现由策略渲染「每天可领 N 积分，有效期 D 天」并在 `enabled:false` 时禁用按钮、换「签到暂未开放。」；四语言字典同步（删 `checkinDesc`、增 `checkinPolicy`/`checkinClosed`）。浏览器实测双路径：开关开→点击得「签到成功，获得 5 积分。」余额 0→5；开关关→按钮 `isEnabled()===false`；4 岛 `hydrated: true`。测试数据全部还原（选项、测试用户及其账本行）。⑤ **§1 计数按当日复核重写**（166 文件 / 手写层 77），并更正两处已不成立的旧结论：`rounded-xl` 已逸出 ui/（2 处，P3 守卫此刻开启会报红）、hex「唯一例外 `500.astro`」需补 `gate.ts`。⑥ **§3 P0 状态更新**：Docker WP 在跑、截图基线已解锁，但**工具链仍未建**；P3/P4 的调用点项按 §2 顺序标注为「等 P2」。⑦ **§7 新增 `/site` schema = 全站单点故障**的教训与判据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-18       | 复核修订并落地 P1 部分：① §1 全部计数按实测重写（源文件 91→157、gap/圆角/阴影/hex/max-w 逐项更正）；② §6#4 判为**误判并推翻**（`--muted` 是 surface 非文字色）；③ §6#2/#3/#5/#12/#13 修复落地；④ §5 修正 `/500` 描述并补 HTTP 级实测验证表；⑤ §7 旧「同步缺口」判为不成立并消解；⑥ 新增 §6#7–#11 五项新发现；⑦ **新增 §6#14：mock 只覆壳层，P0 截图基线实为受阻**，并据此修正 §7 的 mock 表述                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-19       | **后端闭合日（后端会话）**：① §6#17 数据修复——「关于本站」菜单行改指 `/pages/sample-page/`，presenter 核实无 ID 形生成；② §6#20 修复——`LedgerService::grant()` INSERT 以 `suppress_errors` 包裹，重复签到回归干净的 409（实测响应体无 SQL 痕迹）；③ §6#21 修复——`CreditSettings::read()` 三处页 slug `'sponsorship'`→`'membership'`，实测 option 写 9 读回 9；④ §6#22 后端闭合——改走 `MembershipState.checkin`（`CheckinPolicy` DTO，快照 + 前端 zod 同步，v1 未动），非原提案的 `/site` 形状；⑤ §6#16 措辞更新——`posts_per_page=-1`（显示全部）由「钳到 1」修正为映射 API 上限 100。另：HEAD 层 `wp_render_img_auto_sizes_contain_css` 空操作裁剪已在后端修正为 6.9+ 双段式两行摘除（壳页 `<style id="wp-img-auto-sizes-contain-inline-css">` 泄漏归零，详见 aiya-core `HeadlessModule::stripFrontendHead()`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-18（七） | **前端去门禁判断 + 后端设置错配查明**（站长定性）：① 删掉签到「今日已签」的前端预判（`hasCheckedInToday`/`dateInTimezone` 及其 5 例单测）——前端不为接口做门禁判断，409 是唯一裁决；§6#20 改记为「补丁落后端 DTO 层」。② §6#21 重写：`aiya_core_credit` **不是缺口**（残留行、无代码读取），真 bug 是 `CreditSettings::read()` 用 `aiya_core_opt('sponsorship', …)` 传了**不存在的页 slug**（真实 slug 是 `membership`，option 才是 `aiya_core_sponsorship`），三处读取全部落空 → 签到设置永不生效。已实证（写 9 读回 FALLBACK，按 `membership` 读回 9），修法为一字之差，按划定留后端会话                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-18（六） | **`/membership/` 落地：内容层之外的第一块业务域接线**（站长划定：只做前端，后端归另一会话，仅在真实字段缺口时动后端）。积分账本、档位定价、签到、兑换、收银台五个面收敛到单一入口；5 个同源代理、`lib/membership.ts` 纯逻辑（含站点时区一日判定）、四字典 52+11 键、10 例单测。全路径实测：游客视图 2 区块 + 定价、登录后 6 区块、签到 200 且账本落 `source=checkin/ref=当日`、重复签到被预判挡住、收银台拿到真实易支付 `submitUrl`、爱发电未绑方案 422 命中字典、三个写代理未登录 401。新增 §6#20（后端重复签到泄漏 SQL 且状态错为 200）、§6#21（孤儿选项行）、§6#22（/site 缺签到设置字段）三条后端侧发现，均按划定未改                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-18（五） | **分页大小归后端 + resources 胶囊补修**：站长拍板去掉 `postsQuerySchema.perPage` / `resourcesQuerySchema.perPage` 的 `.default(12)`（改 `.optional()`），前端不传即由后端按站点设置决定，显式值仍供自定义查询使用；§6#18 关闭，实测 `/posts/` 10 项、首页显式 6 项、`perPage=4` 仍生效。另发现并补修 §6#19：resources 分类胶囊是同一死路由的第三处（上一批修漏），现两列表页死链归零                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-18（四） | **`per_page` 误报更正 + 后端默认值修复**：§6#16 前一条结论（「后端忽略 per_page」）系我用错参数名（`per_page` ≠ 注册名 `perPage`）所致的**误报**，已推翻并重写；真问题（默认硬编码 12、不跟随 `posts_per_page`）在 aiya-core `ContentController::defaultPerPage()` 修复并实测。新增 §6#18：前端 zod `.default(12)` 把 perPage 钉死，是后端新默认生效的前置条件，代价为列表 12→10，留待拍板                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-18（三） | **后端上线后跑完 live 全路由矩阵**（32 路由 × 真实 slug）：全部符合 §5 契约；5 处 `page/[n]/` 404 经核对**均为正确行为**（resources 7 条 / pages 3 条 / board 13 条 / m4guide 0 条，totalPages 均为 1，越界即 404）。据此关闭 §6#1（post/resources 筛选契约统一 + chips 死链归零，含区分性实测），新增 §6#16（后端忽略 `per_page`）与 §6#17（页脚 `/posts/1/` 死链，属后台菜单数据）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-18（二） | **基础栈重设计（站长拍板）**：mock 整体移除、改 live-only + 站点门禁。新增 §6#15 与 §7 门禁实测段；§6#14 关闭。副作用如实记录：**P0 截图基线从此必须起 Docker WP**。新增 `lib/reachability.ts`（可注入熔断）、`lib/gate.ts`（纯门禁文档）、`lib/aiya/health.ts`（进程级单例）；删除 `lib/aiya/mock.ts` 与 `tests/mock.test.ts`；`npm start` 补 `--env-file-if-exists=.env`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**复核命令**（复现 §1 的计数）：

```bash
find src -type f | wc -l                        # 166
find src -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn   # 69 ts / 50 astro / 45 tsx / 2 css
find src -path '*/components/ui/*' -type f | wc -l              # 18（vendored shadcn）
grep -rn "gap-[0-9.]*" src --include=*.astro --include=*.tsx | grep -v "components/ui" \
  | grep -o "gap-[0-9.]*" | sort | uniq -c | sort -rn           # gap 分布（177 处 / 12 档）
grep -rn "#[0-9a-fA-F]\{3,8\}" src --include=*.astro --include=*.tsx   # tokens.css / gate.ts / 500.astro / theme.ts / page.server.ts
npm run verify                                   # astro check + vitest + build
```

> **本机 `grep` 是 ugrep，字面量模式会假 0（§7 工具坑）**——上面第 1、2、4 行这类
> **计数**命令建议改用 `python` 复算；带字符类（`[0-9.]`）的模式实测正常。

---

## 四、LAYOUT.md 存档全文（旧前端仓原型页面结构；2026-10-02 自 docs/ 退役，现行结构合同见 ARCHITECTURE.md「实现分布」）

# AIYA 页面结构与交互

> 存档说明（2026-09-25）：原稿在旧前端仓 `aiya-astro-bulid/docs/LAYOUT.md`，该仓已从
> 工作区删除，本文件为其存档。视觉令牌与元件以 [`DESIGN.md`](./DESIGN.md) 为准，
> 交互行为与移动端布局以 [`UX.md`](./UX.md) 为准；本文保留页面结构合同与
> 「AI Coding Agent 实现约束」。文末引用的 COMPONENT-KIT.md 未随迁，仅历史参考。

当前范围：AIYA 个人站的 SSR 阅读骨架——资源文章、专题合集、文章与轻社区。本文已移除原型期「游戏 MOD 下载站」语义；旧文档 reference/superseded-LAYOUT.md 仅供历史追溯。

## 全站框架

桌面：左侧品牌/五项主导航/说明；右侧顶部搜索与社区入口；主体；页脚。入口为发现、资源文章、专题、社区、文章。侧栏可收起。移动端隐藏侧栏，主导航放底部，不缩小桌面布局硬塞进屏幕。

页面由「路由 → 模板 → kit 零件」组装：`.astro` 路由只解析参数、取数、设定 HTTP/SEO 并选择模板；页面组合在 `components/templates/`；可复用零件（Header/Sidebar、卡片、循环、筛选、分页、状态）在 `components/kit/`。

## 路由

| 地址              | 内容结构                                                              | 主要操作                                       |
| ----------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| /                 | 三张推荐图片 → 四张精选资源 + 辅助栏 → 专题入口 → 讨论摘要 → 最新资源 | 进入资源、专题、社区或文章                     |
| /resources/       | 专题筛选 → 总数/排序 → 资源网格 → 分页                                | GET 搜索、筛选、排序、翻页                     |
| /resources/{id}/  | 面包屑 → 封面/标题/作者/标签 → 介绍与附件；侧栏信息/许可              | 阅读资源说明，直达附件；真实文件才显示下载链接 |
| /topics/          | 专题图片、名称、资源数                                                | 进入指定专题的资源列表                         |
| /community/       | 话题标签 → 动态流 → 分页；辅助说明栏                                  | 分享/求助/晒图筛选、打开讨论                   |
| /community/{id}/  | 正文、图片、关联资源、回复                                            | 阅读讨论、跳转关联资源                         |
| /posts/           | 文章分类、排序、列表、分页                                            | 分类筛选和阅读                                 |
| /posts/{id}/      | 标题、摘要、作者与时间、正文、相邻文章                                | 阅读文章                                       |
| /profile/         | 个人主页（演示账号）：横幅、身份、动态、收藏、订阅                    | 查看收藏与订阅状态                             |
| /forgot-password/ | 注册邮箱表单 → 发送重置链接                                           | 找回密码                                       |
| /reset-password/  | 新密码表单（链接携带 login/key），成功提示重新登录                    | 设置新密码                                     |

## 信息优先级与状态

资源卡保留专题、标题、图片、标签与作者；详情保留说明、附件状态与许可。讨论保留作者、正文、话题与关联资源。辅助推荐可在小屏隐藏，错误原因和附件状态不能隐藏。

列表有空状态；参数无效返回400；详情不存在返回404；上游失败返回502/503/504并提供恢复入口。查询是URL状态，筛选重置页码、保留排序。资源与社区使用后端分页，不在浏览器获取全量后过滤。分页越界返回空结果，保留真实统计。

首页板块来自 /home，主导航来自 /menus/primary。登录/注册在顶部弹窗完成，会话由服务端 HttpOnly cookie 承载（WP 不透明令牌，不经浏览器脚本）；找回/重置密码为独立页面。作者页、收藏、提交资源、发帖在业务域和授权落地后再加入；当前不提供假交互。

## AI Coding Agent 实现约束

1. 从上表选择对应页面结构，不自行创建第二套全局 Shell。
2. AppShell 负责文档、SEO 与插槽；Header、Sidebar、Footer、导航统一使用 React kit，不在工具栏重复侧栏主导航。
3. 页面由路由选择模板（`components/templates/`），模板只用 kit 零件组装页面分区；同一模板可被多个路由复用，同一零件可在不同模板中按语境选 variant。
4. 内容列表与社区动态使用不同 Loop/Card；相同对象按出现语境选 variant。
5. 每个页面保持一个主要任务，辅助 rail 可省略，窄屏后置；移动端通过重排完成，不简单缩小桌面。
6. 页面优先保留主体内容、版本与操作状态，其次保留相关信息，最后才是宣传推荐；空/加载/错误状态必须明确。
7. 视觉参数放 DESIGN/tokens；布局规则放本文与 CSS；不让 API DTO 决定任意 React 组件名或脚本。
8. `.astro` 路由只解析参数、服务端取数、设定 HTTP/SEO 和选择模板。业务组件只接收公开 DTO 与插槽，不读取环境变量或直接 fetch WP。
9. 交互岛从 React 叶子模块导入，并按需使用 client:load/visible。整页视图默认 SSR，不加 client:only，不引入第二套路由器。

组件入口与组合示例见 [COMPONENT-KIT.md](COMPONENT-KIT.md)。
