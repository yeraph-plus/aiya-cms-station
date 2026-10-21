/**
 * Editorial skin — avision's magazine language rebuilt on the site's tokens,
 * utilities and card recipes (docs/EDITORIAL.md). Import from here so call
 * sites depend on one barrel, e.g.
 *
 *   import { SectionHeader, StoryGrid, SpotlightHero } from '@/components/editorial';
 */
export { ArrowLink, Kicker, MetaLine, PillButton, PillLink } from './bits';
export { ArchiveHero } from './ArchiveHero';
export { ArticleHero, BylinePanel, type ShareTarget } from './ArticleHeader';
export { NewsletterBand } from './NewsletterBand';
export { PromoCard } from './PromoCard';
export { EventItem, Rail, RailItem, RailSection, type RailSectionAction } from './RailPanel';
export { SectionHeader, type SectionMoreItem, type SectionTag } from './SectionHeader';
export { SpotlightHero, type SpotlightSlide } from './SpotlightHero';
export { StoryCard } from './StoryCard';
export { StoryGrid } from './StoryGrid';
export { TagList, type TagItem } from './TagList';
export { VideoWall, type VideoItem } from './VideoWall';
export type { EditorialImage, EditorialStory, StoryCardVariant } from './types';
