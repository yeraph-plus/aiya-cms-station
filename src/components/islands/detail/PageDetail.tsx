import {
  ActionRow,
  ArticleBody,
  SimpleHeader,
  CommentsBlock,
  useViewPing,
} from '@/components/islands/detail/parts';
import { Card, CardContent } from '@/components/ui/card';
import type { CommentsWindow, DetailShellProps } from '@/components/islands/detail/PostDetail';

/**
 * Independent-page detail shell: the only full-width layout — no sidebar,
 * no adjacency, no rating; page carries just the body, the like/favorite
 * row and its comment section.
 */
export default function PageDetail({
  post,
  comments,
  commentsPagination,
  settings,
  loggedIn,
  authorBio,
  isSelf,
  locale,
  window,
}: DetailShellProps & { window: CommentsWindow }) {
  useViewPing(post.id);
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
    </article>
  );
}
