import { z } from 'zod';
import {
  authSessionResponseSchema,
  commentCreatedResponseSchema,
  commentCreateSchema,
  commentsQuerySchema,
  commentsResponseSchema,
  creditBalanceResponseSchema,
  creditCheckinResponseSchema,
  creditEntriesResponseSchema,
  creditRedeemResponseSchema,
  creditsQuerySchema,
  deletedResponseSchema,
  discussionCreateSchema,
  discussionReplyCreateSchema,
  discussionReplyUpdateSchema,
  discussionReplyResponseSchema,
  discussionResponseSchema,
  discussionsQuerySchema,
  discussionsResponseSchema,
  discussionBoardsResponseSchema,
  discussionRepliesResponseSchema,
  discussionUpdateSchema,
  doneResponseSchema,
  errorEnvelopeSchema,
  favoriteCreateSchema,
  favoritesQuerySchema,
  favoritesResponseSchema,
  followingResponseSchema,
  followStateSchema,
  favoritedResponseSchema,
  likeResponseSchema,
  loginRequestSchema,
  membershipResponseSchema,
  meResponseSchema,
  notificationsResponseSchema,
  orderCreateSchema,
  orderCreatedResponseSchema,
  postUnlockResponseSchema,
  pagesResponseSchema,
  pageResponseSchema,
  passwordChangeSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  passwordResetValidateSchema,
  postResponseSchema,
  postsQuerySchema,
  postsResponseSchema,
  profileResponseSchema,
  profileUpdateSchema,
  ratingResponseSchema,
  relatedResponseSchema,
  registerRequestSchema,
  resourcesQuerySchema,
  resourcesResponseSchema,
  resourceAttachmentsResponseSchema,
  resetValidatedSchema,
  afdianOrderUrlResponseSchema,
  redeemSchema,
  searchGroupedResponseSchema,
  searchQuerySchema,
  sentResponseSchema,
  siteResponseSchema,
  smiliesResponseSchema,
  termsQuerySchema,
  termsResponseSchema,
  tiersResponseSchema,
  viewResponseSchema,
  type CommentCreate,
  type CreditsQuery,
  type DiscussionCreate,
  type DiscussionReplyUpdate,
  type DiscussionUpdate,
  type LoginRequest,
  type OrderCreate,
  type PasswordReset,
  type PasswordResetRequest,
  type ProfileUpdate,
  type RegisterRequest,
  uploadResultSchema,
} from './contracts';
import { AiyaApiError } from './errors';

export interface ClientOptions {
  baseUrl: string;
  /** Visitor session token, sent as Bearer. This client holds no machine
      credential: the frontend deliberately has no service account (no
      admin/preview capability; content reads are anonymous). */
  bearer?: string;
  timeoutMs?: number;
  allowLocalHttp?: boolean;
  /** Proxy-bridge secret; when set, every request carries the internal
      header the backend's TrustedProxy requires before it trusts the
      forwarded visitor address. */
  proxySecret?: string;
  /** The visitor IP this server resolved (lib/visitor-ip.ts); rides
      X-Forwarded-For next to the secret header. */
  clientIp?: string | null;
  fetcher?: typeof fetch;
}

type WriteMethod = 'POST' | 'PATCH' | 'DELETE';

/** List queries accept the defaulted fields as optional (z.input side of the schema). */
type ListQuery = z.input<typeof postsQuerySchema>;
type ResourcesListQuery = z.input<typeof resourcesQuerySchema>;
type DiscussionsListQuery = z.input<typeof discussionsQuerySchema>;
type CommentsListQuery = z.input<typeof commentsQuerySchema>;
type FavoritesListQuery = z.input<typeof favoritesQuerySchema>;

/**
 * Fixed write routes; anything not matched cannot be written through this
 * client. Dynamic ids are pinned by the patterns so a crafted id cannot
 * retarget another endpoint.
 */
