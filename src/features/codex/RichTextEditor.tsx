import type { Editor } from '@tiptap/react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { LucideIcon } from 'lucide-react'
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import { codexExtensions } from './richText'

type RichTextEditorProps = {
  initialHtml: string
  // Called with the article HTML, or null when the editor is empty.
  onChange: (html: string | null) => void
  labelledBy: string
}

export function RichTextEditor({ initialHtml, onChange, labelledBy }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: codexExtensions,
    content: initialHtml,
    editorProps: {
      attributes: { 'aria-labelledby': labelledBy, 'aria-multiline': 'true', role: 'textbox' },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? null : editor.getHTML()),
  })

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-charcoal/70 transition-colors focus-within:border-gold/60">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="codex-prose codex-editor px-4 py-3" />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render the toolbar only when the active formatting changes.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      paragraph: editor.isActive('paragraph'),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  })
  const chain = () => editor.chain().focus()

  const groups: { label: string; icon: LucideIcon; active?: boolean; disabled?: boolean; run: () => void }[][] = [
    [
      { label: 'Normal text', icon: Pilcrow, active: state.paragraph, run: () => chain().setParagraph().run() },
      { label: 'Heading', icon: Heading2, active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: 'Subheading', icon: Heading3, active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: 'Bold', icon: Bold, active: state.bold, run: () => chain().toggleBold().run() },
      { label: 'Italic', icon: Italic, active: state.italic, run: () => chain().toggleItalic().run() },
      { label: 'Underline', icon: Underline, active: state.underline, run: () => chain().toggleUnderline().run() },
      { label: 'Strikethrough', icon: Strikethrough, active: state.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { label: 'Bulleted list', icon: List, active: state.bulletList, run: () => chain().toggleBulletList().run() },
      { label: 'Numbered list', icon: ListOrdered, active: state.orderedList, run: () => chain().toggleOrderedList().run() },
      { label: 'Quote', icon: Quote, active: state.blockquote, run: () => chain().toggleBlockquote().run() },
      { label: 'Divider', icon: Minus, run: () => chain().setHorizontalRule().run() },
    ],
    [
      { label: 'Undo', icon: Undo2, disabled: !state.canUndo, run: () => chain().undo().run() },
      { label: 'Redo', icon: Redo2, disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ]

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-line bg-panel/80 px-2 py-1.5">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5 border-line pr-1 [&:not(:last-child)]:border-r">
          {group.map(({ label, icon: Icon, active, disabled, run }) => (
            <button
              key={label}
              type="button"
              // Keep the cursor in the text when a toolbar button is clicked.
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
              disabled={disabled}
              aria-label={label}
              aria-pressed={active === undefined ? undefined : active}
              title={label}
              className={`rounded-md p-1.5 transition-colors disabled:opacity-35 ${
                active ? 'bg-gold/15 text-gold' : 'text-ash hover:bg-white/[0.06] hover:text-bone'
              }`}
            >
              <Icon className="size-4" strokeWidth={2} />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
