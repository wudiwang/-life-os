import { allocateSourceKey } from './trade-patterns-core.mjs'

export async function syncPullRecord(deps, source) {
  const existing = await deps.findPattern(source.source_key)
  if (existing?.source_hash === source.source_hash) {
    return { status: 'unchanged', pattern_id: existing.id }
  }

  const { updates = [], ...pattern } = source
  const saved = await deps.upsertPattern(pattern)
  for (const update of updates) {
    await deps.upsertUpdate({ ...update, pattern_id: saved.id })
  }

  return { status: 'synced', pattern_id: saved.id }
}

export async function syncPushRecord(deps, draft) {
  try {
    const directories = await deps.listDirectories()
    const sourceKey = allocateSourceKey(directories, draft.title)
    const id = sourceKey.match(/^(\d+)/)?.[1]
    const image = await deps.downloadImage(draft.image_url)

    await deps.writeArchive({
      sourceKey,
      image,
      record: {
        ...draft,
        id,
        image_filename: `original.${image.extension}`,
      },
    })
    await deps.patchPattern(draft.id, {
      source_key: sourceKey,
      source_path: `research/ideas/${sourceKey}`,
      sync_state: 'synced',
      sync_error: null,
    })

    return { source_key: sourceKey }
  } catch (error) {
    await deps.patchPattern(draft.id, {
      sync_state: 'sync_error',
      sync_error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
