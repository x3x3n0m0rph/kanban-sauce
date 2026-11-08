import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import type { BoardFsAdapter, BoardServiceSettings } from '../../src/extension/featureBoardService'
import { serializeFeature } from '../../src/shared/featureFrontmatter'
import type { Feature, KanbanColumn } from '../../src/shared/types'

vi.mock('vscode', () => ({
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` })
  },
  FileType: {
    File: 1,
    Directory: 2,
    SymbolicLink: 64,
    Unknown: 0
  },
  workspace: {
    fs: {},
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((_key: string, defaultValue: unknown) => defaultValue)
    })
  }
}))

vi.mock('../../src/extension/KanbanPanel', () => ({
  KanbanPanel: {
    activePanel: null,
    openPanels: new Map()
  }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}))

import { FeatureBoardService } from '../../src/extension/featureBoardService'
import * as vscode from 'vscode'

const BOARD = path.join('workspace', 'board')
const COLUMNS: KanbanColumn[] = [
  { id: 'backlog', name: 'Backlog', color: '#6b7280' },
  { id: 'todo', name: 'To Do', color: '#3b82f6' },
  { id: 'done', name: 'Done', color: '#22c55e' }
]

const DEFAULT_SETTINGS: BoardServiceSettings = {
  filenamePattern: 'name-date',
  defaultPriority: 'medium',
  defaultStatus: 'backlog',
  addNewCardsToTop: false,
  defaultFeatureType: 'feature'
}

function makeFeature(partial: Partial<Feature> & Pick<Feature, 'id' | 'status' | 'content'>): Feature {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    priority: 'medium',
    type: 'feature',
    assignee: null,
    epic: null,
    dueDate: null,
    created: now,
    modified: now,
    completedAt: null,
    labels: [],
    order: 'a0',
    filePath: path.join(BOARD, `${partial.id}.md`),
    ...partial
  }
}

function makeMemoryFs(initial: Feature[] = []): BoardFsAdapter & {
  files: Map<string, string>
} {
  const files = new Map<string, string>()
  for (const f of initial) {
    files.set(f.filePath, serializeFeature(f))
  }

  return {
    files,
    stat: vi.fn(async (uri: { fsPath: string }) => {
      if (files.has(uri.fsPath) || uri.fsPath === BOARD) return {} as never
      throw new Error('ENOENT')
    }),
    rename: vi.fn(async () => undefined),
    createDirectory: vi.fn(async () => undefined),
    readDirectory: vi.fn(async () => {
      return Array.from(files.keys())
        .filter(p => path.normalize(path.dirname(p)) === path.normalize(BOARD))
        .map(p => [path.basename(p), vscode.FileType.File] as [string, vscode.FileType])
    }),
    readFile: vi.fn(async (uri: { fsPath: string }) => {
      const content = files.get(uri.fsPath)
      if (content === undefined) throw new Error('ENOENT')
      return new TextEncoder().encode(content)
    }),
    writeFile: vi.fn(async (uri: { fsPath: string }, content: Uint8Array) => {
      files.set(uri.fsPath, new TextDecoder().decode(content))
    })
  }
}

describe('FeatureBoardService', () => {
  let fsAdapter: ReturnType<typeof makeMemoryFs>
  let service: FeatureBoardService

  beforeEach(() => {
    fsAdapter = makeMemoryFs([
      makeFeature({ id: 'alpha-card', status: 'backlog', content: '# Alpha\nfirst', assignee: 'alice', labels: ['core'], order: 'a0' }),
      makeFeature({ id: 'beta-card', status: 'todo', content: '# Beta\nsecond', epic: 'Epic One', type: 'bug', order: 'a1' })
    ])
    service = new FeatureBoardService(
      fsAdapter,
      () => BOARD,
      () => [BOARD],
      () => DEFAULT_SETTINGS,
      () => COLUMNS
    )
  })

  it('listFeatures returns parsed root markdown features', async () => {
    const features = await service.listFeatures()
    expect(features.map(f => f.id).sort()).toEqual(['alpha-card', 'beta-card'])
  })

  it('listFeatures filters by status', async () => {
    const features = await service.listFeatures(BOARD, 'todo')
    expect(features).toHaveLength(1)
    expect(features[0].id).toBe('beta-card')
  })

  it('listFeatures ignores invalid markdown', async () => {
    fsAdapter.files.set(path.join(BOARD, 'notes.md'), 'no frontmatter here')
    fsAdapter.files.set(path.join(BOARD, 'readme.txt'), 'ignore')
    const features = await service.listFeatures()
    expect(features.map(f => f.id).sort()).toEqual(['alpha-card', 'beta-card'])
  })

  it('searchFeatures matches content id assignee epic type labels', async () => {
    expect((await service.searchFeatures(BOARD, 'Alpha')).map(f => f.id)).toEqual(['alpha-card'])
    expect((await service.searchFeatures(BOARD, 'alice')).map(f => f.id)).toEqual(['alpha-card'])
    expect((await service.searchFeatures(BOARD, 'Epic One')).map(f => f.id)).toEqual(['beta-card'])
    expect((await service.searchFeatures(BOARD, 'bug')).map(f => f.id)).toEqual(['beta-card'])
    expect((await service.searchFeatures(BOARD, 'core')).map(f => f.id)).toEqual(['alpha-card'])
    expect((await service.searchFeatures(BOARD, 'beta-card')).map(f => f.id)).toEqual(['beta-card'])
  })

  it('searchFeatures with empty query returns all', async () => {
    expect(await service.searchFeatures(BOARD, '  ')).toHaveLength(2)
  })

  it('createFeature writes file with defaults and unique name', async () => {
    const created = await service.createFeature(BOARD, { content: '# Alpha\nnew one' })
    expect(created.status).toBe('backlog')
    expect(created.priority).toBe('medium')
    expect(created.type).toBe('feature')
    expect(created.id).toMatch(/^alpha-/)
    expect(fsAdapter.files.has(created.filePath)).toBe(true)

    // collision: same title again gets -N suffix
    const second = await service.createFeature(BOARD, { content: '# Alpha\nanother' })
    expect(second.id).not.toBe(created.id)
  })

  it('createFeature rejects unknown status', async () => {
    await expect(service.createFeature(BOARD, { content: '# X', status: 'nope' }))
      .rejects.toThrow(/Unknown status/)
  })

  it('setFeatureStatus updates status completedAt and order', async () => {
    const updated = await service.setFeatureStatus(BOARD, 'alpha-card', 'done')
    expect(updated.status).toBe('done')
    expect(updated.completedAt).toBeTruthy()

    const reopened = await service.setFeatureStatus(BOARD, 'alpha-card', 'todo')
    expect(reopened.status).toBe('todo')
    expect(reopened.completedAt).toBeNull()
  })

  it('setFeatureStatus errors for unknown id or status', async () => {
    await expect(service.setFeatureStatus(BOARD, 'missing', 'todo')).rejects.toThrow(/not found/i)
    await expect(service.setFeatureStatus(BOARD, 'alpha-card', 'nope')).rejects.toThrow(/Unknown status/)
  })

  it('resolveBoard prefers explicit path then active then known', async () => {
    const noActive = new FeatureBoardService(
      fsAdapter,
      () => null,
      () => ['/known/board'],
      () => DEFAULT_SETTINGS,
      () => COLUMNS
    )
    expect(await noActive.resolveBoard('/explicit')).toBe('/explicit')
    expect(await noActive.resolveBoard()).toBe('/known/board')

    const empty = new FeatureBoardService(
      fsAdapter,
      () => null,
      () => [],
      () => DEFAULT_SETTINGS,
      () => COLUMNS
    )
    await expect(empty.resolveBoard()).rejects.toThrow(/No board available/)
  })
})
