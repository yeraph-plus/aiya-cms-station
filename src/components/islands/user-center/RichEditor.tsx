import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  QuoteIcon,
  BoldIcon,
  EyeOffIcon,
  ImagePlusIcon,
  ItalicIcon,
  LoaderCircleIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';
import { EditorContent } from '@tiptap/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Mark, mergeAttributes } from '@tiptap/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SmiliesPicker from '@/components/islands/user-center/SmiliesPicker';
import { cn } from '@/lib/utils';

/**
 * Spoiler mark: renders as <span data-spoiler>…</span> — styled black-on-
 * black by the global stylesheet, revealed on hover/focus. Registered as a
 * plain mark so the core `toggleMark('spoiler')` command suffices.
 */
export const SpoilerMark = Mark.create({
  name: 'spoiler',
  keepOnSplit: false,
  parseHTML() {
    return [{ tag: 'span[data-spoiler]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-spoiler': 'true' }), 0];
  },
});

export interface RichEditorProps {
  /** Initial HTML; pass a new value via `key` to reset externally. */
  initialHtml?: string;
  placeholder?: string;
  /** Controlled change callback (full HTML). */
  onChange?: (html: string) => void;
  /**
   * When provided, shows the image button; called with the picked file.
   * The editor never inserts inline images itself — uploads surface as the
   * read-only attachment strip managed by the parent (see PostEditorBlock).
   */
  onImageFile?: (file: File) => void;
  /** Toolbar labels. `smile` additionally enables the smilies picker. */
  labels: {
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    quote: string;
    spoiler: string;
    image: string;
    smile?: string;
  };
  className?: string;
}

const TOOL_BTN =
  'size-7 text-muted-foreground hover:text-foreground data-[active=true]:text-primary data-[active=true]:bg-secondary';

/**
 * Shared rich-text editor (Tiptap) for the community composer and the
 * thread edit form: bold / italic / underline / strike / blockquote /
 * spoiler marks, optional image insertion, placeholder support. The
 * toolbar is part of the component so both call sites render identically.
 */
export default function RichEditor({
  initialHtml = '',
  placeholder,
  onChange,
  onImageFile,
  labels,
  className = '',
}: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SSR-safe: Tiptap needs `window`, so the instance is created in a
  // client-side effect; the server renders the placeholder box.
  const [editor, setEditor] = useState<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const instance = new Editor({
      extensions: [
        StarterKit.configure({ heading: false }),
        Underline,
        SpoilerMark,
        Image.configure({ inline: false, allowBase64: false }),
        Placeholder.configure({ placeholder }),
      ],
      content: initialHtml,
      editorProps: {
        attributes: {
          class: 'prose-community min-h-[72px] px-3 py-2.5 outline-none',
        },
      },
      onUpdate: ({ editor: current }) => onChangeRef.current?.(current.getHTML()),
    });
    setEditor(instance);
    return () => instance.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the parent's draft in sync when the initial content is replaced
  // externally (edit form reopening with different thread content).
  useEffect(() => {
    if (!editor) return;
    if (initialHtml !== editor.getHTML()) {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml]);

  const tool = (
    action: (editor: Editor) => void,
    active: boolean,
    label: string,
    icon: ReactNode,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={TOOL_BTN}
      data-active={active}
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        if (editor) action(editor);
      }}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </Button>
  );

  return (
    <div className={cn('rounded-lg border border-border', className)}>
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="min-h-[72px] px-3 py-2.5" aria-hidden="true" />
      )}
      <div className="flex items-center gap-0.5 border-t border-border px-1.5 py-1">
        {labels.smile && editor && (
          <SmiliesPicker
            label={labels.smile}
            onPick={(code) => editor.chain().focus().insertContent(code).run()}
          />
        )}
        {editor &&
          tool(
            (e) => e.chain().focus().toggleBold().run(),
            editor.isActive('bold'),
            labels.bold,
            <BoldIcon aria-hidden="true" />,
          )}
        {editor &&
          tool(
            (e) => e.chain().focus().toggleItalic().run(),
            editor.isActive('italic'),
            labels.italic,
            <ItalicIcon aria-hidden="true" />,
          )}
        {editor &&
          tool(
            (e) => e.chain().focus().toggleUnderline().run(),
            editor.isActive('underline'),
            labels.underline,
            <UnderlineIcon aria-hidden="true" />,
          )}
        {editor &&
          tool(
            (e) => e.chain().focus().toggleStrike().run(),
            editor.isActive('strike'),
            labels.strike,
            <StrikethroughIcon aria-hidden="true" />,
          )}
        {editor &&
          tool(
            (e) => e.chain().focus().toggleBlockquote().run(),
            editor.isActive('blockquote'),
            labels.quote,
            <QuoteIcon aria-hidden="true" />,
          )}
        {editor &&
          tool(
            (e) => e.chain().focus().toggleMark('spoiler').run(),
            editor.isActive('spoiler'),
            labels.spoiler,
            <EyeOffIcon aria-hidden="true" />,
          )}
        {onImageFile &&
          tool(
            () => fileInputRef.current?.click(),
            false,
            labels.image,
            <ImagePlusIcon aria-hidden="true" />,
          )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onImageFile?.(file);
          }}
        />
      </div>
    </div>
  );
}

