/**
 * Visitor IP resolution on the front-station side of the proxy bridge: the
 * contract API only ever sees this server's REMOTE_ADDR, so the real
 * visitor address rides X-Forwarded-For authenticated by the shared secret
 * header (backend: aiya-core TrustedProxy + `aiya_core_client_ip`).
 *
 * Where the visitor address comes from is deployment-shaped, so it is
 * configurable: with `AIYA_CLIENT_IP_HEADER` set (e.g. `X-Real-IP`,
 * `CF-Connecting-IP`), that request header wins — take its first entry,
 * the value the edge proxy stamped. Without it, the socket address stands
 * (direct deployment). Anything that does not parse as an IP literal is
 * discarded rather than forwarded.
 */
export function resolveVisitorIp(
  request: Request,
  socketAddress: string | null,
  trustedHeader = '',
): string | null {
  let candidate: string | null = null;
  if (trustedHeader !== '') {
    const raw = request.headers.get(trustedHeader);
    if (raw !== null) {
      candidate = raw.split(',')[0]?.trim() || null;
    }
  }
  if (candidate === null && socketAddress !== null && socketAddress !== '') {
    candidate = socketAddress;
  }
  if (candidate === null || !/^[0-9A-Fa-f.:%]{1,45}$/.test(candidate)) {
    return null;
  }
  return candidate;
}
