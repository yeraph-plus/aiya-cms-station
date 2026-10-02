# front-station

AIYA CMS 的 Headless 前端（Astro 7 SSR + Tailwind v4 + zod）。只通过 `aiya/core/v1`
消费 WordPress（`wp-content/plugins/aiya-core`）；后端契约见
`aiya-core/src/Api/Contract/`，迁移总览见 `D:\WordPress_Dev\AGENTS.md` 与
`aiya-core/docs/ROADMAP.md`。

## 运行

```bash
npm install
cp .env.example .env      # 指向 WP 后端（无后端时站点进 503 门禁）
npm run dev               # 开发（需 WP 后端在线）；astro dev stop 停守护进程
npm run verify            # astro check + vitest + format:check + build
npm test                  # 单测（契约不变式 / i18n / SEO / 净化 / 门禁与熔断 / 会员）
```

环境变量（服务端专用，经 `astro:env/server` 读取，绝不会进入浏览器产物）：

| 变量                         | 说明                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AIYA_SITE_URL`              | 前端站点自身 origin（canonical / sitemap / cookie secure 判定）                                                                                                                                                                                        |
| `AIYA_WP_API_URL`            | 后端契约根，必须以 `/wp-json/aiya/core/v1/` 结尾；其 origin 必须与 WP 的 siteurl 一致（见下方「媒体单源与 origin 一致性」）                                                                                                                            |
| `AIYA_API_TIMEOUT_MS`        | 上游超时，默认 8000                                                                                                                                                                                                                                    |
| `AIYA_ALLOW_LOCAL_HTTP`      | 仅 loopback 允许 HTTP 的开发开关                                                                                                                                                                                                                       |
| `AIYA_PROXY_SECRET`          | 反代桥共享秘钥（须等于 wp-config 的 `AIYA_PROXY_SECRET` 常量）                                                                                                                                                                                         |
| `AIYA_CLIENT_IP_HEADER`      | 可选：信任的访客地址请求头（如 `X-Real-IP`），缺省 socket 地址                                                                                                                                                                                         |
| `AIYA_SESSION_COOKIE_DOMAIN` | 可选：aiya_session 的 Domain 属性（如 `site.name`）——子域兄弟应用共享登录态时设置，浏览器将把会话 cookie 发给该域全部子域；域下所有子域必须是一方应用（cookie 携带访客 bearer），未设置 = 仅前端自身主机可收；配置畸形或不匹配站点主机名时 fail-closed |

**无机器身份**（2026-09-10 拍板）：前台不做管理/预览能力，内容读全部匿名——
`serverClient()` 不持有任何 WP 账号；浏览器端仅存访客各自的 Bearer（HttpOnly
cookie）。后端计划整体禁用 WP 原生端点，与本架构完全兼容；未来若需要预览/
管理能力，再引入服务账号。

## 生产部署（Docker）

镜像一次构建、运行时注入配置——`astro:env` 读的是进程环境，没有任何配置值
烘焙进构建产物，`.env` 永不进镜像（`.dockerignore`）。升级 = 重新 build 换容器。

```bash
docker build -t aiya-cms-build .
# 受限网络经转存源构建（正常服务器不需要）：
#   --build-arg NODE_IMAGE=docker.1ms.run/library/node:24-alpine
#   --build-arg NPM_REGISTRY=https://registry.npmmirror.com

docker run -d --name aiya-cms-build --restart unless-stopped   -p 4321:4321   -e AIYA_SITE_URL='https://前端域名/'   -e AIYA_WP_API_URL='https://WP域名/wp-json/aiya/core/v1/'   -e AIYA_PROXY_SECRET='与 wp-config 的 AIYA_PROXY_SECRET 常量同值'   aiya-cms-build
```

编排示例（贴进服务器现有 compose 即可，healthcheck 已内置在镜像里）：

```yaml
services:
  front:
    image: aiya-cms-build:latest
    restart: unless-stopped
    ports:
      - '4321:4321'
    environment:
      AIYA_SITE_URL: https://前端域名/
      AIYA_WP_API_URL: https://WP域名/wp-json/aiya/core/v1/
      AIYA_PROXY_SECRET: change-me
      # AIYA_CLIENT_IP_HEADER: X-Real-IP   # 仅当最前置一层代理且已保证剥离客户端同名头
