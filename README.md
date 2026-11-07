# front-station

The headless front end of AIYA CMS: Astro 7 SSR (node adapter) + React 19
islands + shadcn/ui + Tailwind v4. Content is consumed strictly through the
versioned [`aiya/core/v1`](https://github.com/yeraph-plus/aiya-cms-core)
contract — raw WordPress structures never cross the boundary.

Single-origin architecture: pages, the `/api/*` JSON proxy and the `/media/*`
media proxy all live on the front-end origin, so the browser only ever talks
to the front end. Bearer tokens stay in HttpOnly cookies; the server holds no
WordPress credentials (all content reads are anonymous).

| Item     | Value                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend  | [`aiya-cms-core`](https://github.com/yeraph-plus/aiya-cms-core) — the `aiya/core/v1` contract and content provider                         |
| Image    | `ghcr.io/yeraph-plus/aiya-cms-build` (`latest` follows main, `v*` tags for releases, `sha-<hash>` for pinning)                             |
| Runtime  | Node ≥ 24; container runs as non-root `node`, listens on `0.0.0.0:4321`, plain HTTP (TLS terminates at the reverse proxy)                  |
| Contract | `aiya-core/src/Api/Contract/` (v1 frozen, additive only); frozen baseline in `src/lib/core/contracts.snapshot.v1.json`, enforced by vitest |

Further reading: architecture and implementation contracts in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), visual specs in
[`docs/DESIGN.md`](docs/DESIGN.md), interaction rules in
[`docs/UX.md`](docs/UX.md), history in
[`docs/HISTORY.md`](docs/HISTORY.md).

## Local development

```bash
npm install
cp .env.example .env      # point at the WP backend (unreachable backend = 503 gate page)
npm run dev               # dev server on 4399 (strict port; WP backend must be up)
npm run verify            # astro check + vitest + prettier + fonts + build (same gate as CI)
npm test                  # unit tests only
```

Ports: dev is fixed to **4399**, the built artifact (`npm start`) to **4321**;
both can run in parallel. `npm start` pre-checks both loopback stacks and
refuses to start with a reason if a port is taken.

Server-side environment variables are read through `astro:env/server` and
never reach the browser bundle. See `.env.example` for the annotated source:

| Variable                | Purpose                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `AIYA_SITE_URL`         | The front-end origin (canonical URLs, sitemap, cookie scope incl. registrable domain)       |
| `AIYA_WP_API_URL`       | WP backend origin (the `/wp-json/aiya/core/v1/` root is appended internally)                |
| `AIYA_API_TIMEOUT_MS`   | Upstream timeout, default 8000                                                              |
| `AIYA_ALLOW_LOCAL_HTTP` | Dev-only switch that permits HTTP on loopback; never in production                          |
| `AIYA_PROXY_SECRET`     | Reverse-proxy bridge secret; must equal the `AIYA_PROXY_SECRET` constant in `wp-config.php` |
| `AIYA_CLIENT_IP_HEADER` | Optional trusted visitor-IP header (e.g. `X-Real-IP`); defaults to the socket address       |

Font subsets are committed artifacts (`src/fonts/station-sans/`, ~9.6 MB).
Day-to-day development and builds never regenerate them. Only when changing
the font or the subsetting policy, run the pipeline:
`fonts:fetch` → `fonts:snapshot` → `fonts:build` → `fonts:check` (the last
step is part of `npm run verify`). Details in
[`docs/DESIGN.md`](docs/DESIGN.md).

## Production deployment

The image is built once; configuration is injected at runtime (`astro:env`
reads process environment, nothing is baked into the bundle, `.env` never
enters the image). Upgrading = pull the new image and swap the container.

Topology: **your nginx terminates HTTPS → proxies to the front-end container
(plain HTTP) → WP backend on a separate domain** (which also serves
`/wp-admin` and payment callbacks). The container holds no certificates and
is never exposed directly.

### Release (GitHub Actions)

`.github/workflows/release.yml` runs `npm run verify` on every push to `main`
and every `v*` tag; on success buildx pushes the image to GHCR. The server
side only needs:

```bash
docker pull ghcr.io/yeraph-plus/aiya-cms-build:latest
```

The package is private by default after the first publish — make it public in
the GitHub package settings, or keep it private and `docker login ghcr.io` on
the server.

### Run

```bash
docker run -d --name aiya-front --restart unless-stopped \
  -p 127.0.0.1:4321:4321 \
  -e AIYA_SITE_URL='https://front.example.com/' \
  -e AIYA_WP_API_URL='https://admin.example.com' \
  -e AIYA_PROXY_SECRET='same value as wp-config.php' \
  -e AIYA_CLIENT_IP_HEADER='X-Real-IP' \
  ghcr.io/yeraph-plus/aiya-cms-build:latest
```

Or drop into an existing compose file (the healthcheck is built in and probes
the container itself; the 503 gate page shown while the backend is down still
counts as healthy):

```yaml
services:
  front:
    image: ghcr.io/yeraph-plus/aiya-cms-build:latest
    restart: unless-stopped
    ports:
      - '127.0.0.1:4321:4321'
    environment:
      AIYA_SITE_URL: https://front.example.com/
      AIYA_WP_API_URL: https://admin.example.com
      AIYA_PROXY_SECRET: change-me
      AIYA_CLIENT_IP_HEADER: X-Real-IP
```

The container runs as the non-root `node` user; PID 1 is a signal-forwarding
shell, so `docker stop` exits gracefully within a second.

### nginx server block (paste and adjust the domain)

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name front.example.com;

    ssl_certificate     /etc/nginx/certs/front.example.com.pem;
    ssl_certificate_key /etc/nginx/certs/front.example.com.key;

    # Uploads go through /api/uploads/image (capped at 5MB + overhead in the
    # image); the nginx default of 1m would break them.
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Visitor-IP chain: the container trusts AIYA_CLIENT_IP_HEADER.
        # proxy_set_header overwrites any client-forged header of the same
        # name, which is what the proxy bridge requires at the edge.
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }

    # Media responses already carry Cache-Control: public, max-age=604800;
    # nginx passes them through as-is — no extra caching layer needed.
}
```

### Deployment checklist

- **`AIYA_PROXY_SECRET`**: defined as a constant of the same name in
  `wp-config.php` with the identical value — otherwise rate limiting and
  visitor dedup degrade to one shared local bucket.
- **`AIYA_SITE_URL`**: must be the final public https origin; when it fails
  to parse, the site fail-closes into the 503 gate and logs a fatal.
- **`AIYA_CLIENT_IP_HEADER='X-Real-IP'`**: required — without it the container
  sees nginx's address for every visitor and the whole site shares one rate
  limit bucket; the edge must overwrite client-supplied headers of the same
  name (the block above does).
- **Pass `Host` and `X-Forwarded-Proto` through**; expose the container on
  loopback/private network only.
- **`AIYA_ALLOW_LOCAL_HTTP` never in production.**
- **`AIYA_WP_API_URL` uses the WP backend's real https domain** (public
  certificate; no extra trust configuration needed).

### Media single origin (hard rule)

**The WP siteurl must match the origin of `AIYA_WP_API_URL`.** The backend
produces media URLs from its siteurl; the front end rewrites them onto
`/media/` by origin matching. A mismatch (e.g. siteurl still pointing at
`http://127.0.0.1:8000` while the contract root is the https domain) makes
every match fail, and thumbnails/avatars/smilies leak the WP host and load
from it directly.

For the current production shape (WP on `admin.example.com`, front end on
`www.example.com`):

- Both address fields in WP admin → Settings → General are
  `https://admin.example.com`;
- The container gets `AIYA_SITE_URL='https://www.example.com/'` and
  `AIYA_WP_API_URL='https://admin.example.com'`;
- Two nginx server blocks proxy the two domains to their containers;
- Acceptance: the browser devtools network panel must show zero requests to
  the WP domain.