const WRITE_ALLOWLIST: ReadonlyArray<{ method: WriteMethod; pattern: RegExp }> = [
  {
    method: 'POST',
    pattern:
      /^auth\/(login|register|logout|password-reset-request|password-reset\/validate|password-reset)$/,
  },
  { method: 'POST', pattern: /^users\/me\/(favorites|password)$/ },
  { method: 'POST', pattern: /^uploads\/image$/ },
  { method: 'POST', pattern: /^content\/\d+\/(like|view|rating|comments|unlock)$/ },
  { method: 'POST', pattern: /^discussions$/ },
  { method: 'POST', pattern: /^discussions\/\d+\/replies$/ },
  { method: 'POST', pattern: /^sponsorship\/orders$/ },
  { method: 'POST', pattern: /^credits\/(checkin|redeem)$/ },
  { method: 'POST', pattern: /^users\/me\/following\/\d+$/ },
  { method: 'PATCH', pattern: /^users\/me\/profile$/ },
  { method: 'PATCH', pattern: /^discussions\/\d+$/ },
  { method: 'DELETE', pattern: /^users\/me\/avatar$/ },
  { method: 'DELETE', pattern: /^users\/me\/favorites\/\d+$/ },
  { method: 'DELETE', pattern: /^users\/me\/following\/\d+$/ },
  { method: 'DELETE', pattern: /^discussions\/\d+$/ },
  { method: 'PATCH', pattern: /^discussions\/\d+\/replies\/\d+$/ },
  { method: 'DELETE', pattern: /^discussions\/\d+\/replies\/\d+$/ },
];

