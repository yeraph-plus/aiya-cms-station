import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { t, type Locale } from '@/lib/i18n';

interface Props {
  threadId: number;
  canEdit: boolean;
  canDelete: boolean;
  initialTitle: string;
  initialContent: string;
  isClosed: boolean;
  locale: Locale;
}

/**
 * Author/admin controls for a thread: inline edit (title + content →
 * PATCH), close (status → closed via PATCH) and delete (AlertDialog
 * confirm → DELETE, then back to the community index). The can* flags are
 * server-derived; the island never re-implements the rules.
 */
export default function ThreadActions({
  threadId,
  canEdit,
  canDelete,
  initialTitle,
  initialContent,
  isClosed,
  locale,
}: Props) {
  const copy = t(locale).community;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit && !canDelete) return null;

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/discussions/${threadId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/discussions/${threadId}/`, { method: 'DELETE' });
      const json = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (json?.ok) {
        window.location.href = '/community/';
        return;
      }
      setError(copy.failed);
      setBusy(false);
    } catch {
      setError(copy.failed);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {copy.edit}
          </Button>
          {!isClosed && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void patch({ status: 'closed' })}
            >
              {copy.closeThread}
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-error" disabled={busy}>
                  {copy.delete}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{copy.deleteConfirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{copy.deleteConfirmDesc}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void remove()}>
                    {copy.confirmDelete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </div>
      )}
      {editing && canEdit && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void patch({
              title: String(data.get('title') ?? ''),
              content: String(data.get('content') ?? ''),
            });
          }}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <Input
            name="title"
            defaultValue={initialTitle}
            required
            maxLength={191}
            aria-label={copy.titleLabel}
          />
          <Textarea
            name="content"
            defaultValue={initialContent}
            required
            rows={6}
            maxLength={20000}
            aria-label={copy.contentLabel}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {t(locale).settings.save}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
