/**
 * Demo data for the editorial skin reference. Everything here is plain,
 * pre-localized and pre-formatted — exactly the shape the components expect
 * from a real call site (docs/EDITORIAL.md §3).
 */
import type { EditorialStory, SpotlightSlide, VideoItem } from '@/components/editorial';

const img = (file: string, alt = '') => ({ url: `/assets/${file}`, alt });

const byline = { author: 'Katy Liu', authorHref: '#', date: '2017年9月29日 09:48' };

export const once = (file: string, title: string, extra: Partial<EditorialStory> = {}) =>
  ({
    href: '#',
    title,
    image: img(file),
    ...byline,
    ...extra,
  }) satisfies EditorialStory;

export const slides: SpotlightSlide[] = [
  {
    id: 's1',
    href: '#',
    kicker: 'sport',
    kickerHref: '#',
    title: '梵高躁动的头脑，如何描绘物理学中最复杂的概念之一？',
    image: img('hero-1.jpg'),
  },
  {
    id: 's2',
    href: '#',
    kicker: 'vogue',
    kickerHref: '#',
    title: '她把晨雾穿在身上：一场关于灰度与质地的实验',
    image: img('hero-2.jpg'),
  },
  {
    id: 's3',
    href: '#',
    kicker: 'travel',
    kickerHref: '#',
    title: '从乌得勒支到阿勒泰：一条没有坐标的公路',
    image: img('hero-3.jpg'),
  },
];

export const quickLinks: EditorialStory[] = [
  { href: '#', title: '本周精选：五件值得放进书架的东西' },
  { href: '#', title: '一间只卖黑色的书店，开了十二年' },
  { href: '#', title: '当城市开始把路灯调暗' },
];

export const dontMiss: EditorialStory[] = [
  once('story-1.jpg', '梵高躁动的头脑，如何描绘物理学中最复杂的概念之一？', {
    excerpt:
      '挑那只像日落一样的黄桃，红色、橙色与粉色的皮，用牙齿剥开。把味觉折进未成熟的夏天，再回到那一页稿纸。',
    category: 'style hunter',
    categoryHref: '#',
  }),
  once('story-2.jpg', '用一张照片，记住整个八月的湿度'),
  { href: '#', title: '如何在没有海的城市里，练习一场远航', ...byline, variant: 'text' },
  once('story-3.jpg', '打字机、旧胶片与第三种沉默'),
  once('story-4.jpg', '山脊线以下的十二公里'),
  { href: '#', title: '编辑部手记：我们为什么还在做长文章', ...byline, variant: 'text' },
];

export const trending: EditorialStory[] = [
  once('cover-1.jpg', '在美术馆的第三个展厅，时间被重新调慢', {
    variant: 'cover',
    category: 'art',
    categoryHref: '#',
  }),
  once('story-5.jpg', '给未来的自己留一页空白', {
    excerpt: '有些版面需要留白，才能装下后来发生的事。',
  }),
  once('cover-2.jpg', '夜班司机的歌单，一共二十六首', { variant: 'cover', category: 'music' }),
  once('story-6.jpg', '所谓风格，是重复了足够多次的选择'),
  { href: '#', title: '关于“慢”，我们还能说什么', ...byline, variant: 'text' },
];

export const latest: EditorialStory[] = [
  once('story-3.jpg', '一把椅子的四十年'),
  once('story-1.jpg', '在雨里读完的那本书'),
  once('story-2.jpg', '午夜面包房的第七炉'),
  once('story-4.jpg', '旧楼梯间的回声'),
  once('cover-1.jpg', '海边的第二种蓝'),
  once('story-5.jpg', '手写时代的最后一批信封'),
  once('story-6.jpg', '把周末交给一条没有走完的街'),
  { href: '#', title: '短讯：一份关于纸张的观察', ...byline, variant: 'text' },
];

export const videos: VideoItem[] = [
  {
    id: 'v1',
    title: '梵高躁动的头脑：一段十二分钟的影像笔记',
    href: '#',
    meta: '120万次观看 · 9月29日',
    image: img('vid-1.jpg'),
  },
  {
    id: 'v2',
    title: '在阿姆斯特丹的雨季里冲洗胶片',
    href: '#',
    meta: '86万次观看 · 9月27日',
    image: img('vid-2.jpg'),
  },
  {
    id: 'v3',
    title: '一间只印黑色的印刷厂',
    href: '#',
    meta: '54万次观看 · 9月21日',
    image: img('vid-3.jpg'),
  },
  {
    id: 'v4',
    title: '夜航：从窗口看下去的三十个城市',
    href: '#',
    meta: '31万次观看 · 9月18日',
    image: img('vid-4.jpg'),
  },
];

