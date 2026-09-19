import { useState } from 'react';

import { KeyRoundIcon, LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { safeContent } from '@/lib/content';

export interface UnlockGateProps {
  postId: number;
  /** Post password badge copy rides from the summary; these are the panel strings. */
  labels: {
    title: string;
    description: string;
    placeholder: string;
    submit: string;
    failed: string;
  };
}

/**
 * Password gate for locked post bodies. The backend deliberately plants no
 * cookie — every unlock POST carries the password and answers the unlocked
 * detail in the same response, so the panel swaps the body in place and a
 * cold reload simply re-asks (server semantics, mirrored client-side).
 */
export default function UnlockGate({ postId, labels }: UnlockGateProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || password === '') return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/content/${postId}/unlock/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        post?: { content?: { html?: string } };
      } | null;
      const body = json?.post?.content?.html;
      if (json?.ok && typeof body === 'string') {
        setHtml(body);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (html !== null) {
    return (
      <div
        className="prose-content mt-6 text-[15px] leading-relaxed text-foreground"
        dangerouslySetInnerHTML={{ __html: safeContent(html) }}
      />
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-dashed border-border bg-surface px-6 py-8">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <KeyRoundIcon className="size-6 text-body-muted" aria-hidden="true" />
        <p className="font-medium text-foreground">{labels.title}</p>
        <p className="text-sm text-body-muted">{labels.description}</p>
        <form onSubmit={(event) => void unlock(event)} className="flex w-full gap-2">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={labels.placeholder}
            maxLength={255}
            required
          />
          <Button type="submit" size="sm" disabled={busy || password === ''}>
            {busy ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              labels.submit
            )}
          </Button>
        </form>
        {failed && (
          <p role="alert" className="text-sm text-error">
            {labels.failed}
          </p>
        )}
      </div>
    </div>
  );
}
