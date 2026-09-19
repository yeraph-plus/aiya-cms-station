export type ApiErrorKind = 'configuration' | 'network' | 'timeout' | 'http' | 'contract';

/** Never stores the response body, request headers, password or upstream error text. */
export class AiyaApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    public readonly status = 502,
    public readonly requestId?: string,
    /**
     * Stable machine code from our envelope (`aiya_*`, `rest_*`). Display
     * copy is owned by the front end's own i18n and mapped from this code;
     * backend messages are never transported.
     */
    public readonly code?: string,
  ) {
    super(`AIYA API ${kind} error`);
    this.name = 'AiyaApiError';
  }
}
