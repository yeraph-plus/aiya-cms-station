import {
  BellIcon,
  BookmarkIcon,
  ChevronDownIcon,
  CoinsIcon,
  CrownIcon,
  HeadsetIcon,
  LogOutIcon,
  SettingsIcon,
  UserRoundCheckIcon,
  UserRoundIcon,
} from 'lucide-react';

import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import Avatar from '@/components/islands/Avatar';
import { flashToast } from '@/lib/feedback';
import { NSFW_COOKIE, NSFW_COOKIE_MAX_AGE } from '@/lib/nsfw';
import { NOTIFICATIONS_PAGE_PATH } from './NotificationPopover';
import type { UserCenterCopy, UserCenterUser } from './types';

/**
 * Avatar bubble: dropdown with the identity header (nickname + role badge,
 * email below) and the hub entries — every hub link lands on /profile/me/
 * with a tab param (the hub island reads ?tab=); the public archive stays
 * reachable from the hub itself, not from this menu. The NSFW soft switch
 * rides here (0.96.0): locked on when the account's "always show" meta is
 * set, otherwise it mirrors the browser cookie (server-read, handed in as
 * user.softNsfw) — toggling rewrites the cookie and reloads so the SSR
 * lists re-render with the new exclusion state. Logout is the destructive
 * item and revokes the session before reloading; the outcome toast rides
 * the flash handoff so it survives the reload.
 */

/** Browser-side soft switch: first-party cookie, readable by the SSR
 * server (the content lists render there) and by this island. Written on
 * toggle only — the read side arrives as a server prop (user.softNsfw),
 * because reading a cookie during render also runs under SSR. */
function writeNsfwCookie(on: boolean): void {
  // Secure rides only on https so local plain-http development keeps working.
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = on
    ? `${NSFW_COOKIE}=1; path=/; max-age=${NSFW_COOKIE_MAX_AGE}; samesite=lax${secure}`
    : `${NSFW_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}

export function UserMenu({
  user,
  copy,
  variant = 'desktop',
}: {
  user: UserCenterUser;
  copy: UserCenterCopy;
  variant?: 'desktop' | 'mobile';
}) {
  // The hard switch wins: the backend ignores NSFW exclusions for this
  // account, so the soft switch renders permanently on and unclickable.
  const nsfwLocked = user.showNsfw;
  // The soft state comes from the shell (user.softNsfw ← the cookie read by
  // the SSR side): the initializer of useState runs during server rendering
  // as well, so a document.cookie read here would throw `document is not
  // defined` and cut the response stream mid-page.
  const [showNsfw, setShowNsfw] = useState<boolean>(user.showNsfw || user.softNsfw);
  const toggleNsfw = (next: boolean) => {
    setShowNsfw(next);
    writeNsfwCookie(next);
    // SSR owns the list filtering: the new cookie only takes effect after
    // the page re-renders server-side.
    window.location.reload();
  };
  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout/', { method: 'POST' });
      if (response.ok) flashToast({ kind: 'success', message: copy.logoutSuccess });
    } catch {
      /* clearing the cookie is what actually matters */
    } finally {
      window.location.reload();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'desktop' ? (
          /* Desktop trigger spells the account out: avatar + name + chevron
             mark the whole pill as the menu handle (mobile stays
             avatar-only per the mobile shell contract). */
          <button
            type="button"
            className="flex h-8 max-w-48 cursor-pointer items-center gap-1.5 rounded-full pr-2 pl-0.5 outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
          >
            <Avatar url={user.avatarUrl} name={user.nickname} className="size-[26px] text-xs" />
            <span className="min-w-0 truncate text-sm font-medium">{user.nickname}</span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-body-muted" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={user.nickname}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
          >
            <Avatar url={user.avatarUrl} name={user.nickname} className="size-[26px] text-xs" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">{user.nickname}</span>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-body-muted">
              {user.roleLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs font-normal text-body-muted">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/profile/me/">
            <UserRoundIcon aria-hidden="true" />
            {copy.profile}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/profile/me/?tab=favorites">
            <BookmarkIcon aria-hidden="true" />
            {copy.favorites}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/profile/me/?tab=wallet">
            <CoinsIcon aria-hidden="true" />
            {copy.wallet}
          </a>
        </DropdownMenuItem>
        {/* Membership modal entry via the bridge — WalletBubble (same
             desktop cluster) owns the modal and listens for it; mobile has
             no wallet bubble, so the entry stays desktop-only until the
             mobile shell grows its own access path. */}
        {variant === 'desktop' && (
          <DropdownMenuItem asChild>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('aiya:open-membership'))}
            >
              <CrownIcon aria-hidden="true" />
              {copy.membership}
            </button>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href="/profile/me/?tab=following">
            <UserRoundCheckIcon aria-hidden="true" />
            {copy.followingTitle}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={NOTIFICATIONS_PAGE_PATH}>
            <BellIcon aria-hidden="true" />
            {copy.notifications}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/profile/me/?tab=settings">
            <SettingsIcon aria-hidden="true" />
            {copy.accountSettings}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {/* Redundant entry: the header headset button is the primary one,
              and its island (same header) owns the dialog. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('aiya:open-chat'))}
          >
            <HeadsetIcon aria-hidden="true" />
            {copy.chatSupport}
          </button>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* The soft switch is a plain row (not a menu item): toggling must
            not close the menu before the reload navigates away. */}
        <div
          className="flex items-center justify-between gap-2 px-2 py-1.5"
          title={nsfwLocked ? copy.showNsfwLocked : undefined}
        >
          <span className="text-sm">{copy.showNsfw}</span>
          <Switch
            checked={showNsfw}
            disabled={nsfwLocked}
            aria-label={nsfwLocked ? copy.showNsfwLocked : copy.showNsfw}
            onCheckedChange={toggleNsfw}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOutIcon aria-hidden="true" />
          {copy.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
