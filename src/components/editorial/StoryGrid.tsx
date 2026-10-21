import { cn } from '@/lib/utils';
import { StoryCard } from './StoryCard';
import type { EditorialStory } from './types';

export interface StoryGridProps {
  stories: EditorialStory[];
  /** The first card takes two columns (avision's 555px "largest" tile). */
  featured?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * The masonry replacement (docs/EDITORIAL.md §5): avision floated 263/555px
 * boxes into a jQuery masonry grid; this is a CSS grid with one span, so the
 * rhythm survives reflow and no measurement JS is loaded.
 */
export function StoryGrid({ stories, featured = false, columns = 3, className }: StoryGridProps) {
  return (
    <div
      className={cn(
        'grid content-start gap-5',
        columns === 4
          ? 'sm:grid-cols-2 lg:grid-cols-4'
          : columns === 3
            ? 'sm:grid-cols-2 lg:grid-cols-3'
            : 'sm:grid-cols-2',
        className,
      )}
    >
      {stories.map((story, index) => {
        const lead = featured && index === 0;
        return (
          <StoryCard
            key={story.id ?? story.href}
            story={story}
            variant={story.variant ?? (lead ? 'lead' : story.image ? 'portrait' : 'text')}
            className={cn(lead && 'sm:col-span-2')}
            eager={index === 0}
          />
        );
      })}
    </div>
  );
}
