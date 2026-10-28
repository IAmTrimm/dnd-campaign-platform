import StarterKit from '@tiptap/starter-kit'

// The formatting allowed in Codex articles. The editor and the article viewer
// share this list, and anything outside it (scripts, event handlers, images,
// unknown tags, web links) is dropped whenever stored text is loaded, so
// article text can never inject code into the page.
export const codexExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: false, // links between articles come in B014
    code: false,
    codeBlock: false,
  }),
]
