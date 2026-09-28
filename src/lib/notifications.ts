/**
 * Client-side notification feed plumbing shared by the header bubble and
 * the /notifications/ page (0.96.0): the wire fetch rides the same-origin
 * proxy (guests included — the backend answers its guest-level broadcast
 * slice), and read state stays a client-owned last-seen marker per the
 * notification contract. No server imports: both islands import this.
 */

export interface NotificationFeedItem {
  title: string;
  body: string;
  createdAt: string;
}

export interface NotificationPagination {
  page: number;
  totalPages: number;
  hasNext: boolean;
}

export interface NotificationFeed {
  ok?: boolean;
  items?: NotificationFeedItem[];
  pagination?: NotificationPagination;
}

/** Read state is client-owned per the notification contract: the newest
    createdAt is compared against the locally stored last-seen marker. */
export const SEEN_KEY = 'aiya-notifications-seen';

/** Marks everything currently known as seen (both surfaces write the same
    marker, so opening either one clears the unread dot). */
export function markSeen(items: NotificationFeedItem[]): void {
  const max = newest(items);
  if (max !== '') {
    try {
      localStorage.setItem(SEEN_KEY, max);
    } catch {
      /* storage unavailable: the dot just stays */
    }
  }
}

export const newest = (items: NotificationFeedItem[]): string =>
  items.reduce<string>((max, item) => (item.createdAt > max ? item.createdAt : max), '');

export async function fetchFeed(page = 1, perPage?: number): Promise<NotificationFeed | null> {
  try {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (perPage) params.set('perPage', String(perPage));
    const query = params.toString();
    const response = await fetch(`/api/notifications/${query ? `?${query}` : ''}`);
    return (await response.json().catch(() => null)) as NotificationFeed | null;
  } catch {
    return null;
  }
}
