import { useState } from 'react';

import AvatarDialog from '@/components/islands/user-center/AvatarDialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import Avatar from '@/components/islands/Avatar';
import { apiErrorCopy, flashToast } from '@/lib/feedback';
import type { Locale } from '@/lib/i18n';

export interface SettingsUser {
  nickname: string;
  email: string;
  url: string;
  description: string;
  locale: string;
  avatarUrl: string | null;
  /** "Always show NSFW content" (0.96.0) — the account-level hard switch. */
  showNsfw: boolean;
}

export interface SettingsCopy {
  avatarTitle: string;
  changeAvatar: string;
  removeAvatar: string;
  avatarRemoveConfirm: string;
  cancel: string;
  profileTitle: string;
  nicknameLabel: string;
  descriptionLabel: string;
  urlLabel: string;
  localeLabel: string;
  emailLabel: string;
  currentPasswordLabel: string;
  currentPasswordHint: string;
  accountTitle: string;
  newPasswordLabel: string;
  newPasswordHint: string;
  passwordConfirmLabel: string;
  /** Account-level NSFW hard switch (0.96.0). */
  alwaysShowNsfw: string;
  alwaysShowNsfwHint: string;
  save: string;
  saved: string;
  passwordSaved: string;
  authFailed: string;
}

interface Props {
  user: SettingsUser;
  locale: Locale;
  localeOptions: ReadonlyArray<{ value: string; label: string }>;
  copy: SettingsCopy;
}

/**
 * Account settings: one card, three sections — 头像 / 基本资料 (fields in a
 * two-column grid from sm up) / 修改密码·邮箱. The account section merges
 * email and password changes behind ONE shared current-password field: the
 * submit auto-routes — a changed email PATCHes the profile (re-authenticated
 * by that password), filled password fields POST the password change (which
 * revokes every token upstream, so the client signs out and reloads).
 */
export default function SettingsPanel({ user, locale, localeOptions, copy }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  // The saved baseline the "email changed" detection compares against — it
  // moves when an email change commits, so a later retry never re-sends it.
  const [savedEmail, setSavedEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [profileState, setProfileState] = useState<'idle' | 'saved' | string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [accountState, setAccountState] = useState<'idle' | 'saved' | string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  // The NSFW hard switch saves immediately (no form submit): it is a
  // standalone account flag, PATCHed as its own field.
  const [showNsfw, setShowNsfw] = useState<boolean>(user.showNsfw);
  const [showNsfwBusy, setShowNsfwBusy] = useState(false);

  const toggleShowNsfw = async (next: boolean) => {
    setShowNsfw(next);
    setShowNsfwBusy(true);
    try {
      const response = await fetch('/api/account/profile/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showNsfw: next }),
      });
      if (!response.ok) {
        setShowNsfw(!next);
        flashToast({ kind: 'error', message: apiErrorCopy('generic', locale) });
      }
    } catch {
      setShowNsfw(!next);
      flashToast({ kind: 'error', message: apiErrorCopy('generic', locale) });
    } finally {
      setShowNsfwBusy(false);
    }
  };

  const errorText = (state: 'idle' | 'saved' | string | null): string | null => {
    if (!state || state === 'idle' || state === 'saved') return null;
    return apiErrorCopy(state, locale);
  };

  const profileError = errorText(profileState);

  const submitProfile = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setProfileBusy(true);
    setProfileState(null);
    try {
      const response = await fetch('/api/account/profile/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: String(data.get('nickname') ?? ''),
          description: String(data.get('description') ?? ''),
          url: String(data.get('url') ?? ''),
          locale: String(data.get('locale') ?? ''),
        }),
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

  const emailChanged = email !== savedEmail;
  const wantsPassword = password !== '' || passwordConfirm !== '';
  const nothingToSave = !emailChanged && !wantsPassword;

  const submitAccount = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (nothingToSave) return;
    const data = new FormData(event.currentTarget);
    const nextEmail = String(data.get('email') ?? '');
    const sharedCurrentPassword = String(data.get('currentPassword') ?? '');
    setAccountBusy(true);
    setAccountState(null);
    try {
      // Auto-routing: a changed email PATCHes the profile (the shared
      // current password re-authenticates it); filled password fields POST
      // the password change with the same shared secret.
      if (emailChanged) {
        const response = await fetch('/api/account/profile/', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: nextEmail, currentPassword: sharedCurrentPassword }),
        });
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          code?: string;
        } | null;
        if (!json?.ok) {
          setAccountState(json?.code ?? 'generic');
          return;
        }
        setSavedEmail(nextEmail);
        setEmail(nextEmail);
      }
      if (wantsPassword) {
        const response = await fetch('/api/account/password/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: sharedCurrentPassword,
            password,
            passwordConfirm,
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
        setAccountState(json?.code ?? 'generic');
        return;
      }
      setAccountState('saved');
    } catch {
      setAccountState('generic');
    } finally {
      setAccountBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <section className="border-b border-border p-6">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">{copy.avatarTitle}</h3>
        <div className="mt-3 flex items-center gap-4">
          <Avatar url={avatarUrl} name={user.nickname} className="size-16 text-xl font-semibold" />
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
            avatarRemoveConfirm: copy.avatarRemoveConfirm,
            cancel: copy.cancel,
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
          <div className="grid gap-4 sm:grid-cols-2">
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
              <FieldLabel htmlFor="st-locale">{copy.localeLabel}</FieldLabel>
              {/* Members without an explicit choice carry locale:"" — show
                  the language they are actually served (the page locale). */}
              <Select name="locale" defaultValue={user.locale || locale}>
                <SelectTrigger id="st-locale" className="w-full bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {localeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="sm:col-span-2">
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
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="st-show-nsfw">{copy.alwaysShowNsfw}</FieldLabel>
                <Switch
                  id="st-show-nsfw"
                  checked={showNsfw}
                  disabled={showNsfwBusy}
                  onCheckedChange={(next) => void toggleShowNsfw(next)}
                />
              </div>
              <p className="text-xs text-body-muted">{copy.alwaysShowNsfwHint}</p>
            </Field>
          </div>
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
        </form>
      </section>

      <section className="p-6">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">{copy.accountTitle}</h3>
        <form onSubmit={(event) => void submitAccount(event)} className="mt-3 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field>
              <FieldLabel htmlFor="st-current-password">{copy.currentPasswordLabel}</FieldLabel>
              <Input
                id="st-current-password"
                name="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
              <p className="text-xs text-body-muted">{copy.currentPasswordHint}</p>
            </Field>
            <Field>
              <FieldLabel htmlFor="st-password-new">{copy.newPasswordLabel}</FieldLabel>
              <Input
                id="st-password-new"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-body-muted">{copy.newPasswordHint}</p>
            </Field>
            <Field>
              <FieldLabel htmlFor="st-password-confirm">{copy.passwordConfirmLabel}</FieldLabel>
              <Input
                id="st-password-confirm"
                name="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
          </div>
          {accountState && accountState !== 'saved' && (
            <p role="alert" className="text-sm text-error">
              {errorText(accountState)}
            </p>
          )}
          {accountState === 'saved' && (
            <p role="status" className="text-sm text-foreground">
              {copy.saved}
            </p>
          )}
          <Button type="submit" disabled={accountBusy || nothingToSave} className="self-start">
            {copy.save}
          </Button>
        </form>
      </section>
    </div>
  );
}
