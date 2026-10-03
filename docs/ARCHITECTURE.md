# front-station — 架构与实现约定

> **定位**：本文件是前端架构分层与实现约定的活文档，改动前先读这里。分工：
> 项目介绍与部署见 [`../README.md`](../README.md)；**契约文档**（稳定判据，
> 只写「是什么、什么是允许的」，不含计划与状态）：视觉刻度与令牌见
> [`DESIGN.md`](./DESIGN.md)、交互判据见 [`UX.md`](./UX.md)；迭代史、批次
> 记录与已关闭台账见 [`HISTORY.md`](./HISTORY.md)——**契约文档变更先于
> 代码，执行记录只进 HISTORY**。
> 后端契约真源在 `aiya-core/src/Api/Contract/`，冻结基线为
> `src/lib/core/contracts.snapshot.v1.json`（vitest 逐 DTO 比对执法）。

## 分层（依赖只能向下）

```
pages/            路由：参数解析 → loadPage → HTTP 状态 → SEO，不写业务逻辑
components/layout/  双壳（全 Astro，零水合，992px 断点切换）：
                  AppShell（唯一入口：主内容单次渲染）+
                  desktop/（DesktopSidebar 190/76px、DesktopHeader）+
                  mobile/（MobileTopBar 含搜索展开行与暗色切换、TabBar
                  前 4 项+「更多」、MobileMenuDrawer 全菜单抽屉）+
                  共享件（BaseHead、PageHeader、PageState、Icon）。布局交互 =
                  委托式原生 <script>（document 级监听，ClientRouter 换页后
                  天然存活；共享触发点如暗色切换的监听只挂一份，归 AppShell）；
                  ClientRouter 提供 SPA 导航
components/islands/  React 岛：UserCenter（登录窗/注册窗/通知气泡/用户菜单/
                  钱包气泡/会员弹窗，shadcn 零件组装）、PostLoop、
                  CommunityFeed、CommentSection、详情三壳岛等，按需增补
components/ui/      shadcn 控件，只服务 islands/，壳不导入
lib/core/         contracts.ts（zod 线上契约，后端 PHP DTO 的逐字段镜像，
                  改后端先改这里；显示文本字段经 wpText 在解析时统一做一次
                  WP 实体解码——HTML 载荷字段与讨论 #标签# 刻意不解）→
                  client.ts（唯一 transport：基址校验、超时、写路由白名单、
                  响应全量 safeParse、错误只透出 status+requestId+aiya_* 码）→
                  server.ts（secret 类环境变量唯一入口；island/browser 导入
                  即构建失败。WP origin 是登记过的第二入口：lib/wp-env.ts
                  直读 process.env——media 链被岛引用、浏览器 bundle 无
                  process，文件内自带守卫）→
                  session.ts（Bearer → HttpOnly cookie，失败降级游客）→
                  errors.ts（错误分类，从不携带上游正文）。health.ts（进程级
                  熔断器，503 门禁的探活核心）与 contracts.snapshot*.json
                  同住此目录。入站枚举收窄点带 zod `.catch` 安全缺省（后端
                  先发未知枚举值时按字段降级而非拒收载荷）；结构性枚举
                  （role/visibility/type/badges/kind/discussionStatus/
                  commentStatus/locale）刻意保持严格——新增值需要前端同步支持
lib/i18n/         前端自有文案：locale 解析 user.locale → site.language →
                  zh_CN；字典属性访问（支持函数值插值），四语言结构由类型 + 测试锁齐
lib/seo.ts        JSON-LD 纯函数（WebSite / Article / BreadcrumbList）+ robotsTxt()
lib/content.ts    唯一 HTML 净化边界（sanitize-html 白名单）
```

## 实现分布

