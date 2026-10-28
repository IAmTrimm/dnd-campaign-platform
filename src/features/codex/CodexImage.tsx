import { ImageOff } from 'lucide-react'
import { imageShape, useCodexImage } from './codexImages'
import type { CodexCategory } from './types'

type CodexImageProps = { path: string; alt: string | null; name: string; category: CodexCategory }

// An article's main image, as shown on the article page.
export function CodexImage({ path, alt, name, category }: CodexImageProps) {
  const image = useCodexImage(path)
  const portrait = imageShape(category) === 'portrait'
  const frame = portrait
    ? 'mx-auto aspect-[4/5] w-48 shrink-0 @xl:mx-0 @3xl:w-56 rounded-xl border border-gold/25 shadow-xl shadow-black/40 ring-1 ring-black/40'
    : 'aspect-[21/9] w-full'

  return (
    <figure className={`relative overflow-hidden bg-charcoal/70 ${frame}`}>
      {image.status === 'ready' ? (
        <img src={image.url} alt={alt?.trim() || `Picture of ${name}`} className={`size-full object-cover ${portrait ? 'object-top' : ''}`} />
      ) : image.status === 'error' ? (
        <div className="grid size-full place-items-center p-4 text-center text-sm text-faint">
          <span className="flex flex-col items-center gap-2">
            <ImageOff className="size-5" />
            Image unavailable
          </span>
        </div>
      ) : (
        <div aria-label="Loading image" role="img" className="size-full animate-pulse bg-white/[0.04]" />
      )}
      {/* Blend wide covers into the article below. */}
      {!portrait && <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-panel/95 to-transparent" />}
    </figure>
  )
}
