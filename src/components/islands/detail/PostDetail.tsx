import {
  ActionRow,
  ArticleBody,
  ArticleHeader,
  AuthorCard,
  CommentsBlock,
  PrevNextNav,
  RelatedList,
  useViewPing,
} from '@/components/islands/detail/parts';
import { Card, CardContent } from '@/components/ui/card';
import type { Comment, PostDetail, PostSummary, SiteComments } from '@/lib/core/contracts';
import type { Locale } from '@/lib/i18n';

export interface CommentsWindow {
  order: 'asc' | 'desc';
  perPage: number;
}

interface Pagination {
  page: number;
  totalPages: number;
  hasNext: boolean;
}

export interface DetailShellProps {
  post: PostDetail;
  comments: Comment[];
  commentsPagination: Pagination;
  settings: SiteComments;
  loggedIn: boolean;
  /** Author bio from the profile read; '' when the author is degenerate. */
  authorBio: string;
  /** Viewer is the author — the sidebar follow button disables. */
  isSelf: boolean;
  locale: Locale;
}

/** Post detail shell: two columns — the article left, author + related right. */
export default function PostDetail({
  post,
  comments,
  commentsPagination,
  related,
  settings,
  loggedIn,
  authorBio,
  isSelf,
  locale,
  window,
}: DetailShellProps & { related: PostSummary[]; window: CommentsWindow }) {
  useViewPing(post.id);
  return (
    <article className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8">
      <div className="min-w-0">
        <Card className="gap-0 overflow-hidden py-0">
          <ArticleHeader
            post={post}
            locale={locale}
            basePath="/posts/"
            actions={<ActionRow post={post} locale={locale} variant="post" loggedIn={loggedIn} />}
          />
          <CardContent className="px-6 py-6">
            <ArticleBody post={post} locale={locale} />
          </CardContent>
        </Card>
        <PrevNextNav post={post} locale={locale} />
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
        <RelatedList related={related} locale={locale} />
      </aside>
    </article>
  );
}
