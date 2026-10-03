/**
 * Vitest stand-in for Astro's virtual `astro:middleware` module, which only
 * exists inside the Astro Vite pipeline. `defineMiddleware` is an identity
 * helper — tests import the wrapped handler and drive it with a fake context.
 */
export function defineMiddleware<A, B>(
  fn: (context: A, next: () => Promise<B>) => unknown,
): (context: A, next: () => Promise<B>) => unknown {
  return fn;
}
