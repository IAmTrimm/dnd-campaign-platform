import { Mark } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const ENTRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CodexLinkOptions = {
  // Is the linked article one the reader can open?
  exists: (entryId: string) => boolean
  // Reading (real links) or editing (links kept, but not followed).
  reading: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    codexLink: {
      setCodexLink: (entryId: string) => ReturnType
      unsetCodexLink: () => ReturnType
    }
  }
}

// A phrase linked to another Codex article. Only the article's permanent id is
// stored (as data-codex-id); the address is always rebuilt from that id, so a
// stored link can never point outside the Codex or run code, and renaming the
// article doesn't break it. Links to articles the reader can't open (hidden,
// or deleted) are shown as plain text.
const CodexLink = Mark.create<CodexLinkOptions>({
  name: 'codexLink',
  inclusive: false,
  addOptions: () => ({ exists: () => false, reading: true }),
  addAttributes: () => ({
    entryId: { default: null, parseHTML: (el) => el.getAttribute('data-codex-id'), renderHTML: () => ({}) },
  }),
  parseHTML: () => [{ tag: 'a[data-codex-id]', getAttrs: (el) => (ENTRY_ID.test(el.getAttribute('data-codex-id') ?? '') ? null : false) }],
  renderHTML({ mark }) {
    const id = String(mark.attrs.entryId)
    if (this.options.reading) {
      return this.options.exists(id) ? ['a', { href: `#/codex/${id}`, class: 'codex-link' }, 0] : ['span', {}, 0]
    }
    return ['a', { 'data-codex-id': id, class: this.options.exists(id) ? 'codex-link' : 'codex-link codex-link-missing' }, 0]
  },
  addCommands() {
    return {
      setCodexLink:
        (entryId) =>
        ({ chain }) =>
          chain().extendMarkRange(this.name).setMark(this.name, { entryId }).run(),
      unsetCodexLink:
        () =>
        ({ chain }) =>
          chain().extendMarkRange(this.name).unsetMark(this.name).run(),
    }
  },
})

// The formatting allowed in Codex articles. The editor and the article viewer
// share this list, and anything outside it (scripts, event handlers, images,
// unknown tags, web links) is dropped whenever stored text is loaded, so
// article text can never inject code into the page.
export function codexExtensions(links: CodexLinkOptions) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: false, // no web links: only links to other Codex articles (below)
      code: false,
      codeBlock: false,
    }),
    CodexLink.configure(links),
  ]
}
