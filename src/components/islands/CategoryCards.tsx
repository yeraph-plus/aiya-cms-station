import { Card } from '@/components/ui/card';

/** Cloaked image shape (url already /media/-rewritten by the Astro side). */
export interface CategoryCardImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface CategoryCardData {
  slug: string;
  /** Owning public type ('posts' | 'resources' | 'pages') — picks the badge. */
  type: string;
  name: string;
  description: string;
  cover: CategoryCardImage | null;
  count: number;
  /** Preformatted counter ("共有 3 篇") — island props cannot carry
      functions, so the locale-aware formatting happens Astro-side. */
  countText: string;
  /** Preformatted public-type badge text ("文章"). */
  typeLabel: string;
  /** Term icon meta resolved to inner SVG (null when unresolvable). */
  icon: string | null;
}

interface CardProps {
  card: CategoryCardData;
  /** Site default preview image — shown when the term has no cover. */
  defaultCover: CategoryCardImage | null;
  /** Target path; omit when the card represents the current page. */
  href?: string;
}

/** One category card: cover on top (site default preview as fallback) with
    a dark fade overlay carrying the type badge + title, the description on
    its own line and the post count at the right. Shared by the /categories/
    hub grid and the category page header. */
export function CategoryCard({ card, defaultCover, href }: CardProps) {
  const cover = card.cover ?? defaultCover;
  const body = (
    <>
      <div className="relative">
        {cover ? (
          <img
            src={cover.url}
            alt={cover.alt}
            width={cover.width ?? 640}
            height={cover.height ?? 214}
            className="aspect-[3/1] max-h-64 w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="aspect-[3/1] max-h-64 w-full bg-secondary" aria-hidden="true" />
        )}
        {/* Dark fade: text legibility over any cover */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              {card.icon && (
                <svg
                  viewBox="0 0 24 24"
                  width={18}
                  height={18}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 text-white/90"
                  dangerouslySetInnerHTML={{ __html: card.icon }}
                />
              )}
              <span className="truncate font-display text-xl font-semibold text-white">
                {card.name}
              </span>
              <span className="shrink-0 rounded bg-primary/90 px-1.5 py-px text-xs leading-4 text-primary-foreground">
                {card.typeLabel}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular-nums text-white/85">
              {card.countText}
            </span>
          </div>
          {card.description !== '' && (
            <p className="line-clamp-2 text-sm leading-5 text-white/80">{card.description}</p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Card className="group gap-0 overflow-hidden rounded-md py-0 transition-colors hover:border-body-muted">
      {href ? (
        <a href={href} className="block">
          {body}
        </a>
      ) : (
        body
      )}
    </Card>
  );
}

export interface CategoryCardsProps {
  cards: CategoryCardData[];
  defaultCover: CategoryCardImage | null;
}

/** /categories/ hub grid: one row of three on desktop. */
export default function CategoryCards({ cards, defaultCover }: CategoryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <CategoryCard
          key={`${card.type}-${card.slug}`}
          card={card}
          defaultCover={defaultCover}
          href={`/categories/${card.slug}/`}
        />
      ))}
    </div>
  );
}
