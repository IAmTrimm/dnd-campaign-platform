import { useEffect, useState } from 'react'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../config/supabase'
import { supabase } from '../../lib/supabase'
import type { CodexCategory } from './types'

// Article images live in the private "codex-images" Storage bucket at
// <article id>/<random name>. They are never given a public or shareable URL:
// each one is downloaded with the reader's own login and shown from a
// temporary in-page blob URL.
const BUCKET = 'codex-images'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // must match the bucket's limit

const FORMATS = [
  { type: 'image/jpeg', ext: 'jpg', matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', ext: 'png', matches: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v) },
  {
    type: 'image/webp',
    ext: 'webp',
    matches: (b: Uint8Array) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
  },
]

export const ACCEPTED_TYPES = FORMATS.map((f) => f.type).join(',')

// Checks the file really is a JPEG, PNG or WebP image (by its contents, not
// just its name) and isn't too big. Returns the format, or an error message.
export async function checkImage(file: File): Promise<{ format: (typeof FORMATS)[number] } | { error: string }> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: `This image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB, so try a smaller or more compressed version.` }
  }
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const format = FORMATS.find((f) => f.matches(head))
  if (!format) return { error: 'That file isn’t a supported image. Use a JPEG, PNG or WebP picture (SVG, GIF and HEIC aren’t supported).' }
  return { format }
}

// Uploads a checked image for an article and returns its storage path.
export async function uploadImage(entryId: string, file: File, format: (typeof FORMATS)[number]) {
  const path = `${entryId}/${crypto.randomUUID()}.${format.ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: format.type, upsert: false, cacheControl: '0' })
  return error ? null : path
}

export async function deleteImage(path: string) {
  await supabase.storage.from(BUCKET).remove([path])
}

// People and objects get a framed portrait; places, factions and lore a wide cover.
export const imageShape = (category: CodexCategory) => (category === 'npc' || category === 'item' ? 'portrait' : 'cover')

// Supabase's CDN remembers a successful access check for the same login and
// address, so after an article is unpublished someone who already viewed its
// image could keep getting it for a while. A unique address on every request
// makes Storage check the access rules again each time.
async function fetchImage(path: string): Promise<Blob | null> {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  if (!token) return null
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${encodeURI(path)}?fresh=${Date.now()}`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return response.ok ? await response.blob() : null
  } catch {
    return null
  }
}

export type ImageState = { status: 'none' } | { status: 'loading' } | { status: 'error' } | { status: 'ready'; url: string }

// Downloads an article image for display. Fails safely (status "error") if the
// file is missing or the reader isn't allowed to see it.
export function useCodexImage(path: string | null): ImageState {
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    let url: string | null = null
    fetchImage(path).then((blob) => {
      if (cancelled) return
      url = blob ? URL.createObjectURL(blob) : null
      setLoaded({ path, url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [path])

  if (!path) return { status: 'none' }
  if (loaded?.path !== path) return { status: 'loading' }
  return loaded.url ? { status: 'ready', url: loaded.url } : { status: 'error' }
}