分工总则：_*布局外壳（侧栏/顶栏/TabBar/面包屑/页脚/BaseHead）、基础设施
（/api/* 同源代理、middleware 媒体代理与 308 规范化、lib/ 取数加载器与
SEO）、路由与请求器（pages/ → loadPage → HTTP 状态）全归 Astro；页面主体的
动态部分由 React 岛承担_*，shadcn 零件只服务岛。取数一律下沉 `lib/` 加载器
由页面 frontmatter 调用（组件级 `Astro.response.status` 赋值会被静默忽略）；
岛的 props 只传可序列化数据（函数会静默丢失，Astro 侧预格式化为字符串）。

| 路由                                                           | 主体实现                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/posts/` `/resources/` `/pages/`（列表/分类/标签/分页）       | `PostLoop` 岛（筛选面板/排序/多选/排队请求）                                                                                                                                                                                                                                   |
| `/posts/{slug}/` `/resources/{slug}/` `/pages/{slug}/` 详情    | 正文 SSR（净化 HTML + 灯箱 class 注入）+ 交互岛：`LikeButton`、`RatingRow`（resource）、`FavoriteButton`、`CommentSection`（关闭态内置）、`UnlockGate`、`PostDiscussions`；上下篇仅 post；相关文章 SSR 列表；文件下载面板（`/api/content/{id}/downloads`）；可见性门禁占位面板 |
| `/categories/` `/categories/{slug}/`                           | `CategoryCards` 岛（汇总网格 + 详情页头复用）                                                                                                                                                                                                                                  |
| `/search/{key}/`（+`page/[n]/`）                               | 顶栏 `SearchBox` 岛提交目标；结果是 `PostLoop` 岛；范围 `?type=`（全部=三类型并集轮转读，见 `lib/search.ts`）                                                                                                                                                                  |
| `/community/`（板块/首页）                                     | `CommunityFeed` + 社区表单岛                                                                                                                                                                                                                                                   |
| `/notifications/`                                              | `NotificationFeed` 岛（头部铃铛的全量列表页：同源代理 + 前端本地已读态，无会话门，恒 noindex）                                                                                                                                                                                 |
| `/profile/{slug}/` `/profile/me` `/settings` `/reset-password` | `UserCenter` / `SettingsPanel` / `ResetPasswordPanel` 等账号岛                                                                                                                                                                                                                 |
| 会员/积分（无独立路由）                                        | 钱包气泡 `WalletBubble` + 会员弹窗 `MembershipModal`（档位定价/兑换/收银台与签到/账本），挂于 `UserCenter`                                                                                                                                                                     |
| 旧 `/category/` `/tag/` 形态                                   | 已整树删除（404）——分类统一入口 `/categories/`，标签过滤为列表页 `?tag=` 参数态                                                                                                                                                                                                |

### 详情页约定

- 评论关闭（后端 `commentsOpen=false`）时评论区渲染禁用态而非隐藏；锁文/门禁
  正文为空时评论一并隐藏（WP 语义：锁文评论读取 404）；密码解锁不落
  cookie——解锁响应即解锁后的完整详情，岛内原位替换正文，冷刷新重新上锁。
- 正文模板零件为 HTML-first 标记（`details/alert/dl/span[data-clipboard-slot]/
part-button`），剪贴板零件由正文零件的 effect 绑定复制按钮；正文图片带后端
  注入的 `aiya-lightbox` class。
- **详情三壳岛**（`islands/detail/`）：`PostDetail`/`ResourceDetail` 两栏
  （左正文、右侧栏作者卡/附件/相关文章），`PageDetail` 全宽；零件全部拆进
  `detail/parts.tsx`，壳负责组装，hydration 边界只在壳上。SSR 页只做取数 +
  SEO 头，`loadPage` 把 /site 载荷传进取数闭包。
- **恒 hero 头部**：后端 PostPresenter 的 featured 解析链保证该字段恒有值
  （文章特色图 → 站点兜底封面，同走裁剪管线）。ArticleHeader 单一 hero 结构
  （行 1 作者/日期/计数、行 2 标题+徽章+操作栏）；喜欢/收藏/评分均为实底
  shadcn Button，写请求带旋转器，成败走 sonner toast。

### 评论域

- 评论体为受限 HTML：后端 kses 白名单写入+读取双跑；前端
  `sanitizeCommentHtml` 纵深复核（图片仅放行 /media/ 源与表情）。共享
  tiptap 编辑器 `RichEditor` 复用进评论作曲器，登录用户可传图（走
  `/api/uploads/image`）。
- 列表按 /site 设置渲染：`threadComments/threadCommentsDepth` 建树折叠、
  `commentOrder` 逐层反转、`commentsPerPage` 分页、`defaultCommentsPage`
  决定取数窗口方向（后端列表 `order=asc|desc`，desc 时第 1 页=最新窗口）。
- 门禁设置驱动：`commentRegistration` 投影进 /site.comments——true=结构性
  登录墙；false=游客按 WP 原生身份经同一 `wp_new_comment` 管线发评（审核/
  防洪/去重全生效）；评论 POST 代理对无会话请求放行，由后端按设置裁决。

## UI 基建

- **壳 = ClientRouter + 纯 vanilla**：布局交互不值得水合。侧栏折叠、配色
  切换、路由进度条全部委托式原生脚本。**例外即 UserCenter 岛**
  （`client:load`，双壳各挂一实例，须做可见性去重）；提交走同源代理
  `/api/auth/*`，错误只出前端文案，成功 reload 让 SSR 壳接新会话。通知未读
  点是契约约定的前端本地 last-seen（localStorage）。
- **shadcn/ui 零件**：已装 alert-dialog/badge/button/card/checkbox/dialog/
  dropdown-menu/empty/field/input-group/input/label/pagination/popover/
  radio-group/select/separator/sonner/switch/tabs/textarea（tooltip 曾装已摘、
  slider 零消费方已删，需要时 `npx shadcn@latest add` 回装）。
  约定：零件只允许 islands/ 导入（唯一破例 = AppShell 挂载的
  `<Toaster />`，ui/sonner——吐司是全局单例，壳层挂载、`client:only`
  渲染）；sonner 主题读壳的
  `html.dark`；以后加件
  `npx shadcn@latest add <name> --yes`。
- **装/卸依赖后必须重启 dev**（Vite 依赖预打包换 hash，不重启岛水合会静默
  504）。重启后仍失效（岛水合静默死亡、`/node_modules/.vite/deps/*` 全
  404）时，删 `node_modules/.vite` 再重启——预打包缓存与模块图不一致是排障
  盲区。
- **图标**：`layout/Icon.astro` 按 lucide-static 命名空间查表（`lib/icons.ts`，
  kebab/camel/Pascal 名均可，未知名回退 chevron），服务端渲染零 JS；React
  岛内才用 lucide-react。
- **动画**：`tw-animate-css`；动效令牌 `--duration-fast/base/slow` +
  `--ease-standard`，`prefers-reduced-motion` 全局豁免（tokens.css）。
- **空态/错误卡片**：`PageState.astro`（shadcn Empty 卡片样式），占位图来自
  后台 `defaults.emptyImage`；500 与 503 门禁是刻意零依赖的内联独立页。

## 约定

- **认证**：令牌只在 HttpOnly cookie；认证/用户/评论写操作走同源代理
  （`/api/*`）。**代理错误契约**：所有失败响应为 `{ok:false, code?}`
  （code = 契约信封机器码 `aiya_*`，login/register 另带前端文案 message）。
- **错误文案**：`apiErrorCopy(error, locale)`（`lib/feedback`）为全站唯一
  出口；后端 message 永不透出。错误码字典在 `lib/i18n/dictionaries/*`，新增
  后端错误码时四个字典同步补齐（`tests/i18n.test.ts` 执法）。
- **SEO**：后端不可达时整站失败闭锁（robots 全禁、sitemap 空 urlset、门禁页
  noindex）；筛选/搜索态 noindex，分类归档可索引。标签无独立归档路由——
  标签云页取消的拍板把标签过滤落在列表页 `?tag=` 参数态（同为筛选态
  noindex），`refHref(term)` 按标记的 taxonomy 分流：category →
  `/categories/{slug}/`、tag 词汇 → `/posts/?tag={slug}`；
  canonical 由 href 构造器生成；结构化数据经 `lib/seo.ts`。
- **保留 slug**：首段 `page`、`me`（`/profile/me/`，显式 404）、`board` 为
  路由保留字——内容 slug 撞上时永远落到兜底重定向而非内容。
- **`/site` 携带 shell 配置**（源自后端 Frontend 设置页）：`favicon` 接管
  站点图标、`registrationOpen` 控制注册入口显隐、`defaults.colorMode` 供
  BaseHead 预涂装解析明暗、`banner` 为首页限定装饰、`footer` 备案字段由
  Footer 渲染。菜单图标（`MenuItem.icon`，Lucide 名）设置值优先、URL 形状
  回退；secondary 组即页脚菜单。
- **部署前提（`AIYA_CLIENT_IP_HEADER`）**：配置该头后，访客地址取自边缘代理
  盖章的头；边缘**必须先剥离客户端自带的同名头**，否则访客可伪造地址绕过
  限流与去重。缺省（socket 地址）无此前提。

## 实现契约

1. **Server Islands 承载 viewer 相关低时效片**（`server:defer`，Astro 7 稳定
   特性）：评论数/点赞数/登录态头像菜单等可用 `.astro` 服务岛（零 React）。
   当前全页 SSR 时这些组件直接内联渲染；未来某路由开 prerender 时，同一
   组件加 `server:defer` 即变成请求时插槽，组件代码不变。
2. **prerender 路由缓存延后**到页面全部完成后迭代（届时逐路由开
   `prerender = true`，配合 WP webhook → `/api/revalidate` 全量重建 + 去抖）。
   **路由形状纪律现在生效**：分页与分类必须路径化，搜索与账号域保持
   SSR——query 参数会被静态文件吞掉，严禁把筛选放 query。
3. **浏览器只接触 Astro 域名**（单源架构）：
   - 计数端点（like/view/rating）走 `/api` 代理，浏览器不直连 WP。
   - **aria2 推送例外（唯一不经 /api 的 fetch）**：下载面板的 RPC 推送
     直连访客本机的 aria2（`http://localhost:6800/jsonrpc`，用户需开
     `--rpc-allow-origin-all`）——推送目标是用户自己的机器，代理不了，
     也无需代理。
   - **反代桥**：wp-config 定义 `AIYA_PROXY_SECRET` 常量后，aiya-core
     `TrustedProxy` 模块在请求携带匹配 `X-Aiya-Proxy-Secret` 头时把
     `X-Forwarded-For` 首段采信为访客 IP（限流/计数哈希/评论 IP 三处共用；
     秘钥不匹配或未配置回落 REMOTE_ADDR）。前端全部 `/api` 代理经
     `lib/visitor-ip.ts` 解析访客地址并恒携秘钥头 + XFF。
   - **媒体隐身（/media/ 前缀）**：`lib/media.ts` 的 `rewriteMediaUrl`/
     `rewriteSrcset` 只把 WP origin 的 `/wp-content/` URL 改写为
     `/media/...`（permalinks、gravatar、第三方外链原样放行）；正文 HTML 的
     改写挂在 `lib/content.ts` 的 sanitize-html `transformTags` 钩子里。服务
     端 `lib/media-proxy.ts`（由 **middleware 调用**而非路由——路由会在无尾
     斜杠文件型路径上先 404）流式透传：支持 Range、透传
     Content-Type/ETag/Last-Modified、`Cache-Control: public, max-age=604800`；
     白名单强制 `wp-content/` 前缀，**`wp-json` 永不可达**，拒绝穿越与百分号
     编码。每条进入浏览器的数据路径都在 `/api/*` 代理层完成 cloak，岛屿端
     保留的改写调用只是幂等纵深防御。Astro Image 暂不接入：正文图无法组件
     化、`/_image?href=` 泄漏 WP 地址、后端封面已是优化 webp——因此 astro
     check / 编辑器对裸 `<img>` 的「Use the Image component」提示属预期，
     不处理（hints 不计入 check 结果）。
   - **URL 改写面**：DTO `Image.url`、正文 HTML 的 img src、评论头像——消费
     点统一过 `rewriteMediaUrl`（og:image 由 BaseHead 把 `/media/` 路径拼回
     本域绝对地址）；FileServe 下载直链、爱发电/易支付跳转不属于隐藏范围
     （本就是第三方域）。
4. **零路由消费面（引用标记词汇表）**：后端任何输出不携带前台路径——路由
   模板 100% 前台自建。消费基础设施在 `lib/content.ts`：`refHref` 按六种
   `data-aiya-ref` 句柄解析路由（post→`/{posts|pages|resources}/{slug}/`、
   comment→父文路由 `#comment-{id}` 深链、user→`/profile/{nicename}/`、
   term→`/categories/{slug}/`（标记带 taxonomy：tag 词汇分流到
   `/posts/?tag={slug}` 过滤态）、search→`/search/{q}/`、thread→
   `/community/board/{board}/`），经共享 `anchorTransform` 挂在三个 sanitize
   边界（`safeContent`/`sanitizeDiscussionHtml`/`sanitizeCommentHtml`）——
   解析成功补 href、传输用 data 属性即剥（前台 HTML 洁净），句柄不可用降级
   为无 href 惰性文本。正文内提及蓝链与 `[ref]` 零件标记同走此通道；详情
   JSON-LD 的路由也由 `postRoute(type, slug)` 自建（seo.ts，面包屑仅
   label+position）。
5. **通知标题是通知 HTML**：`/notifications` 的 `title` 携带后端产出的软
   引用锚（零路由），前台经 `sanitizeNotificationHtml`（只放行 a+href/title
   的最小面）消费——解析成路由链接、剥传输属性；不可解析行天然退化为纯文
   本。`body` 保持纯文本摘录。渲染点唯一：`NotificationPopover` 的
   `FeedRow`（头版气泡与 `/notifications/` 页共用）。
