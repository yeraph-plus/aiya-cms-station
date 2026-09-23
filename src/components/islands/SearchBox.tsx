import { useState } from 'react';
import { SearchIcon } from 'lucide-react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t, type Locale } from '@/lib/i18n';
import { searchHref, SEARCH_SCOPES, type SearchScope } from '@/lib/search';

export interface SearchBoxProps {
  locale: Locale;
  /** Keyword of the results the visitor is already looking at (the shell
      seeds it from the address bar); empty everywhere else. */
  value?: string;
  /** Scope of those same results. */
  scope?: SearchScope;
}

/**
 * Header search: one shadcn InputGroup — leading icon, keyword input, and a
 * trailing scope Select (all / articles / pages / resources). Submitting
 * sends the keyword to its own address (/search/{key}/?type=…), so the
 * results are linkable and the browser's back button works.
 *
 * Changing the scope re-runs the keyword only while the box still holds the
 * committed one: switching scope on a results page is "show me the other
 * types", while editing the text must never fire a search on its own.
 */
export default function SearchBox({ locale, value = '', scope = 'all' }: SearchBoxProps) {
  const copy = t(locale);
  const [key, setKey] = useState(value);
  const [nextScope, setNextScope] = useState<SearchScope>(scope);
  const scopeLabels: Record<SearchScope, string> = {
    all: copy.search.scopeAll,
    post: copy.search.scopePost,
    page: copy.search.scopePage,
    resource: copy.search.scopeResource,
  };

  const submit = (keyword: string, target: SearchScope) => {
    const normalized = keyword.trim();
    if (normalized === '') return;
    window.location.href = searchHref(normalized, target);
  };

  const changeScope = (next: SearchScope) => {
    setNextScope(next);
    const committed = value.trim();
    if (committed !== '' && key.trim() === committed) submit(committed, next);
  };

  return (
    <form
      role="search"
      className="relative hidden min-w-0 flex-1 min-[992px]:block"
      onSubmit={(event) => {
        event.preventDefault();
        submit(key, nextScope);
      }}
    >
      {/* The header's own field look (a filled well rather than a bordered
          input) is kept by overriding the group's border and fill. The scope
          Select leads and the submit icon trails. */}
      <InputGroup className="h-9 w-full max-w-[20rem] border-transparent bg-foreground/10 dark:bg-foreground/10">
        <InputGroupAddon className="pl-2">
          <Select value={nextScope} onValueChange={(next) => changeScope(next as SearchScope)}>
            <SelectTrigger
              size="sm"
              aria-label={copy.search.scopeLabel}
              className="border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {SEARCH_SCOPES.map((item) => (
                <SelectItem key={item} value={item}>
                  {scopeLabels[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          name="q"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          // Enter is handled here rather than left to implicit submission:
          // the Select contributes a second form control, which is exactly
          // the case browsers may decline to submit on Enter.
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submit(key, nextScope);
          }}
          placeholder={copy.search.placeholder}
          aria-label={copy.search.placeholder}
        />
        <InputGroupAddon align="inline-end" className="pr-2">
          {/* A real submit button, not a decorative icon: the Select's
              hidden native field counts as a second form control, which
              suppresses the browser's implicit Enter submission. */}
          <InputGroupButton type="submit" size="icon-xs" aria-label={copy.search.submit}>
            <SearchIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
