import { useEffect, useRef, useState } from 'react';

import { LogInIcon, UserPlusIcon, UserRoundIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthDialog } from './user-center/AuthDialog';
import { UserMenu } from './user-center/UserMenu';
import { WalletBubble } from './user-center/WalletBubble';
import type { AuthMode, UserCenterCopy, UserCenterUser } from './user-center/types';
import type { Locale } from '@/lib/i18n/locale';

export interface UserCenterProps {
  /** Signed-in visitor or null (server-resolved session). */
  user: UserCenterUser | null;
  /** Mirrors site.registrationOpen: hides the sign-up entry when closed. */
  registrationOpen: boolean;
  /** BCP 47 tag for notification date formatting. */
  localeTag: string;
  /** Locale the wallet bubble renders its copy with. */
  locale: Locale;
  /** Site calendar timezone (from /site) for wallet date rendering. */
  timezone?: string;
  copy: UserCenterCopy;
  /** Desktop keeps the text entries and the wallet chip; mobile collapses
      to a single avatar slot — guests get the login dialog (sign-up lives
      inside it), members the avatar menu (wallet rides the hub tab). */
  variant?: 'desktop' | 'mobile';
}

/**
 * Aggregated user-center island: logged-out = login entries plus the auth
 * dialogs; logged-in = wallet bubble + user menu bubble. The notification
 * bubble is NOT here anymore (0.96.0): it moved out of the session gate
 * next to the color-mode toggle, where guests read it too. All of the
 * interaction lives in React — the Astro shell renders this one island
 * (per shell) and keeps its own vanilla surface UI-only.
 *
 * Cross-island bridge: any island can dispatch the window event
 * `aiya:open-auth` to pop the login dialog (e.g. a guest hitting a
 * login-only action on a comment composer or follow button).
 */
export default function UserCenter({
  user,
  registrationOpen,
  localeTag,
  locale,
  timezone,
  copy,
  variant = 'desktop',
}: UserCenterProps) {
  const [dialogMode, setDialogMode] = useState<AuthMode | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Both shells mount this island (desktop header + mobile top bar, the
    // shell CSS hides exactly one of them). A Radix dialog portals to the
    // body, so a hidden instance answering the bridge event would stack a
    // second dialog on top of the visible one — only the on-screen island
    // may open.
    const open = () => {
      if (rootRef.current && rootRef.current.getClientRects().length === 0) return;
      setDialogMode('login');
    };
    window.addEventListener('aiya:open-auth', open);
    return () => window.removeEventListener('aiya:open-auth', open);
  }, []);

  if (user) {
    return (
      <div ref={rootRef} className="flex items-center gap-1.5">
        {variant === 'desktop' && <WalletBubble locale={locale} timezone={timezone} />}
        <UserMenu user={user} copy={copy} />
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div ref={rootRef} className="flex items-center">
        <button
          type="button"
          onClick={() => setDialogMode('login')}
          aria-label={copy.login}
          className="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-secondary text-body-muted">
            <UserRoundIcon className="size-4" />
          </span>
        </button>
        <AuthDialog
          mode={dialogMode}
          onModeChange={setDialogMode}
          onOpenChange={() => setDialogMode(null)}
          copy={copy}
          registrationOpen={registrationOpen}
          locale={locale}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" onClick={() => setDialogMode('login')}>
        <LogInIcon className="size-4" />
        {copy.login}
      </Button>
      {registrationOpen && (
        <Button size="sm" onClick={() => setDialogMode('register')}>
          <UserPlusIcon className="size-4" />
          {copy.register}
        </Button>
      )}
      <AuthDialog
        mode={dialogMode}
        onModeChange={setDialogMode}
        onOpenChange={() => setDialogMode(null)}
        copy={copy}
        registrationOpen={registrationOpen}
        locale={locale}
      />
    </div>
  );
}
