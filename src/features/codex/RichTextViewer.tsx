import { EditorContent, useEditor } from '@tiptap/react'
import { codexExtensions } from './richText'

// Read-only article text. The stored HTML is never inserted directly: it is
// re-parsed through the allowed formatting list, so only safe elements render.
export function RichTextViewer({ html }: { html: string }) {
  const editor = useEditor({ extensions: codexExtensions, content: html, editable: false }, [html])
  return <EditorContent editor={editor} className="codex-prose" />
}
