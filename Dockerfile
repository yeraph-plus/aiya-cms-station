# ---------------------------------------------------------------------------
# front-station production image: Astro 7 SSR (node adapter, standalone).
#
# Build (from the front-station directory):
#   docker build -t aiya-cms-build .
#
# Run:
#   docker run -d --name aiya-cms-build \
#     -p 4321:4321 \
#     -e AIYA_SITE_URL='https://your-front-domain/' \
#     -e AIYA_WP_API_URL='https://your-wp-domain' \
#     -e AIYA_PROXY_SECRET='<same value as wp-config AIYA_PROXY_SECRET>' \
#     aiya-cms-build
#
# Every configuration value is runtime env (astro:env reads process.env) —
# the image is built once and configured per environment. Nothing secret is
# a build arg and nothing is baked into the image. See .env.example for the
# full variable list; AIYA_ALLOW_LOCAL_HTTP has no business in production.
# ---------------------------------------------------------------------------

# Global-scope args: FROM lines can only see ARGs declared before the first
# FROM. Override them only on constrained networks (the dev workstation pulls
# through a mirror; a normal server needs none of this):
#   docker build \
#     --build-arg NODE_IMAGE=docker.1ms.run/library/node:24-alpine \
#     --build-arg NPM_REGISTRY=https://registry.npmmirror.com .
ARG NODE_IMAGE=node:24-alpine
ARG NPM_REGISTRY=https://registry.npmjs.org

# --- build stage: full toolchain, produces dist/ -----------------------------
FROM ${NODE_IMAGE} AS build
# Re-declared to inherit the global value inside this stage.
ARG NPM_REGISTRY
WORKDIR /app

# Dependency layer: only the manifests go in first so source edits do not
# bust the npm cache.
COPY package.json package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm ci

# Source layer: build without telemetry and without .env (gitignored /
# dockerignored — a stray local .env must never leak config into the bundle).
ENV ASTRO_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

# --- runtime stage: self-contained server, unprivileged ---------------------
FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    ASTRO_TELEMETRY_DISABLED=1

# The build bundles every SSR dependency (astro.config vite.ssr.noExternal),
# so the runtime ships base image + dist only — no npm layer. If a future
# dependency gets externalized again, the container dies at boot with
# ERR_MODULE_NOT_FOUND (visible immediately; the healthcheck fails): scan
# dist/server for bare imports before touching this stage.
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node entrypoint.mjs ./entrypoint.mjs

USER node
EXPOSE 4321

# Any HTTP answer proves the process serves (the 503 gate page counts — it
# means the frontend is up and its backend is not, which is not this
# container's health). The timeout clears the probe's own worst case (the
# client request timeout, AIYA_API_TIMEOUT_MS, defaults to 8s) so a backend
# outage plus a circuit re-probe cannot flap the container unhealthy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/robots.txt').then(r=>process.exit(r.ok||r.status<500?0:1)).catch(()=>process.exit(1))"

# The entrypoint is a signal supervisor: as PID 1 a bare node process never
# receives SIGTERM (the kernel drops default-disposition signals for PID 1),
# so `docker stop` used to run out its grace period and SIGKILL mid-request.
CMD ["node", "entrypoint.mjs"]
