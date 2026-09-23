import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SettingsPanel from './SettingsPanel';
import WalletPanel from './WalletPanel';
import type { Locale } from '@/lib/i18n/locale';
import type { MembershipState, CreditEntry } from '@/lib/core/contracts';
import type { SettingsCopy, SettingsUser } from './SettingsPanel';

export interface HubFavorite {
  id: number;
  title: string;
  url: string;
  date: string;
  thumbUrl: string | null;
}

export interface HubFollowing {
  slug: string;
  name: string;
  avatarUrl: string | null;
}

export interface HubSettings {
  user: SettingsUser;
  locale: Locale;
  copy: SettingsCopy;
  localeOptions: Array<{ value: string; label: string }>;
}

export interface HubWallet {
  locale: Locale;
  timezone: string;
  membership: MembershipState;
  entries: CreditEntry[];
  hasMore: boolean;
}

interface Props {
  favorites: HubFavorite[];
  following: HubFollowing[];
  followers: HubFollowing[];
  settings: HubSettings;
  /** Null for a stale session (the membership read failed) — tab stays out. */
  wallet: HubWallet | null;
  /** Shown when a tab section has no content. */
  emptyText: string;
  followersEmpty: string;
  tabFavorites: string;
  tabFollowing: string;
  tabFollowers: string;
  tabWallet: string;
  tabSettings: string;
  initialTab?: 'favorites' | 'following' | 'followers' | 'wallet' | 'settings';
}

/**
 * Own-profile second level: tabs over 收藏 / 关注 / 钱包 / 设置. Rendered only
 * for the signed-in owner on /profile/ (guests are redirected); public
 * profile pages stay plain SSR lists.
 */
export default function UserHub({
  favorites,
  following,
  followers,
  settings,
  wallet,
  emptyText,
  followersEmpty,
  tabFavorites,
  tabFollowing,
  tabFollowers,
  tabWallet,
  tabSettings,
  initialTab = 'favorites',
}: Props) {
  const [avatarUrl] = useState<string | null>(settings.user.avatarUrl);
  const settingsUser = { ...settings.user, avatarUrl };

  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList>
        <TabsTrigger value="favorites">{tabFavorites}</TabsTrigger>
        <TabsTrigger value="following">{tabFollowing}</TabsTrigger>
        <TabsTrigger value="followers">{tabFollowers}</TabsTrigger>
        {wallet && <TabsTrigger value="wallet">{tabWallet}</TabsTrigger>}
        <TabsTrigger value="settings">{tabSettings}</TabsTrigger>
      </TabsList>

      <TabsContent value="favorites">
        {favorites.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {favorites.map((favorite) => (
              <li key={favorite.id}>
                <a
                  href={favorite.url}
                  className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-body-muted"
                >
                  {favorite.thumbUrl ? (
                    <img
                      src={favorite.thumbUrl}
                      alt=""
                      width={80}
                      height={45}
                      className="h-[45px] w-20 rounded-md object-cover"
                    />
                  ) : (
                    <span className="h-[45px] w-20 rounded-md bg-secondary" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {favorite.title}
                  </span>
                  {favorite.date && (
                    <span className="text-xs text-body-muted">{favorite.date}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-8 text-center text-sm text-body-muted">
            {emptyText}
          </p>
        )}
      </TabsContent>

      <TabsContent value="following">
        {following.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {following.map((author) => (
              <li key={author.slug}>
                <a
                  href={`/profile/${author.slug}/`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-body-muted"
                >
                  {author.avatarUrl ? (
                    <img
                      src={author.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-medium"
                    >
                      {author.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="truncate text-sm font-medium text-foreground">
                    {author.name}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-8 text-center text-sm text-body-muted">
            {emptyText}
          </p>
        )}
      </TabsContent>

      <TabsContent value="followers">
        {followers.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followers.map((author) => (
              <li key={author.slug}>
                <a
                  href={`/profile/${author.slug}/`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-body-muted"
                >
                  {author.avatarUrl ? (
                    <img
                      src={author.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-medium"
                    >
                      {author.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="truncate text-sm font-medium text-foreground">
                    {author.name}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-8 text-center text-sm text-body-muted">
            {followersEmpty}
          </p>
        )}
      </TabsContent>

      {wallet && (
        <TabsContent value="wallet">
          <WalletPanel
            locale={wallet.locale}
            timezone={wallet.timezone}
            membership={wallet.membership}
            entries={wallet.entries}
            hasMore={wallet.hasMore}
          />
        </TabsContent>
      )}

      <TabsContent value="settings">
        <SettingsPanel
          user={settingsUser}
          locale={settings.locale}
          localeOptions={settings.localeOptions}
          copy={settings.copy}
        />
      </TabsContent>
    </Tabs>
  );
}
