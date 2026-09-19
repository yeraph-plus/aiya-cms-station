import type { Dictionary } from '@/lib/i18n';
import { toBcp47, type Locale } from '@/lib/i18n';

/**
 * The site gate: what every HTML request gets while the content service is
 * unreachable. It replaces the old per-page degraded chrome — when the
 * backend is down there is no shell, no menu and no theme to read, so no
 * page can be assembled and pretending otherwise only produced a broken
 * site on every route.
 *
 * Deliberately dependency-free, like `500.astro`: no Astro components, no
 * islands, no stylesheet import, styles inlined. A gate that needs the
 * build pipeline to render is not a gate. That is also why the few colors
 * below are literal rather than tokens — the token sheet is a build
 * artifact, and these values are the static counterparts of `--canvas`,
 * `--ink`, `--body-muted`, `--secondary`, `--primary` and `--destructive`.
 *
 * Pure (no `astro:env`), so the markup is unit-testable; middleware applies it.
 */

/** Service Unavailable is what a maintenance gate owes crawlers and clients. */
export const GATE_STATUS = 503;
/** Tells well-behaved clients and crawlers when to come back. */
export const GATE_RETRY_AFTER_SECONDS = 30;

const GATE_ICON = `<path d="M7 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5"/><path d="M10 10 2.5 2.5C2 2 2 2.5 2 5v3a2 2 0 0 0 2 2h6z"/><path d="M22 17v-1a2 2 0 0 0-2-2h-1"/><path d="M4 14a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16.5l1-.5.5.5-8-8H4z"/><path d="M6 18h.01"/><path d="m2 2 20 20"/>`;

const RETRY_ICON = `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`;

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The full gate document. `retryPath` is echoed back as the retry target so
 * the link reloads the page the visitor actually asked for.
 */
export function renderGateDocument(locale: Locale, copy: Dictionary, retryPath: string): string {
  const title = escapeText(copy.state.backendTitle);
  const message = escapeText(copy.state.backendMessage);
  const retry = escapeText(copy.common.retry);
  const href = escapeText(retryPath);
  return `<!doctype html>
<html lang="${toBcp47(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title}</title>
  </head>
  <body style="margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f6f6f8; color: #303039; font-family: Arial, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;">
    <main style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; padding: 3.5rem 1.5rem; text-align: center; border: 1px dashed #bbb6c4; border-radius: 0.5rem; background: #ffffff; max-width: 26rem;">
      <div aria-hidden="true" style="display: flex; width: 2.5rem; height: 2.5rem; align-items: center; justify-content: center; border-radius: 0.5rem; background: #f0f0f3; color: #b30000;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GATE_ICON}</svg>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; max-width: 24rem;">
        <p style="font-size: 3rem; font-weight: 700; letter-spacing: 0.05em; color: #e94f69; margin: 0;">${GATE_STATUS}</p>
        <p style="font-size: 1.125rem; font-weight: 500; margin: 0;">${title}</p>
        <p style="font-size: 0.875rem; line-height: 1.625; color: #747480; margin: 0;">${message}</p>
      </div>
      <div>
        <a href="${href}" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.375rem; background: #e94f69; color: #ffffff; text-decoration: none; font-size: 0.875rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${RETRY_ICON}</svg>
          ${retry}
        </a>
      </div>
    </main>
  </body>
</html>
`;
}

/**
 * The gate as a Response. Never cached (`no-store`) — a cached gate would
 * outlive the outage — and marked `noindex` so crawlers drop the page
 * instead of the whole site.
 */
export function gateResponse(locale: Locale, copy: Dictionary, retryPath: string): Response {
  return new Response(renderGateDocument(locale, copy, retryPath), {
    status: GATE_STATUS,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Retry-After': String(GATE_RETRY_AFTER_SECONDS),
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
