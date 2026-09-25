import { useEffect } from 'react';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

import { consumeFlashToast } from '@/lib/feedback';

// Theme comes from the shell's class-based color mode (html.dark, managed by
// BaseHead's pre-paint script + the header toggle) — not next-themes. Mount
// the Toaster with client:only="react" so the read happens client-side.
const colorMode = (): ToasterProps['theme'] => {
  if (typeof document === 'undefined') return 'system';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

const Toaster = ({ ...props }: ToasterProps) => {
  // Deliver reload-borne session feedback (login/logout queue it via
  // flashToast before reloading): this island is the one flash consumer.
  useEffect(() => {
    const flash = consumeFlashToast();
    if (flash) toast[flash.kind](flash.message);
  }, []);

  return (
    <Sonner
      theme={colorMode()}
      className="toaster group"
      // Placement is site policy, owned here so every mount point lands the
      // same: bottom-right on ≥600px; below that sonner centers horizontally,
      // and the bottom offset clears the TabBar (56px row + safe-area inset).
      position="bottom-right"
      mobileOffset={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
