import {
  ActionRow,
  ArticleBody,
  SimpleHeader,
  AttachmentPanel,
  AuthorCard,
  CommentsBlock,
  RelatedList,
  SidebarHeading,
  useViewPing,
} from '@/components/islands/detail/parts';
import { Card, CardContent } from '@/components/ui/card';
import type { CommentsWindow, DetailShellProps } from '@/components/islands/detail/PostDetail';
import type { AttachmentItem, PostSummary } from '@/lib/aiya/contracts';
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
 * Resource detail shell: two columns like posts, but the sidebar carries
 * the attachment panel (OpenList) instead of prev/next, and the rating
 * row replaces like (the counter matrix scopes like to post/page).
 */
export default function ResourceDetail({
  post,
  comments,
  commentsPagination,
  related,
  attachments,
  settings,
  loggedIn,
  authorBio,
  isSelf,
  locale,
  window,
}: DetailShellProps & {
  related: PostSummary[];
  attachments: AttachmentItem[] | null;
  window: CommentsWindow;
}) {
  useViewPing(post.id);
  const copy = t(locale);
  return (
    <article className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8">
      <div className="min-w-0">
        <Card className="gap-0 overflow-hidden py-0">
          <SimpleHeader
            post={post}
            locale={locale}
            basePath="/resources/"
            tagVocabLabels={TAG_VOCAB_LABELS(locale)}
            actions={<ActionRow post={post} locale={locale} variant="resource" loggedIn={loggedIn} />}
          />
          <CardContent className="px-6 py-6">
            <ArticleBody post={post} locale={locale} />
          </CardContent>
        </Card>
        <CommentsBlock
          post={post}
          comments={comments}
          commentsPagination={commentsPagination}
          settings={settings}
          loggedIn={loggedIn}
          locale={locale}
          window={window}
        />
      </div>
      <aside className="mt-10 flex flex-col gap-5 lg:mt-0">
        <AuthorCard post={post} bio={authorBio} isSelf={isSelf} locale={locale} />
        {attachments !== null && (
          <section>
            <SidebarHeading>{copy.resources.attachments}</SidebarHeading>
            <AttachmentPanel attachments={attachments} locale={locale} />
          </section>
        )}
        <RelatedList related={related} locale={locale} />
      </aside>
    </article>
  );
}
