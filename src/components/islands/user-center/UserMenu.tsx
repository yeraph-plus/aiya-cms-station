import {
  BookmarkIcon,
  CoinsIcon,
  LogOutIcon,
  SettingsIcon,
  UserRoundCheckIcon,
  UserRoundIcon,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserCenterCopy, UserCenterUser } from './types';

/**
 * Avatar bubble: dropdown with the identity header (nickname + role badge,
 * email below) and the hub entries — every hub link lands on /profile/me/
 * with a tab param (the hub island reads ?tab=); the public archive stays
 * reachable from the hub itself, not from this menu. Logout is the
 * destructive item and revokes the session before reloading.
 */
export function UserMenu({ user, copy }: { user: UserCenterUser; copy: UserCenterCopy }) {
  const logout = async () => {
    try {
      await fetch('/api/auth/logout/', { method: 'POST' });
    } catch {
      /* clearing the cookie is what actually matters */
    } finally {
      window.location.reload();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={user.nickname}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" width={26} height={26} className="rounded-full" />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-[26px] items-center justify-center rounded-full bg-secondary text-xs font-medium"
            >
              {user.nickname.slice(0, 1)}
            </span>
          )}
        </button>
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
        <DropdownMenuItem asChild>
          <a href="/profile/me/?tab=following">
            <UserRoundCheckIcon aria-hidden="true" />
            {copy.followingTitle}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/profile/me/?tab=settings">
            <SettingsIcon aria-hidden="true" />
            {copy.accountSettings}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOutIcon aria-hidden="true" />
          {copy.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
