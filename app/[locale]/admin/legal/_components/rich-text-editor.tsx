'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const CONTENT_CLASS =
  'min-h-[260px] max-h-[520px] overflow-y-auto px-4 py-3 focus:outline-none ' +
  'text-[14px] leading-[1.7] text-[#2E286C]/90 ' +
  '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-[#2E286C] ' +
  '[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:text-[#2E286C] ' +
  '[&_p]:my-2.5 ' +
  '[&_a]:text-[#533089] [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_ul]:my-2.5 [&_ul]:pl-6 [&_ul]:list-disc [&_ol]:my-2.5 [&_ol]:pl-6 [&_ol]:list-decimal [&_li]:my-1 ' +
  '[&_img]:my-3 [&_img]:rounded-lg [&_img]:max-w-full [&_img]:h-auto [&_img]:border [&_img]:border-black/5 ' +
  '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[#533089]/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#2E286C]/60 ' +
  '[&_strong]:font-bold [&_strong]:text-[#2E286C]';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
};

function ToolButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-[#533089] text-white'
          : 'text-[#2E286C]/70 hover:bg-[#533089]/10 hover:text-[#533089]'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px self-center bg-black/10" />;
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel,
}: RichTextEditorProps) {
  const t = useTranslations('admin.legal.editor');
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: CONTENT_CLASS,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel ?? '',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  if (!editor) {
    return (
      <div className="min-h-[320px] rounded-xl border border-black/10 bg-white" />
    );
  }

  const promptLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('linkPrompt'), previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url.trim() })
      .run();
  };

  const promptImage = () => {
    const url = window.prompt(t('imagePrompt'));
    if (url && url.trim() !== '') {
      editor.chain().focus().setImage({ src: url.trim() }).run();
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white focus-within:border-[#533089]/40 focus-within:ring-2 focus-within:ring-[#533089]/10">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-black/10 bg-[#FAFAFC] px-2 py-1.5">
        <ToolButton
          title={t('bold')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={t('italic')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={t('underline')}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <ToolButton
          title={t('heading')}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={t('subheading')}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={t('bulletList')}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={t('orderedList')}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={t('blockquote')}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <ToolButton
          title={t('link')}
          active={editor.isActive('link')}
          onClick={promptLink}
        >
          <Link2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton title={t('image')} onClick={promptImage}>
          <ImageIcon className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <ToolButton
          title={t('undo')}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={t('redo')}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