export const railTop: EditorialStory[] = [
  once('rail-1.jpg', '梵高躁动的头脑，如何描绘物理学'),
  once('rail-2.jpg', '一间只卖黑色的书店'),
  once('rail-3.jpg', '把周末交给一条没有走完的街'),
  once('rail-4.jpg', '手写时代的最后一批信封'),
];

export const railVideos: EditorialStory[] = railTop.map((story, index) => ({
  ...story,
  image: img(`vid-${index + 1}.jpg`),
  variant: 'row-round',
}));

export const events = [
  { href: '#', title: '春季书市：旧书与手稿专场', day: '13', month: 'apr' },
  { href: '#', title: '夜谈：编辑部如何做一篇长报道', day: '27', month: 'apr' },
  { href: '#', title: '放映：《阿姆斯特丹的雨季》', day: '02', month: 'may' },
  { href: '#', title: '工作坊：从零开始做一本小杂志', day: '09', month: 'may' },
];

export const sectionTags = [
  { label: '全部', href: '#', active: true },
  { label: 'style hunter', href: '#' },
  { label: 'vogue', href: '#' },
  { label: '健康与健身', href: '#' },
  { label: '旅行', href: '#' },
];

export const moreMenu = {
  label: '更多',
  items: [
    { label: 'new look 2018', href: '#' },
    { label: 'street fashion', href: '#' },
    { label: 'business', href: '#' },
    { label: 'recipes', href: '#' },
    { label: 'sport', href: '#' },
    { label: 'celebrities', href: '#' },
  ],
};

/** category.html 的九张卡：图片卡 / 纯文本卡 / 背景图卡交替。 */
export const categoryStories: EditorialStory[] = [
  once('story-5.jpg', '梵高躁动的头脑，如何描绘物理学中最复杂的概念之一？', {
    variant: 'portrait',
  }),
  { href: '#', title: '如何在没有海的城市里，练习一场远航', ...byline, variant: 'text' },
  once('story-6.jpg', '打字机、旧胶片与第三种沉默', { variant: 'portrait' }),
  once('story-1.jpg', '山脊线以下的十二公里', { variant: 'portrait' }),
  once('cover-2.jpg', '在美术馆的第三个展厅，时间被重新调慢', {
    variant: 'cover',
    category: 'art',
  }),
  once('cover-1.jpg', '夜班司机的歌单，一共二十六首', { variant: 'cover', category: 'music' }),
  once('story-2.jpg', '用一张照片，记住整个八月的湿度', { variant: 'portrait' }),
  { href: '#', title: '编辑部手记：我们为什么还在做长文章', ...byline, variant: 'text' },
  { href: '#', title: '一份关于纸张的观察', ...byline, variant: 'text' },
];

export const article = once('hero-2.jpg', '梵高躁动的头脑，如何描绘物理学中最复杂的概念之一？', {
  category: 'sport',
  categoryHref: '#',
});

export const similarPosts: EditorialStory[] = [
  once('story-3.jpg', '一把椅子的四十年'),
  once('story-4.jpg', '旧楼梯间的回声'),
  once('story-2.jpg', '午夜面包房的第七炉'),
];

export const articleTags = [
  { label: 'Liberty', href: '#' },
  { label: 'Manual', href: '#' },
  { label: 'Interpretation', href: '#' },
  { label: 'Recommendation', href: '#' },
];

export const shareTargets = [
  { label: 'Facebook', href: '#' },
  { label: 'Twitter', href: '#' },
  { label: 'Google+', href: '#' },
];

export const comments = [
  {
    id: 'c1',
    author: 'Katy Liu',
    date: '2017年9月29日 09:48',
    body: '挑那只像落日一样的黄桃，红色、橙色与粉色的皮，用牙齿剥开。把味觉折进未成熟的夏天。',
    replies: [
      {
        id: 'c1-r1',
        author: 'Robert Morgan',
        date: '2017年9月29日 10:12',
        body: 'Nulla facilisi. Aenean porttitor quis tortor id tempus. Interdum et malesuada fames ac ante ipsum primis in faucibus.',
      },
    ],
  },
  {
    id: 'c2',
    author: 'Katy Liu',
    date: '2017年9月29日 11:02',
    body: '挑那只像落日一样的黄桃，红色、橙色与粉色的皮，用牙齿剥开。',
    replies: [],
  },
];

export const heroLabels = {
  region: '首页焦点图',
  slide: '幻灯片',
  next: '下一张',
  previous: '上一张',
  goTo: '跳转到',
  nextUp: '下一则',
};
