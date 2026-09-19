import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { t, type Locale } from '@/lib/i18n';

interface Props {
  threadId: number;
  canReply: boolean;
  locale: Locale;
}

/** Login-only reply composer under a discussion thread. Guests get a
 * prompt whose button pops the login dialog via the aiya:open-auth bridge;
 * a successful reply reloads so the SSR thread re-renders with it. */
export default function ReplyComposer({ threadId, canReply, locale }: Props) {
  const copy = t(locale).community;
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canReply) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-body-muted">
        {t(locale).comments.loginRequired}
        <Button
          variant="link"
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent('aiya:open-auth'))}
        >
          {t(locale).shell.login}
        </Button>
      </div>
    );
  }

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (content.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/discussions/${threadId}/replies/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (json?.ok) {
        window.location.reload();
        return;
      }
      setError(copy.failed);
    } catch {
      setError(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={t(locale).comments.composerPlaceholder}
        rows={3}
        required
        maxLength={10000}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" disabled={busy || content.trim() === ''}>
          {busy ? '…' : copy.repliesTitle}
        </Button>
      </div>
    </form>
  );
}
