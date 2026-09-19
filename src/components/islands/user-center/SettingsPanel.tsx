import { useState } from 'react';

import AvatarDialog from '@/components/islands/user-center/AvatarDialog';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { t, type Locale } from '@/lib/i18n';

export interface SettingsUser {
  nickname: string;
  email: string;
  url: string;
  description: string;
  locale: string;
  avatarUrl: string | null;
}

export interface SettingsCopy {
  avatarTitle: string;
  changeAvatar: string;
  removeAvatar: string;
  profileTitle: string;
  nicknameLabel: string;
  descriptionLabel: string;
  urlLabel: string;
  localeLabel: string;
  emailLabel: string;
  currentPasswordLabel: string;
  currentPasswordHint: string;
  passwordTitle: string;
  newPasswordLabel: string;
  passwordConfirmLabel: string;
  save: string;
  saved: string;
  passwordSaved: string;
  authFailed: string;
}

interface Props {
  user: SettingsUser;
  locale: Locale;
  localeOptions: Array<{ value: string; label: string }>;
  copy: SettingsCopy;
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-focus-blue';

/** Account settings: one card, subheaded sections — 头像 / 基本资料 / 修改密码. */
export default function SettingsPanel({ user, locale, localeOptions, copy }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const emailChanged = email !== user.email;
  const [profileState, setProfileState] = useState<'idle' | 'saved' | string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordState, setPasswordState] = useState<'idle' | 'saved' | string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const errorText = (state: 'idle' | 'saved' | string | null): string | null => {
    if (!state || state === 'idle' || state === 'saved') return null;
    const errors = t(locale).errors as Record<string, string | undefined>;
    return errors[state] ?? copy.authFailed;
  };

  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setProfileBusy(true);
    setProfileState(null);
    const nextEmail = String(data.get('email') ?? '');
    const currentPassword = String(data.get('currentPassword') ?? '');
    const payload: Record<string, unknown> = {
      nickname: String(data.get('nickname') ?? ''),
      description: String(data.get('description') ?? ''),
      url: String(data.get('url') ?? ''),
      locale: String(data.get('locale') ?? ''),
      email: nextEmail,
    };
    // Only an email change re-authenticates; plain profile fields do not.
    if (nextEmail !== user.email && currentPassword !== '') {
      payload.currentPassword = currentPassword;
    }
    try {
      const response = await fetch('/api/account/profile/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
      } | null;
      if (json?.ok) {
        setProfileState('saved');
      } else {
        setProfileState(json?.code ?? 'generic');
      }
    } catch {
      setProfileState('generic');
    } finally {
      setProfileBusy(false);
    }
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPasswordBusy(true);
    setPasswordState(null);
    try {
      const response = await fetch('/api/account/password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: String(data.get('currentPassword') ?? ''),
          password: String(data.get('password') ?? ''),
          passwordConfirm: String(data.get('passwordConfirm') ?? ''),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
      } | null;
      if (json?.ok) {
        // Every token is revoked upstream: sign out locally and start over.
        await fetch('/api/auth/logout/', { method: 'POST' }).catch(() => {});
        window.location.href = '/';
        return;
      }
      setPasswordState(json?.code ?? 'generic');
    } catch {
      setPasswordState('generic');
    } finally {
      setPasswordBusy(false);
    }
  };

  const profileError =
    profileState && profileState !== 'saved' && profileState !== 'idle' ? profileState : null;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <section className="border-b border-border p-6">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">{copy.avatarTitle}</h3>
        <div className="mt-3 flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={64}
              height={64}
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-full bg-secondary text-xl font-semibold"
            >
              {user.nickname.slice(0, 1)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            {copy.changeAvatar}
          </Button>
        </div>
        <AvatarDialog
          avatarUrl={avatarUrl}
          nickname={user.nickname}
          locale={locale}
          copy={{
            avatarTitle: copy.avatarTitle,
            changeAvatar: copy.changeAvatar,
            removeAvatar: copy.removeAvatar,
            save: copy.save,
            authFailed: copy.authFailed,
          }}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onChanged={(url) => setAvatarUrl(url)}
        />
      </section>

      <section className="border-b border-border p-6">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">{copy.profileTitle}</h3>
        <form onSubmit={(event) => void submitProfile(event)} className="mt-3 flex flex-col gap-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="st-nickname">{copy.nicknameLabel}</FieldLabel>
              <Input
                id="st-nickname"
                name="nickname"
                defaultValue={user.nickname}
                required
                maxLength={50}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-description">{copy.descriptionLabel}</FieldLabel>
              <Textarea
                id="st-description"
                name="description"
                defaultValue={user.description}
                rows={3}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-url">{copy.urlLabel}</FieldLabel>
              <Input
                id="st-url"
                name="url"
                type="url"
                defaultValue={user.url}
                placeholder="https://"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-locale">{copy.localeLabel}</FieldLabel>
              <select
                id="st-locale"
                name="locale"
                defaultValue={user.locale}
                className={inputClass}
              >
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="st-email">{copy.emailLabel}</FieldLabel>
              <Input
                id="st-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            {emailChanged && (
              <Field>
                <FieldLabel htmlFor="st-current-password">{copy.currentPasswordLabel}</FieldLabel>
                <Input
                  id="st-current-password"
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                />
                <p className="text-xs text-body-muted">{copy.currentPasswordHint}</p>
              </Field>
            )}
            {profileError && (
              <p role="alert" className="text-sm text-error">
                {errorText(profileError)}
              </p>
            )}
            {profileState === 'saved' && (
              <p role="status" className="text-sm text-foreground">
                {copy.saved}
              </p>
            )}
            <Button type="submit" disabled={profileBusy} className="self-start">
              {copy.save}
            </Button>
          </FieldGroup>
        </form>
      </section>

      <section className="p-6">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">
          {copy.passwordTitle}
        </h3>
        <form onSubmit={(event) => void submitPassword(event)} className="mt-3 flex flex-col gap-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="st-password-current">{copy.currentPasswordLabel}</FieldLabel>
              <Input
                id="st-password-current"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-password-new">{copy.newPasswordLabel}</FieldLabel>
              <Input
                id="st-password-new"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="st-password-confirm">{copy.passwordConfirmLabel}</FieldLabel>
              <Input
                id="st-password-confirm"
                name="passwordConfirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            {passwordState && passwordState !== 'saved' && (
              <p role="alert" className="text-sm text-error">
                {errorText(passwordState)}
              </p>
            )}
            <Button type="submit" disabled={passwordBusy} className="self-start">
              {copy.save}
            </Button>
          </FieldGroup>
        </form>
        {passwordState === 'saved' && (
          <p role="status" className="mt-3 text-sm text-foreground">
            {copy.passwordSaved}
          </p>
        )}
      </section>
    </div>
  );
}
