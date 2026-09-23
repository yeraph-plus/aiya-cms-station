import {
  ActionRow,
  ArticleBody,
  SimpleHeader,
  CommentsBlock,
  DownloadSection,
  useViewPing,
} from '@/components/islands/detail/parts';
import { Card, CardContent } from '@/components/ui/card';
import type { CommentsWindow, DetailShellProps } from '@/components/islands/detail/PostDetail';
import type { FileList } from '@/lib/core/contracts';
import { t, type Locale } from '@/lib/i18n';

/**
 * Independent-page detail shell: the only full-width layout — no sidebar,
 * no adjacency, no rating; page carries just the body, the like/favorite
 * row, the download module and its comment section.
 */
export default function PageDetail({
  post,
  comments,
  commentsPagination,
  downloads,
  settings,
  loggedIn,
  locale,
  timezone,
  window,
}: DetailShellProps & { downloads: FileList[] | null; window: CommentsWindow }) {
  useViewPing(post.id);
  const copy = t(locale);
  return (
    <article>
      <Card className="gap-0 overflow-hidden py-0">
        <SimpleHeader
          post={post}
          locale={locale}
          basePath="/pages/"
          actions={<ActionRow post={post} locale={locale} variant="page" loggedIn={loggedIn} />}
        />
        <CardContent className="px-6 py-6">
          <ArticleBody post={post} locale={locale} />
          <DownloadSection lists={downloads} postId={post.id} loggedIn={loggedIn} locale={locale} />
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
        window={window}
      />
    </article>
  );
}
