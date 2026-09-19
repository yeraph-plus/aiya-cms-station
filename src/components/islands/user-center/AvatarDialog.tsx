import { useEffect, useRef, useState } from 'react';

import { KeyRoundIcon, Trash2Icon, UploadIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n';

export interface AvatarDialogCopy {
  avatarTitle: string;
  changeAvatar: string;
  removeAvatar: string;
  save: string;
  authFailed: string;
}

interface Props {
  avatarUrl: string | null;
  nickname: string;
  locale: Locale;
  copy: AvatarDialogCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the fresh avatar URL after upload, or null after removal. */
  onChanged: (url: string | null) => void;
}

/**
 * Avatar configuration dialog (user's suggestion: a dedicated modal part).
 * Select → local preview → save uploads the multipart file; remove falls
 * back to Gravatar. Errors surface through the front-end dictionary.
 */
export default function AvatarDialog({
  avatarUrl,
  nickname,
  locale,
  copy,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [pending, setPending] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  // Revoke the local preview URL whenever the dialog closes. A separate
  // unmount effect covers ClientRouter tearing the island down while the
  // dialog is open — it must not share the close effect, whose cleanup
  // would otherwise null the ref before the close branch reads it.
  useEffect(() => {
    if (!open && objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
      setPending(null);
      setPreview(null);
      setError(null);
    }
  }, [open]);
  useEffect(() => {
    return () => {
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
      }
    };
  }, []);

  const display = preview ?? avatarUrl;

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPending(file);
    setPreview(objectUrl.current);
    setError(null);
  };

  const upload = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('avatar', pending, pending.name || 'avatar');
      const response = await fetch('/api/account/avatar/', { method: 'POST', body: form });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        user?: { avatar?: { url?: string } };
        code?: string;
      } | null;
      if (json?.ok && json.user?.avatar?.url) {
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
        onChanged(json.user.avatar.url);
        onOpenChange(false);
      } else {
        setError(json?.code ?? 'generic');
      }
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/account/avatar/', { method: 'DELETE' });
      const json = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (json?.ok) {
        onChanged(null);
        onOpenChange(false);
      } else {
        setError('generic');
      }
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  };

  const errors = t(locale).errors as Record<string, string | undefined>;
  const errorText = error ? (errors[error] ?? copy.authFailed) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,380px)] gap-5 sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-primary" />
            {copy.avatarTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">{copy.avatarTitle}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {display ? (
            <img
              src={display}
              alt={nickname}
              width={112}
              height={112}
              className="size-28 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-28 items-center justify-center rounded-full bg-secondary text-3xl font-semibold"
            >
              {nickname.slice(0, 1)}
            </span>
          )}
          {preview && <p className="text-xs text-body-muted">{copy.changeAvatar}</p>}
          <input
            ref={fileInput}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={pick}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <UploadIcon className="size-4" />
              {copy.changeAvatar}
            </Button>
            {avatarUrl && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
                <Trash2Icon className="size-4" />
                {copy.removeAvatar}
              </Button>
            )}
          </div>
          {errorText && (
            <p role="alert" className="text-sm text-error">
              {errorText}
            </p>
          )}
          {pending && (
            <Button className="w-full" disabled={busy} onClick={() => void upload()}>
              {copy.save}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
