import type { Editor } from '@tiptap/react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { LucideIcon } from 'lucide-react'
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
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
import { useState } from 'react'
import { EntryPicker } from './EntryPicker'
import { codexExtensions } from './richText'
import type { CodexListItem } from './types'

// Lets the writer link phrases to other Codex articles.
export type ArticleLinking = {
  targets: CodexListItem[] // articles that can be linked to
  entryIds: Set<string> // every article the writer can open
  describe: (entry: CodexListItem) => string
}

type RichTextEditorProps = {
  initialHtml: string
  // Called with the article HTML, or null when the editor is empty.
  onChange: (html: string | null) => void
  labelledBy: string
  linking?: ArticleLinking
}

export function RichTextEditor({ initialHtml, onChange, labelledBy, linking }: RichTextEditorProps) {
  // The editor is created once; the article list doesn't change while editing.
  const [entryIds] = useState(linking?.entryIds)
  const [picking, setPicking] = useState(false)
  const editor = useEditor({
    extensions: codexExtensions({ exists: (id) => !!entryIds?.has(id), reading: false }),
    content: initialHtml,
    editorProps: {
      attributes: { 'aria-labelledby': labelledBy, 'aria-multiline': 'true', role: 'textbox' },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? null : editor.getHTML()),
  })

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-charcoal/70 transition-colors focus-within:border-gold/60">
      {editor && <Toolbar editor={editor} canLink={!!linking} onLink={() => setPicking(true)} />}
      {editor && linking && picking && <LinkBar editor={editor} linking={linking} onClose={() => setPicking(false)} />}
      <EditorContent editor={editor} className="codex-prose codex-editor px-4 py-3" />
    </div>
  )
}

// Choose the article to link the selected text to.
function LinkBar({ editor, linking, onClose }: { editor: Editor; linking: ArticleLinking; onClose: () => void }) {
  const close = () => {
    onClose()
    editor.commands.focus()
  }
  const linked = editor.isActive('codexLink')
  return (
    <div className="space-y-2 border-b border-line bg-charcoal/90 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-ash">{linked ? 'Change which article this text links to' : 'Link the selected text to a Codex article'}</p>
        {linked && (
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetCodexLink().run()
              onClose()
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ash hover:bg-white/[0.06] hover:text-bone"
          >
            <Link2Off className="size-3.5" />
            Remove link
          </button>
        )}
        <button type="button" onClick={close} className="rounded-md px-2 py-1 text-xs text-ash hover:bg-white/[0.06] hover:text-bone">
          Cancel
        </button>
      </div>
      <EntryPicker
        entries={linking.targets}
        describe={linking.describe}
        label="Search for the article to link to"
        autoFocus
        onEscape={close}
        onSelect={(entry) => {
          editor.chain().focus().setCodexLink(entry.id).run()
          onClose()
        }}
      />
    </div>
  )
}

function Toolbar({ editor, canLink, onLink }: { editor: Editor; canLink: boolean; onLink: () => void }) {
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
      link: editor.isActive('codexLink'),
      hasSelection: !editor.state.selection.empty,
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
    ...(canLink
      ? [
          [
            {
              label: state.link ? 'Change article link' : state.hasSelection ? 'Link to a Codex article' : 'Link to a Codex article (select some text first)',
              icon: Link2,
              active: state.link,
              disabled: !state.link && !state.hasSelection,
              run: onLink,
            },
          ],
        ]
      : []),
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
