/**
 * The article body's container recipe (DESIGN.md §2 正文节奏两档): Tailwind
 * Typography supplies the text semantics, `shell.css`'s `.prose-content`
 * section supplies every vertical gap. It is one constant because the body has
 * more than one entry point — the normal render and the in-place unlock — and
 * a second, hand-rolled copy of this string is exactly how the unlocked body
 * ended up with no typography at all (no heading scale, no list markers, no
 * paragraph gaps).
 */
export const PROSE_CLASS =
  'prose prose-neutral dark:prose-invert prose-content max-w-none prose-headings:font-semibold prose-p:leading-[1.9] prose-p:text-justify prose-li:leading-[1.85] prose-a:text-primary prose-code:before:content-none prose-code:after:content-none';