```

### 自动发布（GitHub Actions）

`.github/workflows/release.yml`：push 到 `main` 或打 `v*` 标签时自动跑
`npm run verify`（类型 + 单测 + 格式 + 构建），全绿后 buildx 构建镜像并推送
GHCR——`ghcr.io/<仓库属主>/aiya-cms-build`，`latest` 跟随 main、`v*` 标签出
语义化版本 tag、每次构建另带 `sha-<短哈希>` 供回滚钉版；层缓存走 GHA。
服务器侧只需：

```bash
docker pull ghcr.io/<仓库属主>/aiya-cms-build:latest
```

首次发布后包默认 private，按需在 GitHub 包设置页改 public（或保留 private
并在服务器 `docker login ghcr.io`）。本机构建时按受限网络照旧传两个
`--build-arg`（CI 上直连 docker.io 无需）。

### 反代由你自己的 nginx 托管（容器只出明文 HTTP）

镜像不持有证书、不做 TLS——容器进程就是一个普通 node 服务，监听
`0.0.0.0:4321`。线上拓扑：**你的 nginx 终结 HTTPS → `proxy_pass` 到容器**。
建议发布端口时只绑 loopback，容器不直接对公网：

```bash
docker run -d --name aiya-cms-build --restart unless-stopped   -p 127.0.0.1:4321:4321   -e AIYA_SITE_URL='https://前端域名/'   -e AIYA_WP_API_URL='https://WP域名/wp-json/aiya/core/v1/'   -e AIYA_PROXY_SECRET='与 wp-config 的 AIYA_PROXY_SECRET 常量同值'   -e AIYA_CLIENT_IP_HEADER='X-Real-IP'   aiya-cms-build
```

对应的 nginx server 块（可直接改域名粘贴）：

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name 前端域名;

    ssl_certificate     /etc/nginx/certs/前端域名.pem;
    ssl_certificate_key /etc/nginx/certs/前端域名.key;

    # 上传走 /api/uploads/image（镜像内限 5MB+开销），默认 1m 必炸
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 访客 IP 链：容器凭 AIYA_CLIENT_IP_HEADER 采信 X-Real-IP。
        # proxy_set_header 是「设置」语义，客户端伪造的同名头在此被覆盖——
        # 反代桥的「边缘先剥离同名头」前提由此满足。
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }

    # 静态媒体命中率高，可在此加 nginx 层缓存（前端已给 /media/ 发
    # Cache-Control: public, max-age=604800，nginx 原样透传即可，勿叠加）
}
```

检查单要点的对应关系：

- `AIYA_SITE_URL` 填你的 https 域名（canonical / sitemap / cookie Secure 全靠它）；
- `AIYA_CLIENT_IP_HEADER='X-Real-IP'` 必配——否则容器看到的 socket 地址恒为
  nginx（127.0.0.1 或 docker 网关），全站访客共享同一个限流桶；
- 后端一跳：`AIYA_WP_API_URL` 用 WP 的真实 https 域名，公网证书无需任何额外
  信任配置（本机试跑的自签垫片仅限开发机）。

部署检查单：

- WP 侧 `wp-config` 定义 `AIYA_PROXY_SECRET` 常量且与容器注入值一致——反代桥
  生效的前提，否则限流/访客去重退化为本机共享桶（0.82.0 拍板）。
- `AIYA_SITE_URL` 必须是最终对外 origin（生产为 https）：cookie `Secure` 判定、
  canonical、sitemap、JSON-LD 全靠它；解析失败时站点 fail-closed 进 503 门禁
  并在容器日志 `console.error` 报死。
- 反代（nginx/CDN）→ 容器：透传 `Host` 与 `X-Forwarded-Proto`；容器只暴露在
  内网或反代之后，不必直接对公网。
- `AIYA_ALLOW_LOCAL_HTTP` 不进生产（仅 loopback HTTP 的开发开关）。
- 容器以非 root 的 `node` 用户运行；HEALTHCHECK 探测本进程（后端宕机时的 503
  门禁页也算健康——它检查的是前端容器，不是 WP）。

### 媒体单源与 origin 一致性（必读）

