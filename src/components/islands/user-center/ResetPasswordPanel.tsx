import { useEffect, useState } from 'react';

import { KeyRoundIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiErrorCopy } from '@/lib/feedback';
import { t, type Locale } from '@/lib/i18n';

export interface ResetPanelCopy {
  resetTitle: string;
  resetRequestDesc: string;
  sendResetLink: string;
  resetSent: string;
  resetInvalid: string;
  resetDone: string;
  newPasswordLabel: string;
  passwordConfirmLabel: string;
  save: string;
  authFailed: string;
}

interface Props {
  /** Query args from the reset link; absent → the request form. */
  login: string | null;
  /** Reset token from the emailed link. (React reserves `key`, so the
      token must not travel under that prop name.) */
  resetKey: string | null;
  locale: Locale;
  copy: ResetPanelCopy;
}

/** Header matching the auth dialog: icon, title, description. */
function PanelHeader({ copy }: { copy: ResetPanelCopy }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-lg font-medium text-foreground">
        <KeyRoundIcon className="size-4 text-primary" />
        {copy.resetTitle}
      </p>
      <p className="text-sm leading-relaxed text-body-muted">{copy.resetRequestDesc}</p>
    </div>
  );
}

/** Terminal states only; transient machine codes live in `errorCode`. */
type Status =
  'request' | 'sending' | 'sent' | 'validating' | 'form' | 'saving' | 'done' | 'invalid' | 'error';

/**
 * Password-reset island with two modes: the email request form (no query
 * args) and the key-carrying reset form (validate → new password). All
 * feedback is front-end-owned copy; the request answer never reveals
 * whether an account exists.
 */
export default function ResetPasswordPanel({ login, resetKey, locale, copy }: Props) {
  const hasKey = Boolean(login && resetKey);
  const [status, setStatus] = useState<Status>(hasKey ? 'validating' : 'request');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // With login+key in the URL, validate the key before showing the form.
  useEffect(() => {
    if (!hasKey) return;
    void (async () => {
      try {
        const response = await fetch('/api/auth/password-reset/validate/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, key: resetKey }),
        });
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          valid?: boolean;
          code?: string;
        } | null;
        if (json?.ok && json.valid) {
          setStatus('form');
        } else if (json?.code === 'aiya_invalid_reset_key') {
          setStatus('invalid');
        } else {
          setErrorCode(json?.code ?? null);
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    })();
  }, [hasKey, login, resetKey]);

  const submitRequest = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus('sending');
    try {
      const response = await fetch('/api/auth/password-reset/request/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(data.get('email') ?? '') }),
      });
      // Anti-enumeration: the answer is the same whether the account exists.
      await response.json().catch(() => null);
      setStatus('sent');
    } catch {
      setStatus('sent');
    }
  };

  const submitReset = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus('saving');
    try {
      const response = await fetch('/api/auth/password-reset/reset/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          key: resetKey,
          password: String(data.get('password') ?? ''),
          passwordConfirm: String(data.get('passwordConfirm') ?? ''),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
      } | null;
      if (json?.ok) {
        setStatus('done');
      } else if (json?.code === 'aiya_invalid_reset_key') {
        setStatus('invalid');
      } else {
        setErrorCode(json?.code ?? null);
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="rounded-lg border border-border bg-surface p-6">
      <PanelHeader copy={copy} />
      <div className="mt-5">{children}</div>
    </div>
  );

  if (status === 'sent') {
    return shell(
      <p role="status" className="text-center text-sm text-foreground">
        {copy.resetSent}
      </p>,
    );
  }
  if (status === 'done') {
    return shell(
      <div className="text-center">
        <p role="status" className="text-sm text-foreground">
          {copy.resetDone}
        </p>
        <a
          href="/"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t(locale).common.backHome}
        </a>
      </div>,
    );
  }
  if (status === 'invalid') {
    return shell(
      <div className="text-center">
        <p role="alert" className="text-sm text-error">
          {copy.resetInvalid}
        </p>
        <a
          href="/reset-password/"
          className="mt-4 inline-block text-sm text-primary underline underline-offset-4 hover:opacity-90"
        >
          {copy.sendResetLink}
        </a>
      </div>,
    );
  }
  if (status === 'validating') {
    return shell(<p className="text-center text-sm text-body-muted">…</p>);
  }

  if (!hasKey) {
    return shell(
      <form onSubmit={(event) => void submitRequest(event)} className="flex flex-col gap-4">
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="rp-email">{t(locale).shell.emailLabel}</FieldLabel>
            <Input id="rp-email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Button type="submit" disabled={status === 'sending'}>
            {copy.sendResetLink}
          </Button>
        </FieldGroup>
      </form>,
    );
  }

  const formError =
    status === 'error' ? (errorCode ? apiErrorCopy(errorCode, locale) : copy.authFailed) : null;
  return shell(
    <form onSubmit={(event) => void submitReset(event)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="rp-password">{copy.newPasswordLabel}</FieldLabel>
          <Input
            id="rp-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="rp-password-confirm">{copy.passwordConfirmLabel}</FieldLabel>
          <Input
            id="rp-password-confirm"
            name="passwordConfirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        {formError && (
          <p role="alert" className="text-sm text-error">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={status === 'saving'}>
          {copy.save}
        </Button>
      </FieldGroup>
    </form>,
  );
}
