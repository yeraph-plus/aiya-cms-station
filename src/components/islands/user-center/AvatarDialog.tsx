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
import Avatar from '@/components/islands/Avatar';
import ConfirmPopover from '@/components/islands/ConfirmPopover';
import { apiErrorCopy } from '@/lib/feedback';
import type { Locale } from '@/lib/i18n';

export interface AvatarDialogCopy {
  avatarTitle: string;
  changeAvatar: string;
  removeAvatar: string;
  avatarRemoveConfirm: string;
  cancel: string;
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

  const remove = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/account/avatar/', { method: 'DELETE' });
      const json = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (json?.ok) {
        onChanged(null);
        onOpenChange(false);
        return true;
      }
      setError('generic');
      return false;
    } catch {
      setError('generic');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const errorText = error ? apiErrorCopy(error, locale) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-dialog-sm gap-5 sm:max-w-dialog-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-primary" />
            {copy.avatarTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">{copy.avatarTitle}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <Avatar url={display} name={nickname} className="size-28 text-3xl font-semibold" />
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
              <ConfirmPopover
                text={copy.avatarRemoveConfirm}
                cancelLabel={copy.cancel}
                confirmLabel={copy.removeAvatar}
                onConfirm={remove}
              >
                <Button variant="ghost" size="sm" disabled={busy}>
                  <Trash2Icon className="size-4" />
                  {copy.removeAvatar}
                </Button>
              </ConfirmPopover>
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
