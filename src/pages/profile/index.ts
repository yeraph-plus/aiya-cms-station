import type { APIRoute } from 'astro';

import { readSessionToken } from '@/lib/core/session';

// /profile/ (no slug): entry to the account area. Signed-in visitors go to
// their own user center (/profile/me/); guests go home. The slug-less shape
// exists only to keep the legacy entry link alive.
export const GET: APIRoute = ({ cookies, redirect }) =>
  redirect(readSessionToken(cookies) ? '/profile/me/' : '/');