浏览器只与前端域名通信：页面、`/api/*`（同源 JSON 代理）与 `/media/*`（媒体
代理，`/media/x` ≙ WP 的 `wp-content/x`——`wp-content` 段由代理在服务端补回，
公开 URL 不带 WP 指纹；旧形态 `/media/wp-content/x` 仍解析到同一文件）都挂在
前端 origin 下。所有 WP 媒体
URL 的改写都发生在**服务端**——浏览器 bundle 不持有 WP origin（`AIYA_WP_API_URL`
是非公开环境变量，Vite 不进客户端产物，客户端即便调用改写也是空转）。因此每条
进入浏览器的数据路径（feed / 评论 / 社区 / 表情包 / 登录与头像投影）都在 `/api/*`
代理层完成 cloak，岛屿端保留的改写调用只是幂等的纵深防御。

这要求一条部署铁律：**WP 的 siteurl 必须与 `AIYA_WP_API_URL` 的 origin 一致**。
后端 `content_url()` 等按 siteurl 产出媒体绝对 URL，改写靠 origin 匹配——两边
不一致（比如 siteurl 还停在 `http://127.0.0.1:8000` 而契约根已是 https 域名）时
匹配全部失配，缩略图/头像/表情包会原样泄漏 WP 主机并直连加载。

按计划的线上形态（WP 在 `admin.site.name`，前端在 `www.site.name`）：

- WP 后台「设置 → 常规」两个地址都填 `https://admin.site.name`（`content_url()`
  由此产出匹配的媒体 URL）；
- 容器注入 `AIYA_SITE_URL='https://www.site.name/'`、
  `AIYA_WP_API_URL='https://admin.site.name/wp-json/aiya/core/v1/'`；
- nginx 两个 server 块分别反代 `www.site.name` → 前端容器 4321、
  `admin.site.name` → WP（后者同时承载 `/wp-admin` 与支付回调）；
- 浏览器侧对 `admin.site.name` 应当**零请求**——线上验收时开发者工具里不应
  出现任何指向 WP 域名的资源加载。

### 本机试跑（WP 尚无 https 域名时）

契约要求非 https 后端必须是 loopback 主机名，容器内达不到——本机可用 nginx +
自签证书给 WP 拟一个 https 域名，完整模拟生产拓扑（2026-09-25 实测通过）：

1. 自签证书 `SAN=DNS:wp.demo`；nginx 443 → `wp_app:80`，加
   `proxy_set_header X-Forwarded-Proto https`（让 WP 产出 https 绝对 URL）和
   `sub_filter ':\/\/127.0.0.1:8000' ':\/\/wp.demo'`（REST JSON 的斜杠是
   转义形态，过滤器必须匹配转义串；`sub_filter_types application/json`，
   `Accept-Encoding` 置空）。
2. 前端容器 `AIYA_WP_API_URL='https://wp.demo/wp-json/aiya/core/v1/'` +
   `NODE_EXTRA_CA_CERTS=/certs/cert.pem` 信任自签证书。
3. Windows 的 Git Bash 执行 docker/openssl 命令记得 `MSYS_NO_PATHCONV=1`，
   否则容器侧路径会被改写成 Git 安装目录（曾把 nginx.conf 挂载变成目录）。

## 分层（依赖只能向下）

