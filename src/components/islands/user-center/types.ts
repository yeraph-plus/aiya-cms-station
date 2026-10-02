// Shared prop types for the UserCenter island. Copy strings are assembled
// server-side from the i18n dictionaries (AppShell) and passed down — the
// island never reads the dictionaries itself.
export interface UserCenterUser {
  nickname: string;
  avatarUrl: string | null;
  roleLabel: string;
  /** Public profile route key (/profile/{slug}/). */
  slug: string;
  email: string;
  /** "Always show NSFW content" (0.96.0): when true the dropdown's soft
      switch renders locked-on (the backend ignores NSFW exclusions). */
  showNsfw: boolean;
  /** The visitor's soft switch ("show NSFW content"), resolved server-side
      from the first-party cookie (lib/nsfw.ts softShowNsfw). It travels as
      a prop because the island must not read document.cookie while it
      renders: the initial render runs under SSR too, where `document` does
      not exist and the throw aborts the whole response stream. */
  softNsfw: boolean;
}

export interface UserCenterCopy {
  login: string;
  register: string;
  logout: string;
  /** /profile/me/ entry (user center). */
  profile: string;
  favorites: string;
  followingTitle: string;
  /** /profile/me/?tab=wallet entry (credit ledger + membership orders). */
  wallet: string;
  accountSettings: string;
  emailLabel: string;
  passwordLabel: string;
  passwordConfirmLabel: string;
  nicknameLabel: string;
  localeLabel: string;
  authFailed: string;
  /** Reload-borne outcome toasts (flashToast): login / register / logout. */
  loginSuccess: string;
  registerSuccess: string;
  logoutSuccess: string;
  forgotPassword: string;
  /** Prebuilt greeting with the site name. */
  welcome: string;
  remember: string;
  switchToRegisterHint: string;
  switchToLoginHint: string;
  notifications: string;
  notificationsLoading: string;
  notificationsEmpty: string;
  notificationsError: string;
  /** Dropdown NSFW soft switch (0.96.0). */
  showNsfw: string;
  showNsfwLocked: string;
  /** Notification bubble + feed page (0.96.0): view-all entry, load-more. */
  notificationsViewAll: string;
  notificationsLoadMore: string;
}

export type AuthMode = 'login' | 'register';

/** Best-effort upstream answer of the /api/auth proxies. */
export interface AuthResponse {
  ok?: boolean;
  message?: string;
}
