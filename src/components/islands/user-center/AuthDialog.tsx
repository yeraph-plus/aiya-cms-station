import { useState } from 'react';

import { LogInIcon, UserPlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { flashToast } from '@/lib/feedback';
import { LOCALE_OPTIONS } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n/locale';
import type { AuthMode, AuthResponse, UserCenterCopy } from './types';

/**
 * Login / sign-up dialogs on top of the shadcn Dialog, composed like the
 * login-01 / signup-01 blocks (Field + Input + Button) minus the page card.
 * The form posts to the same-origin auth proxies and answers with
 * front-end-owned copy only; success reloads so the SSR shell picks up the
 * fresh session cookie. Sign-up carries the interface language so the
 * viewer's first render resolves to their own locale.
 */
export function AuthDialog({
  mode,
  onModeChange,
  onOpenChange,
  copy,
  registrationOpen,
  locale,
}: {
  mode: AuthMode | null;
  onModeChange: (mode: AuthMode) => void;
  onOpenChange: (open: boolean) => void;
  copy: UserCenterCopy;
  registrationOpen: boolean;
  locale: Locale;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);

  const switchMode = (next: AuthMode) => {
    setError(null);
    onModeChange(next);
  };

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === null) return;
    const data = new FormData(event.currentTarget);
    const payload =
      mode === 'login'
        ? {
            email: String(data.get('email') ?? ''),
            password: String(data.get('password') ?? ''),
            remember: data.get('remember') === 'on',
          }
        : {
            nickname: String(data.get('nickname') ?? ''),
            email: String(data.get('email') ?? ''),
            password: String(data.get('password') ?? ''),
            passwordConfirm: String(data.get('passwordConfirm') ?? ''),
            locale: String(data.get('locale') ?? '') || undefined,
          };
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login/' : '/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => null)) as AuthResponse | null;
      if (response.ok && json?.ok) {
        // Success feedback outlives the reload via the flash handoff; the
        // fresh page's SSR shell also picks up the session cookie.
        flashToast({
          kind: 'success',
          message: mode === 'register' ? copy.registerSuccess : copy.loginSuccess,
        });
        window.location.reload();
        return;
      }
      const message = json?.message || copy.authFailed;
      toast.error(message);
      setError(message);
    } catch {
      setError(copy.authFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="w-[min(92vw,var(--container-dialog-sm))] gap-5 sm:max-w-dialog-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'register' ? (
              <UserPlusIcon className="size-4 text-primary" />
            ) : (
              <LogInIcon className="size-4 text-primary" />
            )}
            {mode === 'register' ? copy.register : copy.login}
          </DialogTitle>
          <DialogDescription>{copy.welcome}</DialogDescription>
        </DialogHeader>
        {/* key resets the fields when switching modes inside the open dialog */}
        <form key={mode ?? 'login'} onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup className="gap-4">
            {mode === 'register' && (
              <Field>
                <FieldLabel htmlFor="uc-nickname">{copy.nicknameLabel}</FieldLabel>
                <Input
                  id="uc-nickname"
                  name="nickname"
                  required
                  maxLength={50}
                  autoComplete="nickname"
                />
              </Field>
            )}
            {mode === 'register' && (
              <Field>
                <FieldLabel htmlFor="uc-locale">{copy.localeLabel}</FieldLabel>
                <Select name="locale" defaultValue={locale}>
                  <SelectTrigger id="uc-locale" className="w-full bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="uc-email">{copy.emailLabel}</FieldLabel>
              <Input id="uc-email" name="email" type="email" required autoComplete="email" />
            </Field>
            <Field>
              <FieldLabel htmlFor="uc-password">{copy.passwordLabel}</FieldLabel>
              <Input
                id="uc-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </Field>
            {mode === 'register' && (
              <Field>
                <FieldLabel htmlFor="uc-password-confirm">{copy.passwordConfirmLabel}</FieldLabel>
                <Input
                  id="uc-password-confirm"
                  name="passwordConfirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
            )}
            {mode === 'login' && (
              <div className="text-right">
                <a
                  href="/reset-password/"
                  className="text-sm underline-offset-4 text-body-muted hover:text-foreground hover:underline"
                >
                  {copy.forgotPassword}
                </a>
              </div>
            )}
            {mode === 'login' && (
              <label className="flex items-center gap-2 text-sm text-body-muted">
                <input type="hidden" name="remember" value={remember ? 'on' : 'off'} />
                <Checkbox
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                />
                {copy.remember}
              </label>
            )}
            {error !== null && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {mode === 'register' ? (
                <UserPlusIcon className="size-4" />
              ) : (
                <LogInIcon className="size-4" />
              )}
              {mode === 'register' ? copy.register : copy.login}
            </Button>
          </FieldGroup>
          {mode === 'login' && registrationOpen && (
            <p className="text-center text-sm text-body-muted">
              {copy.switchToRegisterHint}{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {copy.register}
              </button>
            </p>
          )}
          {mode === 'register' && (
            <p className="text-center text-sm text-body-muted">
              {copy.switchToLoginHint}{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {copy.login}
              </button>
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
