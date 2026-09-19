import { useEffect, useState } from 'react';

import { LoaderCircleIcon, SmileIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { rewriteMediaUrl } from '@/lib/media';

interface SmiliesPack {
  slug: string;
  items: { code: string; url: string }[];
}

let cache: SmiliesPack[] | null = null;
let inflight: Promise<SmiliesPack[]> | null = null;

/** Packs load once per page on first open; failures are not cached. */
async function loadPacks(): Promise<SmiliesPack[]> {
  if (cache) return cache;
  inflight ??= fetch('/api/smilies/')
    .then((r) => r.json())
    .then((j) => {
      cache = (j?.data ?? []) as SmiliesPack[];
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Smilies picker: a toolbar button opening a popover of pack items. Picking
 * yields the literal `::code::` token — callers decide where it lands (the
 * Tiptap document, a plain-text textarea). Item URLs cloak to /media/.
 * These are forum-style emoticon images, rendered large (≥64px tall, natural
 * width), grouped by pack under lightweight custom tabs.
 */
export default function SmiliesPicker({
  label,
  onPick,
}: {
  label: string;
  onPick: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [packs, setPacks] = useState<SmiliesPack[] | null>(cache);
  const [failed, setFailed] = useState(false);
  const [activePack, setActivePack] = useState<string | null>(null);

  useEffect(() => {
    if (!open || packs || failed) return;
    let alive = true;
    loadPacks()
      .then((data) => alive && setPacks(data))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [open, packs, failed]);

  const current = packs ? (packs.find((p) => p.slug === activePack) ?? packs[0]) : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFailed(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={label}
          aria-label={label}
          className="text-muted-foreground hover:text-foreground data-[active=true]:text-primary data-[active=true]:bg-secondary"
        >
          <SmileIcon aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto max-w-[24rem] p-2">
        {!packs ? (
          failed ? (
            <p className="py-2 text-center text-xs text-body-muted">—</p>
          ) : (
            <div className="flex justify-center py-2">
              <LoaderCircleIcon
                className="size-4 animate-spin text-body-muted"
                aria-hidden="true"
              />
            </div>
          )
        ) : packs.length === 0 ? (
          <p className="py-2 text-center text-xs text-body-muted">—</p>
        ) : (
          <>
            {/* Lightweight custom pack tabs — shadcn Tabs chrome dwarfs the
                picker. Single-select pills, first pack active by default. */}
            <div className="mb-1.5 flex gap-1">
              {packs.map((pack) => {
                const active = current?.slug === pack.slug;
                return (
                  <button
                    key={pack.slug}
                    type="button"
                    className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                      active
                        ? 'bg-primary font-medium text-primary-foreground'
                        : 'text-body-muted hover:bg-secondary hover:text-foreground'
                    }`}
                    onClick={() => setActivePack(pack.slug)}
                  >
                    {pack.slug}
                  </button>
                );
              })}
            </div>
            <div className="max-h-72 overflow-y-auto">
              <div className="flex flex-wrap items-end gap-1">
                {current?.items.map((item) => {
                  const url = rewriteMediaUrl(item.url);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      title={`::${item.code}::`}
                      className="rounded p-0.5 transition-colors hover:bg-secondary"
                      onClick={() => {
                        // item.code is the token BODY — wrap it into the
                        // closed `::code::` form the backend matches.
                        onPick(`::${item.code}::`);
                        setOpen(false);
                      }}
                    >
                      {/* Forum-emoticon style: 64px tall, natural width. */}
                      <img
                        src={url}
                        alt={item.code}
                        loading="lazy"
                        className="h-16 w-auto object-contain"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
