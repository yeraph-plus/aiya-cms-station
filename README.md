# front-station

AIYA CMS 的 Headless 前端：Astro 7 SSR（node adapter）+ React 19 交互岛 +
shadcn/ui + Tailwind v4。只通过 `aiya/core/v1` 契约消费 WordPress 后端
（[`aiya-cms-core`](https://github.com/yeraph-plus/aiya-cms-core)），不接触
WP_Post 原始结构；bearer token 只存
HttpOnly cookie，认证/用户/评论写操作走同源代理端点，**浏览器只与前端域名
通信**（单源架构：页面、`/api/*` JSON 代理、`/media/*` 媒体代理全部挂在前端
origin 下，WP 主机对浏览器隐身）。

| 项       | 值                                                                                                                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 仓库     | 本仓库 [`yeraph-plus/aiya-cms-station`](https://github.com/yeraph-plus/aiya-cms-station)；后端 [`aiya-cms-core`](https://github.com/yeraph-plus/aiya-cms-core)（`aiya/core/v1` 契约与内容域提供方）；发帖器 [`aiya-cms-resource-publisher`](https://github.com/yeraph-plus/aiya-cms-resource-publisher) |
| 生产镜像 | `ghcr.io/yeraph-plus/aiya-cms-build`（`latest` 跟随 main；`v*` tag 出语义化版本；`sha-<短哈希>` 供回滚钉版）                                                                                                                                                                                            |
| 运行时   | Node ≥ 24；容器内非 root `node` 用户，监听 `0.0.0.0:4321`，只出明文 HTTP（TLS 归反代）                                                                                                                                                                                                                  |
| 后端契约 | `aiya-core/src/Api/Contract/`（v1 冻结加法演进）；冻结基线 `src/lib/core/contracts.snapshot.v1.json`，vitest 逐 DTO 比对执法                                                                                                                                                                            |

前后端均已部署上线。**架构分层、路由实现分布与实现契约见
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**（改动前先读）；视觉规范见
[`docs/DESIGN.md`](docs/DESIGN.md)；交互判据见 [`docs/UX.md`](docs/UX.md)；
迭代史与已关闭台账见 [`docs/HISTORY.md`](docs/HISTORY.md)；基建/零件对齐的
批次规划见 [`docs/PLAN.md`](docs/PLAN.md)。

## 本地开发

```bash
npm install
cp .env.example .env      # 指向 WP 后端（无后端可达时站点进 503 门禁页）
npm run dev               # 开发（固定 4399，strictPort：被占即报错；需 WP 后端在线）
npm run verify            # astro check + vitest + prettier + build（CI 同款门禁）
npm test                  # 单测（契约不变式 / i18n / SEO / 净化 / 门禁与熔断 / 风格守卫 …）
```

端口约定：dev 固定 **4399**，产物服务（`npm start`）固定 **4321**，两者可并行。
4321 是部署文档与 prod-sim nginx 反代的既定目标，不可挪；`npm start` 起服前经
`scripts/start-guard.mjs` 对 `127.0.0.1` 与 `::1` 双栈预检，任一被占即带原因拒绝
启动（历史教训：残留的 dev 占半边栈时，node 适配器半绑定静默存活，表现为「页面
一会儿有一会儿没有」）。`AIYA_SITE_URL` 带端口时是全局单值：dev 在 4399 期间，
页面内 origin 输出（canonical / sitemap）仍按该值所指端口——本地无 SEO 影响，
dev 需要精确 origin 时临时改 `.env` 的端口即可（见 `.env.example` 同一注释）。

环境变量（服务端专用，经 `astro:env/server` 读取，绝不进入浏览器产物；完整
注释以 `.env.example` 为准）：

| 变量                    | 说明                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AIYA_SITE_URL`         | 前端站点自身 origin（canonical / sitemap / cookie Secure 全靠它；会话 cookie 的 Domain 属性亦由此自动反取可注册根域——`www.site.name` → `site.name`，子域应用共享登录态；localhost/IP 自动回落仅主机 cookie） |
| `AIYA_WP_API_URL`       | WP 后端 origin（`/wp-json/aiya/core/v1/` 契约根由应用内部拼接，旧的全路径写法仍兼容）；**其 origin 必须与 WP 的 siteurl 一致**（见下方「媒体单源」铁律）                                                     |
| `AIYA_API_TIMEOUT_MS`   | 上游超时，默认 8000                                                                                                                                                                                          |
| `AIYA_ALLOW_LOCAL_HTTP` | 仅 loopback 允许 HTTP 的开发开关，不进生产                                                                                                                                                                   |
| `AIYA_PROXY_SECRET`     | 反代桥共享秘钥，须等于 wp-config 的 `AIYA_PROXY_SECRET` 常量                                                                                                                                                 |
| `AIYA_CLIENT_IP_HEADER` | 可选：信任的访客地址请求头（如 `X-Real-IP`），缺省 socket 地址                                                                                                                                               |

**无机器身份**：前台不做管理/预览能力，内容读全部匿名——`serverClient()` 不
持有任何 WP 账号；浏览器端仅存访客各自的 Bearer（HttpOnly cookie）。

## 生产部署

镜像一次构建、运行时注入配置——`astro:env` 读的是进程环境，没有任何配置值
烘焙进构建产物，`.env` 永不进镜像。升级 = pull 新镜像换容器。

拓扑：**你的 nginx 终结 HTTPS → `proxy_pass` 到前端容器（明文 HTTP）→ WP 后端
（独立域名，同时承载 `/wp-admin` 与支付回调）**。容器不持有证书、不直接对
公网。

### 发布（GitHub Actions）

`.github/workflows/release.yml`：push 到 `main` 或打 `v*` 标签时自动跑
`npm run verify`，全绿后 buildx 构建并推送 GHCR（层缓存走 GHA）。服务器侧只需：

```bash
docker pull ghcr.io/yeraph-plus/aiya-cms-build:latest
```

首次发布后包默认 private，按需在 GitHub 包设置页改 public（或保留 private 并
在服务器 `docker login ghcr.io`）。本机构建走受限网络时按 Dockerfile 头注传
两个 `--build-arg`（转存镜像源 + npm 镜像），正常服务器不需要。

### 运行

```bash
docker run -d --name aiya-front --restart unless-stopped \
  -p 127.0.0.1:4321:4321 \
  -e AIYA_SITE_URL='https://前端域名/' \
  -e AIYA_WP_API_URL='https://WP域名' \
  -e AIYA_PROXY_SECRET='与 wp-config 的 AIYA_PROXY_SECRET 常量同值' \
  -e AIYA_CLIENT_IP_HEADER='X-Real-IP' \
  ghcr.io/yeraph-plus/aiya-cms-build:latest
```

或贴进服务器现有 compose（healthcheck 已内置在镜像里，探活的是前端容器自身，
后端宕机时的 503 门禁页也算健康）：

```yaml
services:
  front:
    image: ghcr.io/yeraph-plus/aiya-cms-build:latest
    restart: unless-stopped
    ports:
      - '127.0.0.1:4321:4321'
    environment:
      AIYA_SITE_URL: https://前端域名/
      AIYA_WP_API_URL: https://WP域名
      AIYA_PROXY_SECRET: change-me
      AIYA_CLIENT_IP_HEADER: X-Real-IP
```

容器以非 root 的 `node` 用户运行；PID 1 是信号转发壳（`entrypoint.mjs`），
`docker stop` 一秒内优雅退出。

### nginx server 块（可直接改域名粘贴）

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

### 部署检查单

- **`AIYA_PROXY_SECRET`**：wp-config 定义同名常量且与容器注入值一致——反代桥
  生效的前提，否则限流/访客去重退化为本机共享桶。
- **`AIYA_SITE_URL`**：必须是最终对外 https origin；解析失败时站点 fail-closed
  进 503 门禁并在容器日志报死。
- **`AIYA_CLIENT_IP_HEADER='X-Real-IP'`**：必配——否则容器看到的 socket 地址
  恒为 nginx，全站访客共享同一个限流桶；边缘用 `proxy_set_header` 覆盖客户端
  自带同名头（上方配置已做）。
- **反代透传 `Host` 与 `X-Forwarded-Proto`**；容器只暴露在 loopback/内网。
- **`AIYA_ALLOW_LOCAL_HTTP` 不进生产**。
- **`AIYA_WP_API_URL` 用 WP 的真实 https 域名**（公网证书，无需额外信任配置）。

### 媒体单源与 origin 一致性（铁律）

**WP 的 siteurl 必须与 `AIYA_WP_API_URL` 的 origin 一致。** 后端
`content_url()` 等按 siteurl 产出媒体绝对 URL，前端的 `/media/` 改写靠 origin
匹配——两边不一致（如 siteurl 停在 `http://127.0.0.1:8000` 而契约根已是
https 域名）时匹配全部失配，缩略图/头像/表情包会原样泄漏 WP 主机并直连加载。

按现行线上形态（WP 在 `admin.site.name`，前端在 `www.site.name`）：

- WP 后台「设置 → 常规」两个地址都填 `https://admin.site.name`；
- 容器注入 `AIYA_SITE_URL='https://www.site.name/'`、
  `AIYA_WP_API_URL='https://admin.site.name'`；
- nginx 两个 server 块分别反代两个域名到各自容器；
- 线上验收：浏览器开发者工具里不应出现任何指向 WP 域名的资源加载（对
  `admin.site.name` 零请求）。

### 本机联调（WP 尚无 https 域名时）

契约要求非 https 后端必须是 loopback 主机名，容器内达不到——可用 nginx +
自签证书给 WP 拟一个 https 域名完整模拟生产拓扑（2026-09-25 实测通过）：
① 自签证书 `SAN=DNS:wp.demo`，nginx 443 → `wp_app:80`，带
`X-Forwarded-Proto https` 与 `sub_filter` 替换 REST JSON 里的转义斜杠 origin
（`sub_filter_types application/json`、`Accept-Encoding` 置空）；② 前端容器
`AIYA_WP_API_URL='https://wp.demo'` + `NODE_EXTRA_CA_CERTS` 信任自签证书；
③ Windows Git Bash 下执行 docker/openssl 命令记得 `MSYS_NO_PATHCONV=1`，否则
容器侧路径会被改写。

## 日常约定速览（细则见 ARCHITECTURE.md）

- **契约**：改后端先改 `lib/core/contracts.ts`（zod 镜像），快照 vitest 执法；
  v1 冻结只许加法演进。
- **门禁**：后端不可达时整站 fail-closed——503 门禁页 + robots 全禁 + sitemap
  空；熔断器双 TTL（在线 10s / 失联 3s）自动恢复。
- **错误文案**：`aiyaErrorCopy`（`lib/feedback`）全站唯一出口；后端 message
  永不透出；新增后端错误码时四字典同步补齐（有测试执法）。
- **壳零水合**：布局交互走委托式原生 `<script>`；shadcn 零件只允许
  islands/ 导入；岛的 props 只传可序列化数据（函数会静默丢失）。
- **保留 slug**：`page` / `me` / `board` 为路由保留字。
- **装/卸依赖后必须重启 dev**（Vite 预打包换 hash；仍失效删
  `node_modules/.vite` 再重启）。
