import { useEffect, useState } from 'react';

import { CheckIcon, UserPlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface FollowButtonCopy {
  follow: string;
  unfollow: string;
  loginToFollow: string;
}

type Status = 'loading' | 'on' | 'off' | 'guest';

/**
 * Follow/unfollow toggle for the public profile page. State comes from the
 * same-origin /api/follow proxy (the bearer never leaves the cookie); a
 * guest's first follow attempt pops the login dialog through the
 * `aiya:open-auth` window event handled by the UserCenter island. `self`
 * renders the disabled state shown on one's own articles.
 */
export function FollowButton({
  userId,
  copy,
  self = false,
  className,
}: {
  userId: number;
  copy: FollowButtonCopy;
  self?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (self) return;
    void (async () => {
      try {
        const response = await fetch(`/api/follow/${userId}/`);
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          following?: boolean;
        } | null;
        setStatus(json?.ok ? (json.following ? 'on' : 'off') : 'guest');
      } catch {
        setStatus('guest');
      }
    })();
  }, [userId, self]);

  const toggle = async () => {
    setBusy(true);
    try {
      const method = status === 'on' ? 'DELETE' : 'POST';
      const response = await fetch(`/api/follow/${userId}/`, { method });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        following?: boolean;
      } | null;
      if (response.status === 401) {
        setStatus('guest');
        window.dispatchEvent(new CustomEvent('aiya:open-auth'));
        return;
      }
      if (json?.ok) setStatus(json.following ? 'on' : 'off');
    } catch {
      /* keep the current state; the next click retries */
    } finally {
      setBusy(false);
    }
  };

  if (self) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        {copy.follow}
      </Button>
    );
  }

  if (status === 'guest') {
    return (
      <span className="flex items-center gap-2 text-sm text-body-muted">
        {copy.loginToFollow}
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent('aiya:open-auth'))}
        >
          {copy.follow}
        </Button>
      </span>
    );
  }

  const on = status === 'on';
  return (
    <Button
      variant={on ? 'outline' : 'default'}
      size="sm"
      onClick={() => void toggle()}
      disabled={busy || status === 'loading'}
      className={className}
    >
      {on ? <CheckIcon className="size-4" /> : <UserPlusIcon className="size-4" />}
      {on ? copy.unfollow : copy.follow}
    </Button>
  );
}

export default FollowButton;
