import { describe, it, expect, vi } from 'vitest'
import path from 'path'
import type { FsAdapter } from '../../src/extension/featureFileUtils'

// ---------------------------------------------------------------------------
// vscode stub — only Uri.file is needed by featureFileUtils
// ---------------------------------------------------------------------------

vi.mock('vscode', () => ({
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` })
  }
}))

import {
  getFeatureFilePath,
  fileExists,
  moveFeatureFile
} from '../../src/extension/featureFileUtils'

// ---------------------------------------------------------------------------
// In-memory FsAdapter factory
// ---------------------------------------------------------------------------

const FEATURES_DIR = '/workspace/.devtool/features'

/**
 * Builds a FsAdapter stub whose behaviour is controlled by the `existing`
 * set: stat resolves for paths in the set and rejects for all others.
 * rename and createDirectory are spies that always resolve.
 */
function makeFs(existing: Set<string> = new Set()): FsAdapter & {
  rename: ReturnType<typeof vi.fn>
  createDirectory: ReturnType<typeof vi.fn>
} {
  return {
    stat: vi.fn((uri: { fsPath: string }) => {
      if (existing.has(uri.fsPath)) return Promise.resolve({} as never)
      return Promise.reject(new Error('ENOENT'))
    }),
    rename: vi.fn(() => Promise.resolve()),
    createDirectory: vi.fn(() => Promise.resolve())
  }
}

// ---------------------------------------------------------------------------
// getFeatureFilePath
// ---------------------------------------------------------------------------

describe('getFeatureFilePath', () => {
  it('returns path at board root for any filename', () => {
    expect(getFeatureFilePath(FEATURES_DIR, 'my-feature-2026-02-23'))
      .toBe(path.join(FEATURES_DIR, 'my-feature-2026-02-23.md'))
    expect(getFeatureFilePath(FEATURES_DIR, 'done-card'))
      .toBe(path.join(FEATURES_DIR, 'done-card.md'))
  })
})

// ---------------------------------------------------------------------------
// fileExists
// ---------------------------------------------------------------------------

describe('fileExists', () => {
  it('returns true when stat resolves', async () => {
    const existing = path.join(FEATURES_DIR, 'present.md')
    const fs = makeFs(new Set([existing]))
    expect(await fileExists(existing, fs)).toBe(true)
  })

  it('returns false when stat rejects', async () => {
    const fs = makeFs(new Set())
    expect(await fileExists(path.join(FEATURES_DIR, 'absent.md'), fs)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// moveFeatureFile
// ---------------------------------------------------------------------------

describe('moveFeatureFile', () => {
  const currentPath = path.join(FEATURES_DIR, 'my-feature.md')

  it('returns currentPath unchanged when already at root (no-op)', async () => {
    const fs = makeFs()
    const result = await moveFeatureFile(currentPath, FEATURES_DIR, fs)
    expect(result).toBe(currentPath)
    expect(fs.rename).not.toHaveBeenCalled()
  })

  it('moves a file from a subfolder to board root', async () => {
    const fromDone = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const fs = makeFs()
    const result = await moveFeatureFile(fromDone, FEATURES_DIR, fs)
    expect(result).toBe(path.join(FEATURES_DIR, 'my-feature.md'))
    expect(fs.rename).toHaveBeenCalledOnce()
  })

  it('calls createDirectory on the board root before renaming', async () => {
    const fromDone = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const fs = makeFs()
    await moveFeatureFile(fromDone, FEATURES_DIR, fs)
    expect(fs.createDirectory).toHaveBeenCalledOnce()
    const uri = (fs.createDirectory as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(uri.fsPath).toBe(FEATURES_DIR)
  })

  it('applies a -1 suffix when the target path is already taken', async () => {
    const fromDone = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const target = path.join(FEATURES_DIR, 'my-feature.md')
    const fs = makeFs(new Set([target]))
    const result = await moveFeatureFile(fromDone, FEATURES_DIR, fs)
    expect(result).toBe(path.join(FEATURES_DIR, 'my-feature-1.md'))
  })

  it('increments counter until a free path is found', async () => {
    const fromDone = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const target0 = path.join(FEATURES_DIR, 'my-feature.md')
    const target1 = path.join(FEATURES_DIR, 'my-feature-1.md')
    const target2 = path.join(FEATURES_DIR, 'my-feature-2.md')
    const fs = makeFs(new Set([target0, target1, target2]))
    const result = await moveFeatureFile(fromDone, FEATURES_DIR, fs)
    expect(result).toBe(path.join(FEATURES_DIR, 'my-feature-3.md'))
  })

  it('passes the correct source and target URIs to rename', async () => {
    const fromDone = path.join(FEATURES_DIR, 'done', 'my-feature.md')
    const fs = makeFs()
    await moveFeatureFile(fromDone, FEATURES_DIR, fs)
    const [from, to] = (fs.rename as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(from.fsPath).toBe(fromDone)
    expect(to.fsPath).toBe(path.join(FEATURES_DIR, 'my-feature.md'))
  })
})
