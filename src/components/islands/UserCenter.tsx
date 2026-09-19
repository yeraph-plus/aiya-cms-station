import { useEffect, useRef, useState } from 'react';

import { LogInIcon, UserPlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthDialog } from './user-center/AuthDialog';
import { NotificationPopover } from './user-center/NotificationPopover';
import { UserMenu } from './user-center/UserMenu';
import type { AuthMode, UserCenterCopy, UserCenterUser } from './user-center/types';

export interface UserCenterProps {
  /** Signed-in visitor or null (server-resolved session). */
  user: UserCenterUser | null;
  /** Mirrors site.registrationOpen: hides the sign-up entry when closed. */
  registrationOpen: boolean;
  /** BCP 47 tag for notification date formatting. */
  localeTag: string;
  copy: UserCenterCopy;
}

/**
 * Aggregated user-center island: logged-out = login/register entries plus
 * the auth dialogs; logged-in = notification bubble + user menu bubble.
 * All of the interaction lives in React — the Astro shell renders this one
 * island (per shell) and keeps its own vanilla surface UI-only.
 *
 * Cross-island bridge: any island can dispatch the window event
 * `aiya:open-auth` to pop the login dialog (e.g. a guest hitting a
 * login-only action on a comment composer or follow button).
 */
export default function UserCenter({ user, registrationOpen, localeTag, copy }: UserCenterProps) {
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
      <div className="flex items-center gap-1.5">
        <NotificationPopover copy={copy} localeTag={localeTag} />
        <UserMenu user={user} copy={copy} />
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
      />
    </div>
  );
}
