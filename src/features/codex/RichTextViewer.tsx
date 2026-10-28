import { EditorContent, useEditor } from '@tiptap/react'
import { codexExtensions } from './richText'

// Read-only article text. The stored HTML is never inserted directly: it is
// re-parsed through the allowed formatting list, so only safe elements render.
// entryIds: the articles the reader can open; other article links become plain text.
export function RichTextViewer({ html, entryIds }: { html: string; entryIds: Set<string> }) {
  const editor = useEditor(
    { extensions: codexExtensions({ exists: (id) => entryIds.has(id), reading: true }), content: html, editable: false },
    [html, entryIds],
  )
  return <EditorContent editor={editor} className="codex-prose" />
}
