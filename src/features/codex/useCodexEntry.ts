import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CodexEntry } from './types'

// Loads one full article. The database only returns it if the user may read it.
export function useCodexEntry(id: string) {
  const [result, setResult] = useState<{ id: string; entry: CodexEntry | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('codex_entries')
      .select('id, world_id, campaign_id, category, name, summary, description, image_path, image_alt, tags, visibility, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setResult({ id, entry: data as CodexEntry | null })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return { loading: result?.id !== id, entry: result?.id === id ? result.entry : null }
}
