import { useState } from 'react';

import { SearchIcon } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchBox from '@/components/islands/SearchBox';
import { t, type Locale } from '@/lib/i18n';
import type { SearchScope } from '@/lib/search';

export interface MobileSearchProps {
  locale: Locale;
  /** Keyword of the results the visitor is already looking at (the shell
      seeds it from the address bar); empty everywhere else. */
  value?: string;
  /** Scope of those same results. */
  scope?: SearchScope;
}

/**
 * Mobile header search: an icon button that pops a small dialog reusing the
 * desktop `SearchBox` part verbatim (scope select + keyword + submit to
 * /search/{key}/). The dialog replaces the old expanding form row so the
 * top bar carries one icon instead of a full-width field.
 */
export default function MobileSearch({ locale, value = '', scope = 'all' }: MobileSearchProps) {
  const copy = t(locale);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={copy.search.submit}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex size-10 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
      >
        <SearchIcon size={20} strokeWidth={1.8} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-dialog-sm gap-4 sm:max-w-dialog-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base font-semibold">
              <SearchIcon className="size-4 text-primary" aria-hidden="true" />
              {copy.search.submit}
            </DialogTitle>
          </DialogHeader>
          <SearchBox locale={locale} value={value} scope={scope} className="block w-full" />
        </DialogContent>
      </Dialog>
    </>
  );
}