/** Server transport. Import server.ts from Astro; components never receive this object. */
export function createAiyaClient(options: ClientOptions) {
  let base: URL;
  try {
    base = new URL(options.baseUrl);
  } catch {
    throw new AiyaApiError('configuration', 503);
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && loopback && options.allowLocalHttp)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !base.pathname.endsWith('/wp-json/aiya/core/v1/')
  ) {
    throw new AiyaApiError('configuration', 503);
  }
  const timeoutMs = options.timeoutMs ?? 8000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new AiyaApiError('configuration', 503);
  }
  const headers = new Headers({ Accept: 'application/json' });
  if (options.bearer) {
    headers.set('Authorization', `Bearer ${options.bearer}`);
  }
  // The proxy bridge rides on every request of the instance: the secret
  // authenticates this server to the backend, the address identifies the
  // visitor it resolved. A malformed address is dropped, not forwarded.
  if (options.proxySecret) {
    headers.set('X-Aiya-Proxy-Secret', options.proxySecret);
  }
  if (options.clientIp && /^[0-9A-Fa-f.:%]{1,45}$/.test(options.clientIp)) {
    headers.set('X-Forwarded-For', options.clientIp);
  }
  const fetcher = options.fetcher ?? fetch;

  /** Detail reads are slug-keyed; one path segment, no separators. */
  function assertSlug(slug: string): void {
    if (!/^[^/\\]{1,200}$/.test(slug) || slug === '' || slug === '.' || slug === '..') {
      throw new AiyaApiError('configuration', 400);
    }
  }

  async function request<T extends z.ZodType>(
    method: 'GET' | WriteMethod,
    path: string,
    schema: T,
    { query, body }: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<z.output<T>> {
    // Only fixed resource methods below can call this; callers cannot supply a URL or headers.
    if (
      method !== 'GET' &&
      !WRITE_ALLOWLIST.some((route) => route.method === method && route.pattern.test(path))
    ) {
      throw new AiyaApiError('configuration', 503);
    }
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    const requestHeaders = new Headers(headers);
    const init: RequestInit = {
      method,
      headers: requestHeaders,
      redirect: 'error',
      cache: 'no-store',
    };
    if (method === 'POST' || method === 'PATCH') {
      requestHeaders.set('Content-Type', 'application/json');
      init.body = JSON.stringify(body ?? {});
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        let requestId: string | undefined;
        let code: string | undefined;
        try {
          const error = errorEnvelopeSchema.safeParse(await response.json());
          if (error.success) {
            requestId = error.data.meta.requestId;
            code = error.data.error.code;
          }
        } catch {
          /* A WP/native/proxy error may not use our JSON envelope. */
        }
        // Only the machine code crosses the boundary; display copy is the
        // front end's own.
        throw new AiyaApiError('http', response.status, requestId, code);
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AiyaApiError('contract');
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        // Server-side log only: pinpoints which field drifted from the contract.
        console.error(`[aiya] contract violation on ${method} ${path}:`, parsed.error.issues);
        throw new AiyaApiError('contract');
      }
      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted) throw new AiyaApiError('timeout', 504);
      if (error instanceof AiyaApiError) throw error;
      throw new AiyaApiError('network');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    // ---- content reads ----
    site: () => request('GET', 'site', siteResponseSchema),
    smilies: () => request('GET', 'smilies', smiliesResponseSchema),
    terms: (
      taxonomy: 'all' | 'category' | 'tag' = 'all',
      type: 'post' | 'page' | 'resource' = 'post',
    ) =>
      request('GET', 'terms', termsResponseSchema, {
        query: termsQuerySchema.parse({ taxonomy, type }),
      }),
    posts: (query: ListQuery = {}) =>
      request('GET', 'posts', postsResponseSchema, { query: postsQuerySchema.parse(query) }),
    post: (slug: string) => {
      assertSlug(slug);
      return request('GET', `posts/${slug}`, postResponseSchema);
    },
    pages: (query: ListQuery = {}) =>
      request('GET', 'pages', pagesResponseSchema, { query: postsQuerySchema.parse(query) }),
    page: (slug: string) => {
      assertSlug(slug);
      return request('GET', `pages/${slug}`, pageResponseSchema);
    },
    resources: (query: ResourcesListQuery = {}) =>
      request('GET', 'resources', resourcesResponseSchema, {
        query: resourcesQuerySchema.parse(query),
      }),
    resource: (slug: string) => {
      assertSlug(slug);
      return request('GET', `resources/${slug}`, postResponseSchema);
    },
    related: (id: number, query: { number?: number } = {}) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('GET', `content/${id}/related`, relatedResponseSchema, {
        query: query.number === undefined ? {} : { number: query.number },
      });
    },
    resourceAttachments: (id: number) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('GET', `resources/${id}/attachments`, resourceAttachmentsResponseSchema);
    },
    discussionBoards: () => request('GET', 'discussions/boards', discussionBoardsResponseSchema),
    discussions: (query: DiscussionsListQuery = {}) =>
      request('GET', 'discussions', discussionsResponseSchema, {
        query: discussionsQuerySchema.parse(query),
      }),
    discussionReplies: (id: number, page = 1) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('GET', `discussions/${id}/replies`, discussionRepliesResponseSchema, {
        query: { page },
      });
    },
    profile: (slug: string) => {
      if (!/^[a-z0-9-]{1,64}$/.test(slug)) throw new AiyaApiError('configuration', 400);
      return request('GET', `profiles/${slug}`, profileResponseSchema);
    },
    comments: (id: number, query: CommentsListQuery = {}) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('GET', `content/${id}/comments`, commentsResponseSchema, {
        query: commentsQuerySchema.parse(query),
      });
    },
    /** Cross-type search. Grouped answer (all three types, page one per
        group) when `type` is absent; standard paged list for a single
        type. Q shorter than 2 chars answers an empty payload. */
    search: (query: z.input<typeof searchQuerySchema>) => {
      const parsed = searchQuerySchema.parse(query);
      const qp: Record<string, string | number | undefined> = {
        q: parsed.q,
        page: parsed.page,
        perPage: parsed.perPage,
        type: parsed.type,
      };

      return request(
        'GET',
        'search',
        parsed.type === undefined ? searchGroupedResponseSchema : postsResponseSchema,
        { query: qp },
      );
    },
    notifications: () => request('GET', 'notifications', notificationsResponseSchema),

    // ---- auth ----
    login: (input: LoginRequest) =>
      request('POST', 'auth/login', authSessionResponseSchema, {
        body: loginRequestSchema.parse(input),
      }),
    register: (input: RegisterRequest) =>
      request('POST', 'auth/register', authSessionResponseSchema, {
        body: registerRequestSchema.parse(input),
      }),
    logout: () => request('POST', 'auth/logout', doneResponseSchema, { body: {} }),
    passwordResetRequest: (input: PasswordResetRequest) =>
      request('POST', 'auth/password-reset-request', sentResponseSchema, {
        body: passwordResetRequestSchema.parse(input),
      }),
    passwordResetValidate: (input: { login: string; key: string }) =>
      request('POST', 'auth/password-reset/validate', resetValidatedSchema, {
        body: passwordResetValidateSchema.parse(input),
      }),
    passwordReset: (input: PasswordReset) =>
      request('POST', 'auth/password-reset', doneResponseSchema, {
        body: passwordResetSchema.parse(input),
      }),

    // ---- self service ----
    me: () => request('GET', 'users/me', meResponseSchema),
    updateProfile: (input: ProfileUpdate) =>
      request('PATCH', 'users/me/profile', meResponseSchema, {
        body: profileUpdateSchema.parse(input),
      }),
    changePassword: (input: {
      currentPassword: string;
      password: string;
      passwordConfirm: string;
    }) =>
      request('POST', 'users/me/password', doneResponseSchema, {
        body: passwordChangeSchema.parse(input),
      }),
    removeAvatar: () => request('DELETE', 'users/me/avatar', meResponseSchema),
    following: (query: FavoritesListQuery = {}) =>
      request('GET', 'users/me/following', followingResponseSchema, { query }),
    followers: (query: FavoritesListQuery = {}) =>
      request('GET', 'users/me/followers', followingResponseSchema, { query }),
    follow: (userId: number) => request('POST', `users/me/following/${userId}`, followStateSchema),
    unfollow: (userId: number) =>
      request('DELETE', `users/me/following/${userId}`, followStateSchema),
    isFollowing: (userId: number) =>
      request('GET', `users/me/following/${userId}`, followStateSchema),
    myFavorites: (query: FavoritesListQuery = {}) =>
      request('GET', 'users/me/favorites', favoritesResponseSchema, {
        query: favoritesQuerySchema.parse(query),
      }),
    addFavorite: (postId: number) =>
      request('POST', 'users/me/favorites', favoritedResponseSchema, {
        body: favoriteCreateSchema.parse({ postId }),
      }),
    removeFavorite: (postId: number) => {
      if (!Number.isSafeInteger(postId) || postId < 1) throw new AiyaApiError('configuration', 400);
      return request('DELETE', `users/me/favorites/${postId}`, favoritedResponseSchema);
    },

    // ---- engagement counters (browser-direct callers included) ----
    like: (id: number) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('POST', `content/${id}/like`, likeResponseSchema, { body: {} });
    },
    view: (id: number) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('POST', `content/${id}/view`, viewResponseSchema, { body: {} });
    },
    rating: (id: number, value: number) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      const parsed = z.number().int().min(1).max(10).parse(value);
      return request('POST', `content/${id}/rating`, ratingResponseSchema, {
        body: { value: parsed },
      });
    },
    addComment: (id: number, input: CommentCreate) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('POST', `content/${id}/comments`, commentCreatedResponseSchema, {
        body: commentCreateSchema.parse(input),
      });
    },

    // ---- discussion threads ----
    createDiscussion: (input: DiscussionCreate) =>
      request('POST', 'discussions', discussionResponseSchema, {
        body: discussionCreateSchema.parse(input),
      }),
    updateDiscussion: (id: number, input: DiscussionUpdate) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('PATCH', `discussions/${id}`, discussionResponseSchema, {
        body: discussionUpdateSchema.parse(input),
      });
    },
    deleteDiscussion: (id: number) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('DELETE', `discussions/${id}`, deletedResponseSchema);
    },
    addDiscussionReply: (id: number, content: string) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new AiyaApiError('configuration', 400);
      return request('POST', `discussions/${id}/replies`, discussionReplyResponseSchema, {
        body: discussionReplyCreateSchema.parse({ content }),
      });
    },
    updateDiscussionReply: (id: number, replyId: number, input: DiscussionReplyUpdate) => {
      if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(replyId) || replyId < 1) {
        throw new AiyaApiError('configuration', 400);
      }
      return request(
        'PATCH',
        `discussions/${id}/replies/${replyId}`,
        discussionReplyResponseSchema,
        {
          body: discussionReplyUpdateSchema.parse(input),
        },
      );
    },
    deleteDiscussionReply: (id: number, replyId: number) => {
      if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(replyId) || replyId < 1) {
        throw new AiyaApiError('configuration', 400);
      }
      return request('DELETE', `discussions/${id}/replies/${replyId}`, deletedResponseSchema);
    },

    // ---- sponsorship / credits ----
    myMembership: () => request('GET', 'sponsorship/membership', membershipResponseSchema),
    tiers: () => request('GET', 'sponsorship/plans', tiersResponseSchema),
    createOrder: (input: OrderCreate) =>
      request('POST', 'sponsorship/orders', orderCreatedResponseSchema, {
        body: orderCreateSchema.parse(input),
      }),
    redeemCode: (code: string, channel: 'redeem' | 'afdian' = 'redeem') =>
      request('POST', 'credits/redeem', creditRedeemResponseSchema, {
        body: redeemSchema.parse({ code, channel }),
      }),
    unlockPost: (id: number, password: string) =>
      request('POST', `content/${id}/unlock`, postUnlockResponseSchema, {
        body: z
          .object({ id: z.number().int().min(1), password: z.string().min(1) })
          .parse({ id, password }),
      }),
    /** Afdian deep link; `month` (1–36) pre-selects the cycle count there. */
    afdianOrderUrl: (month?: number) =>
      request('GET', 'sponsorship/afdian/order-url', afdianOrderUrlResponseSchema, {
        query: month === undefined ? {} : { month },
      }),
    creditsBalance: () => request('GET', 'credits/balance', creditBalanceResponseSchema),
    creditsEntries: (query: Partial<CreditsQuery> = {}) =>
      request('GET', 'credits/entries', creditEntriesResponseSchema, {
        query: creditsQuerySchema.parse(query),
      }),
    creditsCheckin: () => request('POST', 'credits/checkin', creditCheckinResponseSchema),

    /**
     * Community composer image upload (`POST uploads/image`, multipart field
     * `image`): returns the cloaked media URL for direct editor insertion.
     */
    uploadImage: async (file: Blob, filename = 'upload'): Promise<{ url: string }> => {
      const url = new URL('uploads/image', base);
      const form = new FormData();
      form.set('image', file, filename);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(url, {
          method: 'POST',
          headers: new Headers(headers),
          body: form,
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          let requestId: string | undefined;
          let code: string | undefined;
          try {
            const error = errorEnvelopeSchema.safeParse(await response.json());
            if (error.success) {
              requestId = error.data.meta.requestId;
              code = error.data.error.code;
            }
          } catch {
            /* non-envelope error */
          }
          throw new AiyaApiError('http', response.status, requestId, code);
        }
        // The envelope wraps the payload: { data: UploadResult, meta } —
        // validated against the snapshot-backed schema, not a loose url pick.
        const parsed = z
          .object({ data: uploadResultSchema })
          .loose()
          .safeParse(await response.json());
        if (!parsed.success) throw new AiyaApiError('contract');
        return { url: parsed.data.data.url };
      } catch (error) {
        if (controller.signal.aborted) throw new AiyaApiError('timeout', 504);
        if (error instanceof AiyaApiError) throw error;
        throw new AiyaApiError('network');
      } finally {
        clearTimeout(timer);
      }
    },

    // ---- multipart (the one JSON-body bypass; field name fixed by the backend) ----
    uploadAvatar: async (
      file: Blob,
      filename = 'avatar',
    ): Promise<z.output<typeof meResponseSchema>> => {
      const url = new URL('users/me/avatar', base);
      const form = new FormData();
      form.set('avatar', file, filename);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(url, {
          method: 'POST',
          headers: new Headers(headers), // no Content-Type: the boundary is set by the FormData serialization
          body: form,
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          let requestId: string | undefined;
          let code: string | undefined;
          try {
            const error = errorEnvelopeSchema.safeParse(await response.json());
            if (error.success) {
              requestId = error.data.meta.requestId;
              code = error.data.error.code;
            }
          } catch {
            /* non-envelope error */
          }
          throw new AiyaApiError('http', response.status, requestId, code);
        }
        const parsed = meResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new AiyaApiError('contract');
        return parsed.data;
      } catch (error) {
        if (controller.signal.aborted) throw new AiyaApiError('timeout', 504);
        if (error instanceof AiyaApiError) throw error;
        throw new AiyaApiError('network');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
export type AiyaClient = ReturnType<typeof createAiyaClient>;
