import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Code, Quote,
  Heading1, Heading2, Heading3, ListChecks, Image as ImgIcon, Link2,
} from 'lucide-react'

type Props = {
  value: string
  onChange: (next: string) => void
}

/** A Tiptap-backed block editor. `value` and `onChange` carry the doc as
 *  serialized JSON so the SQLite layer stays format-agnostic. */
export const BlockEditor: React.FC<Props> = ({ value, onChange }) => {
  let initial: any = { type: 'doc', content: [{ type: 'paragraph' }] }
  try {
    if (value) initial = JSON.parse(value)
  } catch (_) {
    initial = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initial,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()))
    },
    editorProps: {
      attributes: {
        class: 'pt-prose outline-none min-h-[400px] py-4',
      },
    },
  })

  // Keep external value changes in sync when switching between notes.
  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    if (current !== value) {
      try { editor.commands.setContent(JSON.parse(value || '{}')) } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!editor) return null

  const Btn: React.FC<{ on?: boolean; onClick: () => void; title?: string; children: React.ReactNode }> = ({ on, onClick, title, children }) => (
    <button
      onClick={onClick}
      title={title}
      className={[
        'w-7 h-7 flex items-center justify-center border transition-colors',
        on ? 'border-accent text-accent bg-surface' : 'border-edge text-text-mid hover:text-text-hi hover:border-text-lo',
      ].join(' ')}
    >
      {children}
    </button>
  )

  return (
    <div>
      <div className="flex items-center gap-1 flex-wrap pb-3 border-b border-edge">
        <Btn on={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 size={13} /></Btn>
        <Btn on={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 size={13} /></Btn>
        <Btn on={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 size={13} /></Btn>
        <div className="w-px h-5 bg-edge mx-1" />
        <Btn on={editor.isActive('bold')}          onClick={() => editor.chain().focus().toggleBold().run()}          title="Bold"><Bold size={13} /></Btn>
        <Btn on={editor.isActive('italic')}        onClick={() => editor.chain().focus().toggleItalic().run()}        title="Italic"><Italic size={13} /></Btn>
        <Btn on={editor.isActive('strike')}        onClick={() => editor.chain().focus().toggleStrike().run()}        title="Strike"><Strikethrough size={13} /></Btn>
        <Btn on={editor.isActive('code')}          onClick={() => editor.chain().focus().toggleCode().run()}          title="Inline code"><Code size={13} /></Btn>
        <div className="w-px h-5 bg-edge mx-1" />
        <Btn on={editor.isActive('bulletList')}    onClick={() => editor.chain().focus().toggleBulletList().run()}    title="Bullet list"><List size={13} /></Btn>
        <Btn on={editor.isActive('orderedList')}   onClick={() => editor.chain().focus().toggleOrderedList().run()}   title="Ordered list"><ListOrdered size={13} /></Btn>
        <Btn on={editor.isActive('taskList')}      onClick={() => editor.chain().focus().toggleTaskList().run()}      title="Task list"><ListChecks size={13} /></Btn>
        <Btn on={editor.isActive('blockquote')}    onClick={() => editor.chain().focus().toggleBlockquote().run()}    title="Quote"><Quote size={13} /></Btn>
        <div className="w-px h-5 bg-edge mx-1" />
        <Btn
          onClick={() => {
            const url = prompt('Image URL')
            if (url) editor.chain().focus().setImage({ src: url }).run()
          }}
          title="Image"
        ><ImgIcon size={13} /></Btn>
        <Btn
          onClick={() => {
            const url = prompt('Link URL')
            if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }}
          title="Link"
        ><Link2 size={13} /></Btn>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

export default BlockEditor
