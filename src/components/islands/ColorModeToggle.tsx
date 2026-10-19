import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cycleColorMode } from '@/lib/color-mode';

/**
 * Color-mode toggle, desktop header only. Clicking advances the three-state
 * cycle dark → light → system and persists it; the mobile shell always
 * follows the system palette and carries no button. All three icons render
 * at all times and shell.css picks the visible one from the `data-color-mode`
 * stamp written by BaseHead's pre-paint script — so the component holds no
 * theme state and SSR/first paint agree.
 */
export default function ColorModeToggle({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => {
            cycleColorMode();
          }}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
        >
          <SunIcon data-color-mode-icon="light" className="size-[18px]" aria-hidden="true" />
          <MoonIcon data-color-mode-icon="dark" className="size-[18px]" aria-hidden="true" />
          <MonitorIcon data-color-mode-icon="system" className="size-[18px]" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
