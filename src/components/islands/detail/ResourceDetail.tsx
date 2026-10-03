import {
  ActionRow,
  ArticleBody,
  SimpleHeader,
  DownloadSection,
  AuthorCard,
  CommentsBlock,
  RelatedList,
  useViewPing,
} from '@/components/islands/detail/parts';
import PostDiscussions from '@/components/islands/detail/PostDiscussions';
import { Card, CardContent } from '@/components/ui/card';
import type { CommentsWindow, DetailShellProps } from '@/components/islands/detail/PostDetail';
import type { FileList, PostSummary } from '@/lib/core/contracts';
import type { FeedThread } from '@/lib/community';
import { t, type Locale } from '@/lib/i18n';

const TAG_VOCAB_LABELS = (locale: Locale): Record<string, string> => {
  const copy = t(locale).resources;
  return {
    resource_original: copy.vocabOriginal,
    resource_character: copy.vocabCharacter,
    resource_author: copy.vocabAuthor,
    resource_content: copy.vocabContent,
    resource_other: copy.vocabOther,
  };
};

/**
 * Resource detail shell: two columns like posts, with the download module
 * in the article column under the body (it outgrew the 280px sidebar) and
 * the rating row replacing like (the counter matrix scopes like to
 * post/page). The sidebar keeps author + related.
 */
export default function ResourceDetail({
  post,
  comments,
  commentsPagination,
  related,
  downloads,
  threads,
  threadsTotal,
  boards,
  settings,
  loggedIn,
  authorBio,
  isSelf,
  locale,
  timezone,
  termIcons,
  commentsWindow,
}: DetailShellProps & {
  related: PostSummary[];
  downloads: FileList[] | null;
  /** Community threads bound to this resource (the sidebar feedback part). */
  threads: FeedThread[];
  threadsTotal: number;
  boards: { slug: string; name: string }[];
  commentsWindow: CommentsWindow;
}) {
  useViewPing(post.id);
  const copy = t(locale);
  return (
    <article className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8">
      <div className="min-w-0">
        <Card className="overflow-hidden">
          <SimpleHeader
            post={post}
            locale={locale}
            basePath="/resources/"
            tagVocabLabels={TAG_VOCAB_LABELS(locale)}
            termIcons={termIcons}
            actions={
              <ActionRow post={post} locale={locale} variant="resource" loggedIn={loggedIn} />
            }
          />
          <CardContent className="px-6 py-6">
            <ArticleBody post={post} locale={locale} />
            {/* The download module lives inside the article card, under the
                body — no section heading of its own, each group's caption is
                the heading. Failed groups never reach the public payload, so
                an empty lists array means nothing to show. */}
            <DownloadSection
              lists={downloads}
              postId={post.id}
              loggedIn={loggedIn}
              locale={locale}
              timezone={timezone}
            />
          </CardContent>
        </Card>
        <CommentsBlock
          post={post}
          comments={comments}
          commentsPagination={commentsPagination}
          settings={settings}
          loggedIn={loggedIn}
          locale={locale}
          timezone={timezone}
          commentsWindow={commentsWindow}
        />
      </div>
      <aside className="mt-10 flex flex-col gap-5 lg:mt-0">
        <AuthorCard post={post} bio={authorBio} isSelf={isSelf} locale={locale} />
        <RelatedList
          related={related}
          locale={locale}
          timezone={timezone}
          heading={copy.resources.related}
          emptyText={copy.resources.relatedEmpty}
        />
        <PostDiscussions
          postId={post.id}
          initialThreads={threads}
          initialTotal={threadsTotal}
          boards={boards}
          canPost={loggedIn}
          locale={locale}
          timezone={timezone}
        />
      </aside>
    </article>
  );
}
