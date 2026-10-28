import { ImagePlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { ACCEPTED_TYPES, checkImage, deleteImage, imageShape, uploadImage, useCodexImage } from './codexImages'
import type { CodexEntry } from './types'

type ImageFieldProps = {
  entry: CodexEntry
  alt: string
  onAltChange: (alt: string) => void
}

// The article's main image in the editor. Uploading, replacing and removing
// take effect straight away (like DM Notes); the alt text is saved with the article.
export function ImageField({ entry, alt, onAltChange }: ImageFieldProps) {
  const [path, setPath] = useState(entry.image_path)
  const image = useCodexImage(path)
  const [preview, setPreview] = useState<string | null>(null) // the chosen file, shown while it uploads
  const [busy, setBusy] = useState<'uploading' | 'removing' | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const choose = async (file: File | undefined) => {
    if (!file || busy) return
    setError(null)
    const checked = await checkImage(file)
    if ('error' in checked) {
      setError(checked.error)
      return
    }
    setBusy('uploading')
    setPreview(URL.createObjectURL(file))
    const newPath = await uploadImage(entry.id, file, checked.format)
    const saved =
      newPath &&
      (await supabase.from('codex_entries').update({ image_path: newPath }).eq('id', entry.id).select('id')).data?.length
    if (!newPath || !saved) {
      if (newPath) await deleteImage(newPath)
      setPreview(null)
      setBusy(null)
      setError("The image couldn't be uploaded. You may not have permission to edit this article, or the connection dropped.")
      return
    }
    // The old file is no longer used by the article.
    if (path) await deleteImage(path)
    setPath(newPath)
    setBusy(null)
  }

  const remove = async () => {
    if (!path) return
    setBusy('removing')
    setError(null)
    const { data } = await supabase.from('codex_entries').update({ image_path: null }).eq('id', entry.id).select('id')
    setConfirmRemove(false)
    setBusy(null)
    if (!data?.length) {
      setError("The image couldn't be removed. You may not have permission, or the connection dropped.")
      return
    }
    await deleteImage(path)
    setPath(null)
    setPreview(null)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  const portrait = imageShape(entry.category) === 'portrait'
  const shown = image.status === 'ready' ? image.url : preview
  const buttonClass =
    'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-bone hover:bg-white/[0.07] disabled:opacity-50'

  return (
    <div>
      <span className="text-sm font-medium text-bone">Image</span>
      <span className="ml-2 text-xs text-faint">{portrait ? 'Portrait' : 'Cover picture'}</span>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          choose(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <div className="mt-1.5 space-y-2.5 rounded-lg border border-line bg-charcoal/70 p-2.5">
        {path || preview ? (
          <div className={`relative mx-auto overflow-hidden rounded-md bg-panel ${portrait ? 'aspect-[4/5] w-40' : 'aspect-[16/9] w-full'}`}>
            {shown ? (
              <img src={shown} alt={alt.trim() || `Picture of ${entry.name}`} className={`size-full object-cover ${portrait ? 'object-top' : ''}`} />
            ) : image.status === 'error' ? (
              <p className="grid size-full place-items-center p-3 text-center text-xs text-faint">Image unavailable. Try replacing it.</p>
            ) : (
              <div className="size-full animate-pulse bg-white/[0.05]" />
            )}
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-charcoal/70 text-xs text-bone">
                <span className="flex items-center gap-2">
                  <LoaderCircle className="size-4 animate-spin text-gold" />
                  {busy === 'uploading' ? 'Uploading…' : 'Removing…'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-3 py-6 text-center transition-colors ${
              dragging ? 'border-gold/60 bg-gold/5' : 'border-line hover:border-gold/40'
            }`}
          >
            <ImagePlus className="size-6 text-gold" strokeWidth={1.5} />
            <span className="text-sm text-bone">Add an image</span>
            <span className="text-xs text-faint">JPEG, PNG or WebP, up to 5 MB</span>
          </button>
        )}

        {(path || preview) && (
          <div className="flex gap-2">
            <button type="button" disabled={!!busy} onClick={() => input.current?.click()} className={buttonClass}>
              <RefreshCw className="size-3.5" />
              Replace
            </button>
            <button type="button" disabled={!!busy} onClick={() => setConfirmRemove(true)} className={buttonClass}>
              <Trash2 className="size-3.5" />
              Remove
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-burgundy/40 bg-burgundy-dark/40 px-3 py-2 text-xs leading-relaxed text-bone">
            {error}
          </p>
        )}

        {path && (
          <label className="block">
            <span className="text-xs font-medium text-ash">Description (alt text)</span>
            <textarea
              value={alt}
              onChange={(event) => onAltChange(event.target.value)}
              rows={2}
              maxLength={300}
              placeholder="e.g. An old elf in grey robes, holding a lantern"
              className="mt-1 w-full resize-y rounded-md border border-line bg-charcoal px-2.5 py-1.5 text-sm text-bone placeholder:text-faint focus:border-gold/60"
            />
            <span className="block text-[11px] leading-snug text-faint">Read aloud by screen readers. Saved with the article.</span>
          </label>
        )}
      </div>
      <span className="mt-1.5 block text-xs leading-relaxed text-faint">
        Images are private: only people who can read this article can see its image. Changes to the image are saved straight away.
      </span>

      {confirmRemove && (
        <ConfirmDialog title="Remove this image?" confirmLabel="Remove image" busy={busy === 'removing'} onConfirm={remove} onCancel={() => setConfirmRemove(false)}>
          <p>The image will be deleted from this article. The article itself isn't changed.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
