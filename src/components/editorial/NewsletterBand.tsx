import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * avision's subscribe band: a black strip with an underline-only field and a
 * one-arrow submit. Modernised: the field has a real (visually hidden) label,
 * the arrow is a 44px target, and the 200ms underline/hover choreography is a
 * `group` hover so the whole strip responds — not just the button.
 */
export interface NewsletterBandProps {
  title: string;
  /** Accessible label for the email field. */
  emailLabel: string;
  placeholder: string;
  /** Accessible label for the arrow submit. */
  submitLabel: string;
  action?: string;
  method?: 'get' | 'post';
  /** Query parameters the handler expects (e.g. a nonce). */
  hidden?: Record<string, string>;
  className?: string;
}

export function NewsletterBand({
  title,
  emailLabel,
  placeholder,
  submitLabel,
  action,
  method = 'post',
  hidden,
  className,
}: NewsletterBandProps) {
  const inputId = useId();
  return (
    <div className={cn('bg-ed-shell-deep px-8 py-10 text-ed-on-shell', className)}>
      <p className="text-lg font-bold">{title}</p>
      <form action={action} method={method} className="group mt-8 flex items-end gap-3">
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            {emailLabel}
          </label>
          <input
            id={inputId}
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder={placeholder}
            className="h-10 w-full appearance-none border-b border-white/30 bg-transparent pb-2 text-sm text-ed-on-shell transition-colors duration-fast group-hover:border-white/60 placeholder:text-white/50 focus-visible:border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          />
        </div>
        <button
          type="submit"
          aria-label={submitLabel}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors duration-fast group-hover:text-ed-accent hover:text-ed-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </form>
    </div>
  );
}
