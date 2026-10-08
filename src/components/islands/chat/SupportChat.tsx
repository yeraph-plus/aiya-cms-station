import { useCallback, useEffect, useRef, useState } from 'react';

import { HeadsetIcon, LoaderCircleIcon, SendHorizontalIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatMessage } from '@/lib/core/contracts';
import { displayDate } from '@/lib/format';
import { toastApiError } from '@/lib/feedback';
import { t, type Locale } from '@/lib/i18n';

/** One chat message row — same shape the wire carries (lib/core/contracts). */
type Row = ChatMessage;

/** Union by id, newest (largest id) first. Optimistic rows ride negative
 *  ids, so they sort as the newest until the real row replaces them. */
function mergeMessages(current: readonly Row[], incoming: readonly Row[]): Row[] {
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => b.id - a.id);
}

interface Props {
  /** The signed-in visitor; null renders the entry gated through the
   *  login dialog bridge (v1 chat is login-only). */
  user: { nickname: string; avatarUrl: string | null } | null;
  locale: Locale;
  /** Site calendar timezone (from /site); displayDate renders dates in it.
   *  Optional — the headers hand it through as their own optional prop. */
  timezone?: string;
}

/**
 * Support chat: a headset button in the desktop action cluster (inside
 * UserCenter, between the membership entry and the avatar) opening one
 * Dialog — the visitor's single conversation with the owner (v1 relays
 * into the owner's Telegram; replies come back as staff rows). Exactly one
 * instance mounts per page; the mobile top bar has no button of its own —
 * the avatar dropdown's entry dispatches `aiya:open-chat`, this island
 * takes it, and the dialog portals to the body, so the owning island
 * sitting in the CSS-hidden desktop header below 992px changes nothing.
 * The wall polls page 1 every 20s while open, "load earlier" pages upward
 * through hasPrevious, and sends are optimistic (temp negative-id row
 * replaced by the stored row; backend 10/60s rate limit surfaces as a
 * toast). No unread badge this round — opening the dialog is the read state.
 */
export default function SupportChat({ user, locale, timezone }: Props) {
  const copy = t(locale).chat;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<{ page: number; hasPrevious: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  /** scrollHeight captured before an earlier-page merge; restored after so
   *  the viewport stays on the same messages instead of jumping. */
  const preserveHeightRef = useRef<number | null>(null);

  const stickToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  /** Fresh page-1 merge — the poll and the open-time load share it; races
   *  are harmless because merging is a union by id. */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/chat/messages/?perPage=20');
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        items?: Row[];
        pagination?: { page: number; hasPrevious: boolean };
      } | null;
      if (json?.ok && json.items && json.pagination) {
        setMessages((prev) => mergeMessages(prev, json.items!));
        setPagination(json.pagination);
      }
    } catch {
      // Network-level rejection: keep whatever the list holds; the next
      // poll retries.
    } finally {
      setLoading(false);
    }
  }, []);

  /** Open: fresh page-1 read, then a 20s poll while the dialog stays up. */
  useEffect(() => {
    if (!open) return;
    void refresh().then(stickToBottom);
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  /** The aiya:open-chat bridge stays wired while closed: the avatar
   *  dropdown's entry (desktop AND mobile — the mobile top bar has no
   *  button) and the membership modal's consultation link all dispatch it
   *  blind. Exactly one instance mounts per page, so one event, one dialog. */
  useEffect(() => {
    const onOpenChat = () => setOpen(true);
    window.addEventListener('aiya:open-chat', onOpenChat);
    return () => window.removeEventListener('aiya:open-chat', onOpenChat);
  }, []);

  /** Keep the viewport pinned to the oldest visible message after an
   *  earlier-page merge. */
  useEffect(() => {
    if (preserveHeightRef.current !== null && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight - preserveHeightRef.current;
      preserveHeightRef.current = null;
    }
  }, [messages]);

  const loadEarlier = async () => {
    if (loadingEarlier || pagination?.hasPrevious !== true) return;
    setLoadingEarlier(true);
    if (listRef.current) preserveHeightRef.current = listRef.current.scrollHeight;
    try {
      const next = pagination!.page + 1;
      const response = await fetch(`/api/chat/messages/?page=${next}&perPage=20`);
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        items?: Row[];
        pagination?: { page: number; hasPrevious: boolean };
      } | null;
      if (json?.ok && json.items && json.pagination) {
        setMessages((prev) => mergeMessages(prev, json.items!));
        setPagination(json.pagination);
      }
    } catch {
      // Keep the current window; the button stays for a retry.
    } finally {
      setLoadingEarlier(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (sending || body === '') return;
    const tempId = -Date.now();
    const temp: Row = { id: tempId, sender: 'visitor', body, createdAt: new Date().toISOString() };
    setSending(true);
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    try {
      const response = await fetch('/api/chat/messages/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: Row;
        code?: string;
      } | null;
      if (json?.ok && json.message) {
        setMessages((prev) =>
          mergeMessages(
            prev.filter((row) => row.id !== tempId),
            [json.message!],
          ),
        );
        stickToBottom();
      } else {
        setMessages((prev) => prev.filter((row) => row.id !== tempId));
        setDraft(body);
        toastApiError(json?.code ?? null, locale);
      }
    } catch {
      setMessages((prev) => prev.filter((row) => row.id !== tempId));
      setDraft(body);
      toastApiError(null, locale);
    } finally {
      setSending(false);
    }
  };

  const openChat = () => {
    if (user === null) {
      window.dispatchEvent(new CustomEvent('aiya:open-auth'));
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.title}
            className="relative text-foreground"
            onClick={openChat}
          >
            <HeadsetIcon className="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copy.title}</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="flex h-[min(600px,80svh)] w-[min(92vw,var(--container-dialog-sm))] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-base font-semibold">{copy.title}</DialogTitle>
          </DialogHeader>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {pagination?.hasPrevious && (
              <div className="pb-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingEarlier}
                  onClick={() => void loadEarlier()}
                >
                  {loadingEarlier ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  {copy.loadEarlier}
                </Button>
              </div>
            )}
            {loading && messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-body-muted">{copy.loading}</p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-body-muted">{copy.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {[...messages].reverse().map((row) => (
                  <li
                    key={row.id}
                    className={
                      row.sender === 'visitor'
                        ? 'flex flex-col items-end'
                        : 'flex flex-col items-start'
                    }
                  >
                    <div
                      title={displayDate(row.createdAt, locale, timezone)}
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        row.sender === 'visitor'
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-secondary/50 text-foreground'
                      }`}
                    >
                      {row.body}
                    </div>
                    <span className="px-1 pt-0.5 text-[11px] text-body-muted">
                      {displayDate(row.createdAt, locale, timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-end gap-2 border-t border-border p-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={copy.placeholder}
              rows={1}
              maxLength={2000}
              className="max-h-24 min-h-9 flex-1 resize-none bg-surface text-sm"
            />
            <Button
              size="icon"
              disabled={sending || draft.trim() === ''}
              onClick={() => void send()}
              aria-label={copy.send}
            >
              {sending ? (
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <SendHorizontalIcon className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
