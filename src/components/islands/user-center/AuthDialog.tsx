import { useState } from 'react';

import { LogInIcon, UserPlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { AuthMode, AuthResponse, UserCenterCopy } from './types';

/**
 * Login / sign-up dialogs on top of the shadcn Dialog, composed like the
 * login-01 / signup-01 blocks (Field + Input + Button) minus the page card.
 * The form posts to the same-origin auth proxies and answers with
 * front-end-owned copy only; success reloads so the SSR shell picks up the
 * fresh session cookie.
 */
export function AuthDialog({
  mode,
  onModeChange,
  onOpenChange,
  copy,
  registrationOpen,
}: {
  mode: AuthMode | null;
  onModeChange: (mode: AuthMode) => void;
  onOpenChange: (open: boolean) => void;
  copy: UserCenterCopy;
  registrationOpen: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        window.location.reload();
        return;
      }
      setError(json?.message || copy.authFailed);
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
      <DialogContent className="w-[min(92vw,380px)] gap-5 sm:max-w-[380px]">
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
                <input type="checkbox" name="remember" className="accent-primary" />
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
