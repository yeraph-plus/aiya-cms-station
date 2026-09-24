import { useEffect, useRef, useState } from 'react';

import { BellIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Spinner from '@/components/islands/Spinner';
import type { UserCenterCopy } from './types';

interface FeedItem {
  title: string;
  body: string;
  createdAt: string;
}

interface Feed {
  ok?: boolean;
  items?: FeedItem[];
}

// Read state is client-owned per the notification contract: the newest
// createdAt is compared against the locally stored last-seen marker; opening
// the popover is what advances the marker.
const SEEN_KEY = 'aiya-notifications-seen';

const newest = (items: FeedItem[]): string =>
  items.reduce<string>((max, item) => (item.createdAt > max ? item.createdAt : max), '');

const fetchFeed = async (): Promise<Feed | null> => {
  try {
    const response = await fetch('/api/notifications/');
    return (await response.json().catch(() => null)) as Feed | null;
  } catch {
    return null;
  }
};

/** Notification bubble: bell trigger + popover feed + unread dot. */
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
  const [items, setItems] = useState<FeedItem[]>([]);
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
        const max = newest(list);
        setUnread(max !== '' && max > (localStorage.getItem(SEEN_KEY) ?? ''));
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
        const max = newest(list);
        if (max !== '') localStorage.setItem(SEEN_KEY, max);
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
          <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
            {copy.notifications}
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
              items.slice(0, 20).map((item, index) => {
                const created = item.createdAt ? new Date(item.createdAt) : null;
                const valid = created !== null && !Number.isNaN(created.getTime());
                return (
                  <article
                    key={item.createdAt + String(index)}
                    className="border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {valid && (
                      <time
                        dateTime={item.createdAt}
                        className="mt-0.5 block text-[11px] text-body-muted"
                      >
                        {created.toLocaleString(localeTag || navigator.language, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          ...(timezone ? { timeZone: timezone } : {}),
                        })}
                      </time>
                    )}
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-body-muted">
                      {item.body}
                    </p>
                  </article>
                );
              })}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}
