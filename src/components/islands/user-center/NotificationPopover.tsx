import { useEffect, useRef, useState } from 'react';

import { BellIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Spinner from '@/components/islands/Spinner';
import { notificationTime } from '@/lib/format';
import { fetchFeed, markSeen, SEEN_KEY, type NotificationFeedItem } from '@/lib/notifications';
import type { UserCenterCopy } from './types';

/** The full-feed page this bubble links into (0.96.0). */
export const NOTIFICATIONS_PAGE_PATH = '/notifications/';

/**
 * Notification bubble: bell trigger + popover feed + unread dot. Mounted
 * OUTSIDE the session gate (next to the color-mode toggle, 0.96.0):
 * guests read the backend's guest-level broadcast slice through the same
 * proxy, signed-in visitors additionally get their targeted rows.
 */
export function NotificationPopover({
  copy,
  localeTag,
  timezone,
}: {
  copy: UserCenterCopy;
  localeTag: string;
  /** Site calendar timezone (from /site); dates render in it. */
  timezone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [unread, setUnread] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  // Background unread check; the result also primes the panel content. The
  // island mounts once per shell (desktop + mobile) and the shell CSS hides
  // exactly one — a display:none instance skips the fetch; opening the
  // popover always refreshes, so a viewport cross-over self-heals.
  useEffect(() => {
    if (rootRef.current && rootRef.current.getClientRects().length === 0) return;
    void (async () => {
      const feed = await fetchFeed();
      if (feed?.ok) {
        const list = feed.items ?? [];
        setItems(list);
        let seen = '';
        try {
          seen = localStorage.getItem(SEEN_KEY) ?? '';
        } catch {
          /* storage unavailable (private mode) — everything reads unread */
        }
        setUnread(list.some((item) => item.createdAt > seen));
      }
      // failures stay silent here: the dot simply never lights up
    })();
  }, []);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setState('loading');
    void (async () => {
      const feed = await fetchFeed();
      if (feed?.ok) {
        const list = feed.items ?? [];
        setItems(list);
        setState('ready');
        markSeen(list);
        setUnread(false);
      } else {
        setState('error');
      }
    })();
  };

  return (
    <span ref={rootRef}>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.notifications}
            title={copy.notifications}
            className="relative text-foreground"
          >
            <BellIcon className="size-[18px]" />
            {unread && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">{copy.notifications}</span>
            <a
              href={NOTIFICATIONS_PAGE_PATH}
              className="text-xs text-body-muted transition-colors hover:text-primary"
            >
              {copy.notificationsViewAll} →
            </a>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {state === 'error' && (
              <p className="px-4 py-8 text-center text-sm text-body-muted">
                {copy.notificationsError}
              </p>
            )}
            {state === 'loading' && (
              <p className="px-4 py-8 text-center text-sm text-body-muted">
                <Spinner label={copy.notificationsLoading} />
              </p>
            )}
            {state === 'ready' && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-body-muted">
                {copy.notificationsEmpty}
              </p>
            )}
            {state === 'ready' &&
              items
                .slice(0, 20)
                .map((item, index) => (
                  <FeedRow
                    key={item.createdAt + String(index)}
                    item={item}
                    localeTag={localeTag}
                    timezone={timezone}
                  />
                ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** One notification row (title / date / excerpt) — shared shape with the
    full-feed page island. */
export function FeedRow({
  item,
  localeTag,
  timezone,
}: {
  item: NotificationFeedItem;
  localeTag: string;
  timezone?: string;
}) {
  const created = item.createdAt ? new Date(item.createdAt) : null;
  const valid = created !== null && !Number.isNaN(created.getTime());
  return (
    <article className="border-b border-border px-4 py-3 last:border-b-0">
      <p className="truncate text-sm font-medium">{item.title}</p>
      {valid && (
        <time dateTime={item.createdAt} className="mt-0.5 block text-[11px] text-body-muted">
          {/* localeTag is the BCP 47 tag the shells convert from page.locale;
              notificationTime degrades a malformed tag instead of throwing
              (a throw inside this row unmounts the whole island). */}
          {notificationTime(item.createdAt, localeTag, timezone)}
        </time>
      )}
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-body-muted">{item.body}</p>
    </article>
  );
}