```
pages/            路由：参数解析 → loadPage → HTTP 状态 → SEO，不写业务逻辑
components/layout/  双壳（全 Astro，零水合，**992px 断点切换**）：
                  AppShell（唯一入口：主内容单次渲染）+
                  desktop/（DesktopSidebar 190/76px、DesktopHeader）+
                  mobile/（MobileTopBar 含搜索展开行与暗色切换、TabBar
                  前 4 项+「更多」、MobileMenuDrawer 全菜单抽屉——
                  2026-09-25 移动壳就绪，UX.md §6 布局合同）+
                  共享件（BaseHead、PageHeader、PageState、Icon）。布局交互 =
                  委托式原生 <script>（document 级监听，ClientRouter 换页后
                  天然存活；共享触发点如暗色切换的监听只挂一份，归 AppShell）；
                  ClientRouter 提供 SPA 导航。
components/islands/  React 岛：`UserCenter` 已落（2026-09-11 拍板：认证与
                  用户区整体迁出 Astro——登录窗/注册窗/通知气泡/用户菜单
                  气泡，shadcn 零件组装，见下「UI 基建」）；社区表单、评论框
                  按需增补
components/ui/      shadcn 控件（已装必备件：button/input/label/textarea/
                    dialog/alert-dialog/dropdown-menu/tooltip/sonner），
                    只服务 islands/，壳不导入
lib/core/         contracts.ts（zod 线上契约，后端 PHP DTO 的逐字段镜像，改后端
                  先改这里；显示文本字段经 wpText 在解析时统一做一次 WP 实体
                  解码——the_title/the_excerpt 的 wptexturize 线上形态
                  （&#8211; 等）在契约层还原为真实字符，SSR 与 /api/* 代理
                  同源受益；HTML 载荷字段（content.html/contentHtml/bodyHtml）
                  与讨论 #标签#（闭环搜索须匹配原文）刻意不解；解码用 entities
                  包的 decodeHTML——@wordpress/html-entities 是 DOM 实现、
                  SSR 即崩）→ client.ts（唯一 transport：基址校验、超时、写路由
                  白名单、响应全量 safeParse、错误只透出 status+requestId+aiya_*
                  码）→ server.ts（环境变量唯一入口；island/browser 导入即构建
                  失败）→ session.ts（Bearer → HttpOnly cookie，失败降级游客）→
                  errors.ts（错误分类，从不携带上游正文）；health.ts（进程级
                  熔断器，503 门禁的探活核心）与 contracts.snapshot*.json
                  （后端生成、vitest 比对的快照）同住此目录。snapshot.v1.json
                  为冻结基线（单向加法锁；2026-10-01 修订到 live 形状——
                  0.93.0 的替换形状 HomeSection/sections 此前漏吸收）。
                  入站枚举收窄点带 zod `.catch` 安全缺省：后端先发未知枚举值
                  时按字段降级而非拒收载荷（/site 字段拒收 = 整站 503），
                  降级行为由 tests/contracts.test.ts 锁定；结构性枚举
                  （role/visibility/type/badges/kind/discussionStatus/
                  commentStatus/locale）刻意保持严格——新增值需要前端同步支持
lib/i18n/         前端自有文案（D8）：locale 解析 user.locale → site.language →
                  zh_CN；字典属性访问（支持函数值插值），四语言结构由类型 + 测试锁齐
lib/seo.ts        JSON-LD 纯函数（WebSite / Article / BreadcrumbList）
lib/content.ts    唯一 HTML 净化边界（sanitize-html 白名单）
```

### 实现分布（2026-09-16 审计定稿）