/** Current HTML of an editor instance (empty-guard included). */
export function editorHtml(editor: Editor | null): string {
  if (!editor) return '';
  return editor.isEmpty ? '' : editor.getHTML();
}

export interface PostEditorBlockProps {
  /** `composer` = feed-top publisher; `edit` = inline thread edit form.
   *  Only the title placeholder copy differs between the two modes. */
  mode: 'composer' | 'edit';
  title: string;
  onTitleChange: (value: string) => void;
  initialHtml: string;
  onHtmlChange: (html: string) => void;
  labels: RichEditorProps['labels'] & { title: string; titleOptional: string };
  bodyPlaceholder?: string;
  onImageFile?: (file: File) => void;
  /** Uploaded attachment srcs, rendered as a read-only strip in the block. */
  images?: string[];
  onRemoveImage?: (index: number) => void;
  /** True while an upload is in flight (spinner tile in the strip). */
  uploading?: boolean;
  /** Bump to remount the editor empty (composer publish reset). */
  editorKey?: number;
}

/**
 * One shared title+body editor block for the community composer and the
 * thread edit form: identical chrome (bordered block, divided title row,
 * toolbar, attachment strip) so both call sites can never drift. Uploaded
 * images never enter the editable document — they live in the strip and the
 * caller merges them into the saved content.
 */
export function PostEditorBlock({
  mode,
  title,
  onTitleChange,
  initialHtml,
  onHtmlChange,
  labels,
  bodyPlaceholder,
  onImageFile,
  images,
  onRemoveImage,
  uploading,
  editorKey,
}: PostEditorBlockProps) {
  const strip = images ?? [];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Input
        value={title}
        maxLength={191}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder={
          mode === 'composer' ? `${labels.title}（${labels.titleOptional}）` : labels.title
        }
        aria-label={labels.title}
        className="rounded-none border-0 border-b px-3 text-sm shadow-none focus-visible:ring-0 focus-visible:border-border"
      />
      <RichEditor
        key={editorKey}
        initialHtml={initialHtml}
        onChange={onHtmlChange}
        placeholder={bodyPlaceholder}
        onImageFile={onImageFile}
        labels={labels}
        className="rounded-none border-0"
      />
      {(strip.length > 0 || uploading) && (
        <div className="px-3 pb-3">
          <AttachmentStrip images={strip} onRemove={onRemoveImage} uploading={uploading} />
        </div>
      )}
    </div>
  );
}

/** Read-only strip of uploaded attachment thumbnails (with per-tile remove
 *  buttons and a spinner tile while an upload is in flight). Shared by the
 *  editor blocks so upload chrome never drifts between surfaces. */
export function AttachmentStrip({
  images,
  onRemove,
  uploading,
}: {
  images: string[];
  onRemove?: (index: number) => void;
  uploading?: boolean;
}) {
  if (images.length === 0 && !uploading) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {images.map((src, index) => (
        <div
          key={src + index}
          className="relative size-16 overflow-hidden rounded-md border border-border"
        >
          <img src={src} alt="" className="size-full object-cover" />
          {onRemove && (
            <button
              type="button"
              aria-label="×"
              onClick={() => onRemove(index)}
              className="absolute right-0.5 top-0.5 flex size-4.5 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white hover:bg-black/80"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {uploading && (
        <div className="flex size-16 items-center justify-center rounded-md border border-dashed border-border bg-secondary">
          <LoaderCircleIcon className="size-4 animate-spin text-body-muted" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
