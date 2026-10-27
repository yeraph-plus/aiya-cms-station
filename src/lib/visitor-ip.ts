/**
 * Visitor IP resolution on the front-station side of the proxy bridge: the
 * contract API only ever sees this server's REMOTE_ADDR, so the real
 * visitor address rides X-Forwarded-For authenticated by the shared secret
 * header (backend: aiya-core TrustedProxy + `aiya_core_client_ip`).
 *
 * Where the address comes from is deployment-shaped, so it is configurable:
 * with `AIYA_CLIENT_IP_HEADER` set (e.g. `X-Real-IP`, `CF-Connecting-IP`),
 * that request header wins — take its first entry, the value the edge proxy
 * stamped. Without it, the socket address stands (direct deployment).
 * Anything that does not parse as an IP literal is discarded rather than
 * forwarded.
 *
 * Two rules keep this from becoming an identity the caller chooses, both
 * fail-closed:
 *
 * 1. The address must come from a header the edge *overwrites* — nginx's
 *    `proxy_set_header X-Real-IP $remote_addr` replaces whatever the client
 *    sent — or from the socket peer itself.
 * 2. `X-Forwarded-For` is never a source of identity here. The node adapter
 *    resolves `clientAddress` from its **first** entry whenever it considers
 *    the Host trusted (`security.allowedDomains`), and edges written as
 *    `$proxy_add_x_forwarded_for` append instead of replace — so that first
 *    entry is whatever the client put there. A value that arrived that way is
 *    refused rather than forwarded, because rate limiting, guest dedup, ban
 *    enforcement and the comment IP all key on this address.
 */

/** Shape check only: the backend parses the literal and validates it again. */
const IP_LITERAL = /^[0-9A-Fa-f.:%]{1,45}$/;

/** The value a proxy stamps is the first entry of a comma list. */
function firstEntry(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }
  return raw.split(',')[0]?.trim() || null;
}

/** Compare two literals the way a proxy chain would: case and IPv4-mapped
 *  IPv6 prefix carry no meaning (`::ffff:203.0.113.7` is `203.0.113.7`). */
function sameAddress(left: string, right: string): boolean {
  const normalise = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .replace(/^::ffff:/, '');
  return normalise(left) === normalise(right);
}

/**
 * True when `resolved` is the address the adapter lifted out of
 * X-Forwarded-For rather than the socket peer. The two arrive through the same
 * parameter, so they have to be told apart before either is trusted.
 */
function cameFromForwardedHeader(request: Request, resolved: string): boolean {
  const forwarded = firstEntry(request.headers.get('x-forwarded-for'));
  return forwarded !== null && sameAddress(forwarded, resolved);
}

export function resolveVisitorIp(
  request: Request,
  resolvedAddress: string | null,
  trustedHeader = '',
): string | null {
  // The configured header wins — the edge wrote it for exactly this purpose.
  if (trustedHeader !== '') {
    const stamped = firstEntry(request.headers.get(trustedHeader));
    if (stamped !== null) {
      // A header that is present but unparsable is an attack or a broken
      // proxy, not a reason to fall back to something else: refuse.
      return IP_LITERAL.test(stamped) ? stamped : null;
    }
  }

  if (resolvedAddress === null || resolvedAddress === '') {
    return null;
  }

  // No trusted-header hit: the adapter's value is only identity when it is
  // the socket peer. A forwarded resolution is client-controlled here.
  if (cameFromForwardedHeader(request, resolvedAddress)) {
    warnAboutForwardedIdentity(trustedHeader);
    return null;
  }

  return IP_LITERAL.test(resolvedAddress) ? resolvedAddress : null;
}

let warnedAboutForwardedIdentity = false;

/** One line per process: a site deployed behind an edge without
 *  `AIYA_CLIENT_IP_HEADER` collapses every visitor onto the proxy's own
 *  address, which is safe but silently degrades rate limiting to one bucket. */
function warnAboutForwardedIdentity(trustedHeader: string): void {
  if (warnedAboutForwardedIdentity) {
    return;
  }
  warnedAboutForwardedIdentity = true;
  const hint =
    trustedHeader === ''
      ? 'set AIYA_CLIENT_IP_HEADER to the header your edge overwrites (e.g. X-Real-IP)'
      : `the configured AIYA_CLIENT_IP_HEADER (${trustedHeader}) was absent from the request`;
  console.warn(
    `[aiya] visitor address came from X-Forwarded-For and was refused; ${hint}. ` +
      'Requests will share the proxy address until it is configured.',
  );
}
