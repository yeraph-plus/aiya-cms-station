import { MoonIcon, SunIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Color-mode toggle, desktop header. The mobile top bar keeps its vanilla
 * `data-color-toggle` button driven by AppShell's delegated script — this
 * island deliberately does NOT carry that attribute, or one click would
 * toggle the class twice (delegated listener + own handler). Both icons
 * render at all times and CSS picks the visible one, so the component
 * holds no theme state.
 */
export default function ColorModeToggle({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => {
            const dark = document.documentElement.classList.toggle('dark');
            try {
              localStorage.setItem('aiya-color-mode', dark ? 'dark' : 'light');
            } catch {
              /* storage unavailable — the class toggle still took effect */
            }
          }}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
        >
          <MoonIcon className="size-[18px] dark:hidden" aria-hidden="true" />
          <SunIcon className="hidden size-[18px] dark:block" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
