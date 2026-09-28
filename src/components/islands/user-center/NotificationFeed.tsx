import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import Spinner from '@/components/islands/Spinner';
import { FeedRow } from '@/components/islands/user-center/NotificationPopover';
import { fetchFeed, markSeen, type NotificationFeedItem } from '@/lib/notifications';

interface FeedCopy {
  notifications: string;
  notificationsLoading: string;
  notificationsEmpty: string;
  notificationsError: string;
  notificationsLoadMore: string;
}

interface Props {
  copy: FeedCopy;
  localeTag: string;
  /** Site calendar timezone (from /site); dates render in it. */
  timezone?: string;
}

const PER_PAGE = 20;

/**
 * Full notification feed page (`/notifications/`, 0.96.0): the same
 * same-origin proxy and client-owned read state as the header bubble —
 * visiting the page marks everything currently known as seen, which
 * clears the bell's unread dot. Guests read the backend's guest-level
 * broadcast slice; signed-in visitors additionally get their targeted
 * rows. Pagination appends in place until the backend says the feed is
 * exhausted.
 */
export default function NotificationFeed({ copy, localeTag, timezone }: Props) {
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (nextPage: number) => {
    const feed = await fetchFeed(nextPage, PER_PAGE);
    if (feed?.ok) {
      const list = feed.items ?? [];
      setItems((previous) => (nextPage === 1 ? list : [...previous, ...list]));
      setPage(nextPage);
      setHasNext(feed.pagination?.hasNext ?? false);
      setState('ready');
      if (nextPage === 1) markSeen(list);
    } else if (nextPage === 1) {
      setState('error');
    }
    // A failed load-more simply keeps the already-loaded rows on screen.
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      await load(page + 1);
      setLoadingMore(false);
    })();
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      {state === 'error' && (
        <p className="px-6 py-12 text-center text-sm text-body-muted">{copy.notificationsError}</p>
      )}
      {state === 'loading' && (
        <p className="px-6 py-12 text-center text-sm text-body-muted">
          <Spinner label={copy.notificationsLoading} />
        </p>
      )}
      {state === 'ready' && items.length === 0 && (
        <p className="px-6 py-12 text-center text-sm text-body-muted">{copy.notificationsEmpty}</p>
      )}
      {state === 'ready' && items.length > 0 && (
        <div>
          {items.map((item, index) => (
            <FeedRow
              key={item.createdAt + String(index)}
              item={item}
              localeTag={localeTag}
              timezone={timezone}
            />
          ))}
        </div>
      )}
      {state === 'ready' && hasNext && (
        <div className="border-t border-border p-4 text-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? (
              <Spinner label={copy.notificationsLoading} />
            ) : (
              copy.notificationsLoadMore
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