分工总则：_*布局外壳（侧栏/顶栏/TabBar/面包屑/页脚/BaseHead）、基础设施
（/api/* 同源代理、middleware 媒体代理与 308 规范化、lib/_ 取数加载器与
SEO）、路由与请求器（pages/ → loadPage → HTTP 状态）全归 Astro；页面主体的
动态部分由 React 岛承担**，shadcn 零件只服务岛。取数一律下沉 `lib/` 加载器由
页面 frontmatter 调用（组件级 `Astro.response.status` 赋值会被静默忽略）；
岛的 props 只传可序列化数据（函数会静默丢失，Astro 侧预格式化为字符串）。

| 路由                                                           | 主体实现                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/posts/` `/resources/` `/pages/`（列表/分类/标签/分页）       | `PostLoop` 岛（筛选面板/排序/多选/排队请求）                                                                                                                                                                                                                                                                                                                                   |
| `/posts/{slug}/` `/resources/{slug}/` `/pages/{slug}/` 详情    | 正文 SSR（净化 HTML + 灯箱 class 注入）+ 交互岛：`LikeButton`（post/page）、`RatingRow`（resource）、`FavoriteButton`、`CommentSection`（关闭态内置）、`UnlockGate`（密码锁原位换内容）、`PostDiscussions`（社区贴，仅 post）；上下篇仅 post；相关文章 SSR 列表；文件下载面板（`parts.tsx` 的 FileServe 面板，`/api/content/{id}/downloads`）；可见性门禁（登录/会员）占位面板 |
| `/categories/` `/categories/{slug}/`                           | `CategoryCards` 岛（汇总网格 + 详情页头复用）                                                                                                                                                                                                                                                                                                                                  |
| `/search/{key}/`（+`page/[n]/`）                               | 顶栏 `SearchBox` 岛的提交目标；结果是 `PostLoop` 岛（无筛选器，左槽 `heading` 显示关键词）；范围 `?type=`（全部=三类型并集轮转读，见 `lib/search.ts`）                                                                                                                                                                                                                         |
| `/community/`（板块/首页）                                     | `CommunityFeed` + 社区表单岛                                                                                                                                                                                                                                                                                                                                                   |
| `/profile/{slug}/` `/profile/me` `/settings` `/reset-password` | `UserCenter` / `SettingsPanel` / `ResetPasswordPanel` 等账号岛                                                                                                                                                                                                                                                                                                                 |
| 会员/积分（无独立路由）                                        | 钱包气泡 `WalletBubble` + 会员弹窗 `MembershipModal`（内含 `MembershipPlans` 档位定价/兑换/收银台与 `WalletPanel` 签到/账本），挂于 `UserCenter`（/profile/me）                                                                                                                                                                                                                |
| 旧 `/category/` `/tag/` 形态                                   | 已整树删除（404）——分类统一入口为一级路由 `/categories/`，标签过滤为列表页 `?tag=` 参数态                                                                                                                                                                                                                                                                                      |

详情页交互约定：评论关闭（后端 `commentsOpen=false`）时评论区渲染禁用态而非
隐藏；锁文/门禁正文为空时评论一并隐藏（WP 语义：锁文评论读取 404）；密码
解锁不落 cookie——解锁响应即解锁后的完整详情，岛内原位替换正文，冷刷新重
新上锁；正文模板零件为 HTML-first 标记（`details/alert/dl/
span[data-clipboard-slot]/part-button`），剪贴板零件由正文零件的 effect 绑
定复制按钮；正文图片带后端注入的 `aiya-lightbox` class（灯箱岛后批）。

**详情页岛屿渲染（2026-09-17 拍板落地）**：`islands/detail/` 三个布局壳岛按
类型分工——`PostDetail`/`ResourceDetail` 两栏（左正文、右侧栏作者卡/附件/
相关文章），`PageDetail` 全宽；零件全部拆进 `detail/parts.tsx`（DetailMeta/
BadgeChips/TaxonomyChips/ArticleBody/ActionRow/PrevNextNav/RelatedList/
AuthorCard/DownloadPanel/CommentsBlock/useViewPing），壳负责组装， hydration
边界只在壳上。SSR 页只做取数 + SEO 头，`loadPage` 把 /site 载荷传进取数闭包
（评论每页数/窗口方向随设置取）。

**评论域（同批升级，后端 0.75.0）**：

- 评论体升级为受限 HTML：后端 kses 白名单（p/br/强 emphasized/blockquote/
  code/span[data-spoiler]/img[src|alt|class]）写入+读取双跑；前端
  `sanitizeCommentHtml` 纵深复核（图片仅放行 /media/ 源与表情）——共享
  tiptap 编辑器 `RichEditor` 直接复用进评论作曲器（`AttachmentStrip` 上传条
  合并在提交时拼接 img），登录用户可传图（走 /api/uploads/image），游客按钮
  按 `onImageFile` 缺省自然隐藏；
- 评论列表按 /site 设置渲染：`threadComments/threadCommentsDepth` 建树折叠
  超深层级、`commentOrder` 逐层反转、`commentsPerPage` 分页、
  `defaultCommentsPage` 决定取数窗口方向（后端列表路由加法 `order=asc|desc`
  参数，desc 时第 1 页=最新窗口）；
- 门禁设置驱动：`commentRegistration` 投影进 /site.comments；true=结构性登
  录墙（访客见登录提示），false=游客按 WP 原生身份（name/email，
  `requireNameEmail` 时必填）经同一 `wp_new_comment` 管线发评（审核/防洪/
  去重全生效）；评论 POST 代理对无会话请求放行，由后端按设置裁决。

**恒 hero 头部与操作栏（2026-09-17 后端 0.77.0；2026-09-28 封面设置合并）**：
文章详情头部不再区分有无特色图两种形态——后端 PostPresenter 的 featured 解
析链保证该字段实际恒有值（文章特色图 → 站点兜底封面，两者同走 1000×240
裁剪管线，最后兜底卡片缩略图链；站点兜底封面这张图同时供列表卡片与分类卡
片使用，卡片侧派生 640×360 裁剪——同一张图、每处各自裁）。ArticleHeader 单
一 hero 结构（行 1 作者/日期/计数、行 2 标题+徽章+操作栏），操作栏固定在标
题行右缘不随 hero 切换；喜欢（玫红 icon 钮，计数
外侧 +N）/收藏（白底橙黄书签）/评分（明黄星标 slider，松手提交）均为实底
shadcn Button，写请求带旋转器，成败走 sonner toast；正文灯箱与社区共用
yet-another-react-lightbox。

## UI 基建

- **壳 = ClientRouter + 纯 vanilla**（2026-09-10 拍板）：布局交互不值得水合。
  侧栏折叠（汉堡按钮唯一控制，已移除 sidebar rail；localStorage 持久化 +
  `astro:after-swap` 重放）、配色切换、路由进度条——全部委托式原生脚本。
  **例外即 UserCenter 岛**（2026-09-11 拍板）：登录/注册入口、认证窗、通知
  气泡、用户菜单气泡整体迁入 `islands/UserCenter`（`client:load`，双壳各挂
  一实例），shadcn Dialog/Popover/DropdownMenu/Field 组装，表单按
  login-01/signup-01 块的构成；提交仍走同源代理 `/api/auth/*`，错误只出
  前端文案，成功 reload 让 SSR 壳接新会话。旧 AuthMenu.astro 已删。
  通知未读点仍是契约约定的前端本地 last-seen（localStorage）。
- **shadcn/ui 零件已就位（2026-09-11）**：`components.json` + `cn` 包 +
  `radix-ui` 统一包 + React 19 / @astrojs/react；必备件已装——`button`、
  `input`、`label`、`textarea`、`card`、`separator`、`field`、`dialog`、
  `alert-dialog`、`dropdown-menu`、`popover`、`tooltip`、`sonner`
  （toast 用 sonner，官方已弃用旧 toast 件）。约定：
  - 零件只允许 islands/ 导入，壳永远不导入（零水合边界不动）；
  - sonner 包装已去掉 `next-themes`，主题读壳的 `html.dark`（BaseHead 预涂装
    同一事实源）；`<Toaster />` 用 `client:only="react"` 挂载，`toast()` 由岛
    内代码调用；
  - tokens.css 已补 `--popover(-foreground)` 双板（sonner/弹层配色消费）；
  - 以后加件照旧 `npx shadcn@latest add <name> --yes`；**装/卸依赖后必须重启
    dev**（Vite 依赖预打包换 hash，不重启岛水合会静默 504）。重启后仍失效
    （岛水合静默死亡、/node_modules/.vite/deps/* 全 404）时，删
    `node_modules/.vite` 再重启——预打包缓存与模块图不一致是排障盲区，
    2026-09-17 实测过一次（症状：正文灯箱与社区 yarl 灯箱同时失效）。
- **图标**：`layout/Icon.astro` 按 lucide-static 命名空间查表（`lib/icons.ts`，
  2000+ 图标，kebab/camel/Pascal 名均可，未知名回退 chevron），服务端渲染零 JS；
  React 岛内才用 lucide-react。
- **动画**：`tw-animate-css` 已接入（Tailwind v4 工具类式动画）；岛内若未来需要
  物理动画再评估 `motion`。
- **空态/错误卡片（2026-09-11）**：`PageState.astro` 重构为 shadcn Empty
  卡片样式（虚线边框 + media 槽 + 图标按钮）；占位图来自后台 Frontend 设置
  页 `empty_image`（契约 `defaults.emptyImage`，未配置回退图标），全部
  20 处空态/错误调用点统一消费；500 保留零依赖内联版（同款样式）。
- **滚动条（2026-09-11）**：全局与侧栏统一细半透明无箭头样式（`shell.css`：
  Chromium/Safari 走 `::-webkit-scrollbar` 伪元素；Firefox 的标准
  `scrollbar-width/color` 包在 `@supports not selector(::-webkit-scrollbar)`
  里——两套混用会让 Chromium 121+ 回落到带箭头的原生滚动条并忽略全部 webkit
  规则，颜色走 foreground 22% 透明混合，随明暗模式自适应）；侧栏滚区为纯
  CSS（`overflow-y:auto` + `scrollbar-gutter: stable`），壳保持零水合——
  React 的 `ui/scroll-area.tsx` 零件留给岛用。
- **设计辅助 skills**（已装，全局）：`shadcn`（官方组件/注册表技能）、
  `web-design-guidelines`（Vercel UI 走查清单）。

## 阶段计划

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

## 约定

- **认证**：令牌只在 HttpOnly cookie；认证 / 用户 / 评论写操作走同源代理端点
  （`/api/*`）。**代理错误契约（2026-09-12 统一）**：所有失败响应为
  `{ok:false, code?}`（code = 契约信封机器码 `aiya_*`，login/register 另带
  前端文案 message）——岛内按 `t(locale).errors[code]` 查表，四字典与后端
  错误码同步补齐。
- **SEO**：后端不可达时整站失败闭锁（robots 全禁、sitemap 空 urlset、门禁页 noindex）；
  筛选 / 搜索态 noindex，canonical 由 href 构造器生成；结构化数据经 `lib/seo.ts`。
- **错误文案**：`aiyaErrorCopy(error, locale)`；后端 message 永不透出。错误码字典在
  `lib/i18n/dictionaries/*`，新增后端错误码时四个字典同步补齐（`tests/i18n.test.ts`
  有后端访客可达码 ⊆ 字典的执法测试）。
- **部署前提（`AIYA_CLIENT_IP_HEADER`）**：配置该头后，访客地址取自边缘代理盖章的
  头（如 `X-Real-IP`）；边缘**必须先剥离客户端自带的同名头**，否则访客可伪造地址
  绕过限流与去重。缺省（socket 地址）无此前提。
- **保留 slug**：首段 `page`（各列表 `/x/page/` 形态）、`me`（`/profile/me/`，已显式
  404）、`board`（`/community/board/`）为路由保留字——内容 slug 撞上时永远落到兜底
  重定向而非内容；后端保存侧如无校验，此处仅记录不拦截。`/membership/` 路由已退役
  （会员入口迁往 `/profile/me/` 的钱包气泡 + 会员弹窗），旧链由 middleware 308 兜底。
- **已知线上形状注记**：讨论详情的 `replies` 是回复数组（后端 `array_merge` 以数组
  覆盖列表项中的计数）；计数以 `GET /discussions/{id}/replies` 的 meta.pagination 为准。
- **后端 0.29.0/0.36.1 起** `/site` 携带 shell 配置（`defaults.colorMode`/
  `defaults.thumb`、`favicon`、`registrationOpen` 与 `footer` 备案四字段，源自
  后端 Frontend 设置页），前端契约为必填且已全部消费：`favicon` 接管站点图标
  链接（无设置回退内置 favicon）、`registrationOpen` 控制注册入口显隐。
  **0.42.0 起消费 `defaults.colorMode` 与新增 `banner`**：BaseHead 预涂装内联
  脚本按 localStorage → `defaults.colorMode` → 系统偏好解析明暗（`html.dark`，
  `data-astro-rerun` 随 ClientRouter 重跑防闪白），tokens.css 全部语义色走
  `:root`/`.dark` 双板；顶栏月亮/太阳按钮切换并写回 localStorage。桌面顶栏
  **不吸顶**（随页面滚走，无滚动毛玻璃态）；`banner` 为**首页限定**装饰——
  图片以 `background: cover/center` 填充页顶 h-40 区域（任意图片放大居中
  平铺），透明导航行叠加其上，二者作为一个整体随页面滚走；非首页恒定紧凑
  高度。
  登录后顶栏为铃铛 + 纯头像 dropdown：通知走同源代理 `GET /api/notifications/`
  （cookie bearer 转发），未读点按契约归前端——localStorage last-seen 与
  最新 `createdAt` 比较，面板打开即更新。

## 实现契约（2026-09-10 拍板）

1. **Server Islands 承载 viewer 相关低时效片**（`server:defer`，Astro 7 稳定特性）：
   评论数 / 点赞数 / 登录态头像菜单等用 `.astro` 组件做服务岛（零 React），服务端
   可读 HttpOnly cookie 渲染个性化内容。两阶段演进：当前全页 SSR 时这些组件直接
   内联渲染；未来某路由开 prerender 时，同一组件加 `server:defer` 即变成请求时插槽，
   组件代码不变。ClientRouter 预取的是页面 HTML——岛数据在导航完成后按需取，属预期。
2. **prerender 路由缓存延后**到页面全部完成后迭代（届时逐路由开 `prerender = true`，
   配合 WP webhook → `/api/revalidate` 全量重建 + 去抖）。**路由形状纪律现在生效**：
   分页与分类必须路径化（`/posts/page/[n]/`、`/category/[slug]/`），搜索与账号域保持
   SSR——query 参数（q/sort/category/page）会被静态文件吞掉，严禁把筛选放 query。
3. **浏览器只接触 Astro 域名**（单源架构）：
   - 计数端点（like/view/rating）**改走 `/api` 代理**，不再浏览器直连 WP。
   - **门禁现状（2026-09-10 拍板）**：现阶段以 CORS/Astro `security.checkOrigin`
     （已默认启用并实测拦截跨站 POST）为代理链路门禁；防伪内部密钥头与信任代理
     （X-Forwarded-For + 可信网段）**延后至部署批**（建议 0.30.x）。
   - ~~**过渡期代价**~~（2026-09-19 已解除）：代理后 WP 侧 REMOTE_ADDR 恒为前端
     服务器的退化（限流全站共享桶、游客计数去重退化为 UA 粒度）由**反代桥**闭合——
     wp-config 定义 `AIYA_PROXY_SECRET` 常量后，aiya-core `TrustedProxy` 模块在
     请求携带匹配 `X-Aiya-Proxy-Secret` 头时把 `X-Forwarded-For` 首段采信为访客 IP
     （经 `aiya_core_client_ip` 过滤器，限流 / 计数哈希 / 评论 IP 三处共用；秘钥
     不匹配或未配置回落 REMOTE_ADDR）。前端全部 `/api` 代理经 `lib/visitor-ip.ts`
     解析访客地址并恒携秘钥头 + XFF；`AIYA_CLIENT_IP_HEADER` 可选信任边缘代理头。
   - **媒体隐身已落地（/media/ 前缀，2026-09-10 定稿）**：`lib/media.ts` 的
     `rewriteMediaUrl`/`rewriteSrcset` 只把 WP origin 的 `/wp-content/` URL 改写为
     `/media/...`（permalinks、gravatar、第三方外链原样放行）；正文 HTML 的改写
     挂在 `lib/content.ts` 的 sanitize-html `transformTags` 钩子里（img src/srcset +
     a href，同一次解析完成，不引入第二个 HTML 解析器，正文图自动加 lazy/async）。
     服务端 `lib/media-proxy.ts`（由 **middleware 调用**而非路由——`trailingSlash:
'always'` 会在路由前 404 掉无尾斜杠的文件型路径）流式透传：支持 Range、
     透传 Content-Type/ETag/Last-Modified、`Cache-Control: public, max-age=604800`
     （middleware 对 `/media/` 豁免 no-store）；白名单强制 `wp-content/` 前缀，
     **`wp-json` 永不可达**，拒绝穿越与百分号编码。Astro Image（astro:assets）暂不
     接入：正文图无法组件化、`/_image?href=` 泄漏 WP 地址、后端封面已是优化 webp；
     未来如需按宽转换，在代理端点挂 sharp。
   - URL 改写面：DTO `Image.url`、正文 HTML 的 img src、评论头像——消费点统一过
     `rewriteMediaUrl`（og:image 由 BaseHead 把 `/media/` 路径拼回本域绝对地址）；
     FileServe/OpenList 下载直链、爱发电/易支付跳转不属于隐藏范围（本就是第三方域）。
   - **菜单图标（0.37.0）**：Navigation 设置 primary 行新增可选 `icon`（Lucide 名），
     契约 `MenuItem.icon: string|null`（secondary 恒 null）；侧栏渲染设置值优先、
     URL 形状回退。secondary 组即页脚菜单，Footer 同时渲染 `site.footer` 备案
     三字段与 note。
