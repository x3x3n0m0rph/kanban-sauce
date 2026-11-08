import * as path from 'path'
import * as vscode from 'vscode'
import { generateKeyBetween } from 'fractional-indexing'
import {
  getTitleFromContent,
  generateFeatureFilename,
  type Feature,
  type FeatureStatus,
  type FilenamePattern,
  type Priority,
  type KanbanColumn
} from '../shared/types'
import { parseFeatureFile, serializeFeature } from '../shared/featureFrontmatter'
import { getFeatureFilePath, fileExists } from './featureFileUtils'
import { getBoardColumns, getBoardDefaultFeatureType, getBoardFeatureTypes, getActiveBoardPath } from './boardConfig'
import type { FsAdapter } from './featureFileUtils'

export interface BoardFsAdapter extends FsAdapter {
  readDirectory(uri: vscode.Uri): Thenable<[string, vscode.FileType][]>
  readFile(uri: vscode.Uri): Thenable<Uint8Array>
  writeFile(uri: vscode.Uri, content: Uint8Array): Thenable<void>
}

export interface BoardServiceSettings {
  filenamePattern: FilenamePattern
  defaultPriority: Priority
  defaultStatus: string
  addNewCardsToTop: boolean
  /** When set, used as create default type; when undefined, resolve from board/workspace config. */
  defaultFeatureType?: string | null
}

export type BoardPathResolver = () => string | null | Promise<string | null>
export type KnownBoardsResolver = () => string[] | Promise<string[]>
export type SettingsResolver = () => BoardServiceSettings

export interface CreateFeatureInput {
  content: string
  status?: string
  priority?: Priority
  type?: string | null
  assignee?: string | null
  epic?: string | null
  dueDate?: string | null
  labels?: string[]
}

function normalizeEpic(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeType(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function featureMatchesQuery(feature: Feature, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    feature.content.toLowerCase().includes(q) ||
    feature.id.toLowerCase().includes(q) ||
    (!!feature.assignee && feature.assignee.toLowerCase().includes(q)) ||
    (!!feature.epic && feature.epic.toLowerCase().includes(q)) ||
    (!!feature.type && feature.type.toLowerCase().includes(q)) ||
    feature.labels.some(l => l.toLowerCase().includes(q))
  )
}

function readWorkspaceSettings(): BoardServiceSettings {
  const config = vscode.workspace.getConfiguration('kanban-sauce')
  return {
    filenamePattern: config.get<FilenamePattern>('filenamePattern', 'name-date'),
    defaultPriority: config.get<Priority>('defaultPriority', 'medium'),
    defaultStatus: config.get<string>('defaultStatus', 'backlog'),
    addNewCardsToTop: config.get<boolean>('addNewCardsToTop', false)
  }
}

export class FeatureBoardService {
  constructor(
    private readonly fs: BoardFsAdapter = vscode.workspace.fs,
    private readonly resolveBoardPath: BoardPathResolver = () => getActiveBoardPath(),
    private readonly resolveKnownBoards: KnownBoardsResolver = () => [],
    private readonly resolveSettings: SettingsResolver = readWorkspaceSettings,
    private readonly resolveColumns: (boardPath: string) => KanbanColumn[] = getBoardColumns
  ) {}

  async resolveBoard(boardPath?: string | null): Promise<string> {
    if (boardPath?.trim()) {
      return boardPath.trim()
    }
    const active = await this.resolveBoardPath()
    if (active) return active
    const known = await this.resolveKnownBoards()
    if (known.length > 0) return known[0]
    throw new Error('No board available. Open a Kanban board or pass boardPath.')
  }

  async listBoards(): Promise<{ path: string; name: string; columns: KanbanColumn[] }[]> {
    const known = await this.resolveKnownBoards()
    const active = await this.resolveBoardPath()
    const paths = new Set(known)
    if (active) paths.add(active)
    return Array.from(paths).map(boardPath => ({
      path: boardPath,
      name: path.basename(boardPath),
      columns: this.resolveColumns(boardPath)
    }))
  }

  async getBoard(boardPath?: string | null): Promise<{ path: string; name: string; columns: KanbanColumn[] }> {
    const resolved = await this.resolveBoard(boardPath)
    return {
      path: resolved,
      name: path.basename(resolved),
      columns: this.resolveColumns(resolved)
    }
  }

  async listFeatures(boardPath?: string | null, status?: string | null): Promise<Feature[]> {
    const resolved = await this.resolveBoard(boardPath)
    const features = await this.loadFeatures(resolved)
    if (!status) return features
    return features.filter(f => f.status === status)
  }

  async searchFeatures(boardPath: string | null | undefined, query: string): Promise<Feature[]> {
    const features = await this.listFeatures(boardPath)
    const trimmed = query.trim()
    if (!trimmed) return features
    return features.filter(f => featureMatchesQuery(f, trimmed))
  }

  async createFeature(boardPath: string | null | undefined, input: CreateFeatureInput): Promise<Feature> {
    const resolved = await this.resolveBoard(boardPath)
    const columns = this.resolveColumns(resolved)
    const settings = this.resolveSettings()
    const content = input.content?.trim()
    if (!content) {
      throw new Error('content is required')
    }

    const status = (input.status?.trim() || settings.defaultStatus)
    if (!columns.some(c => c.id === status)) {
      throw new Error(`Unknown status "${status}". Valid: ${columns.map(c => c.id).join(', ')}`)
    }

    let defaultType: string | null
    if (settings.defaultFeatureType !== undefined) {
      defaultType = settings.defaultFeatureType
    } else {
      const featureTypes = getBoardFeatureTypes(resolved)
      defaultType = getBoardDefaultFeatureType(resolved, featureTypes)
    }
    const type = normalizeType(input.type !== undefined ? input.type : defaultType)
    const priority = input.priority || settings.defaultPriority
    const title = getTitleFromContent(content)
    const filename = generateFeatureFilename(title, settings.filenamePattern, new Date(), type)
    const now = new Date().toISOString()

    const existing = await this.loadFeatures(resolved)
    const featuresInStatus = existing
      .filter(f => f.status === status)
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    const newOrder = settings.addNewCardsToTop
      ? generateKeyBetween(null, featuresInStatus.length > 0 ? featuresInStatus[0].order : null)
      : generateKeyBetween(featuresInStatus.length > 0 ? featuresInStatus[featuresInStatus.length - 1].order : null, null)

    let uniqueFilename = filename
    let filePath = getFeatureFilePath(resolved, uniqueFilename)
    let counter = 1
    while (await fileExists(filePath, this.fs)) {
      uniqueFilename = `${filename}-${counter}`
      filePath = getFeatureFilePath(resolved, uniqueFilename)
      counter++
    }

    const feature: Feature = {
      id: uniqueFilename,
      status: status as FeatureStatus,
      priority,
      type,
      assignee: normalizeEpic(input.assignee),
      epic: normalizeEpic(input.epic),
      dueDate: input.dueDate?.trim() || null,
      created: now,
      modified: now,
      completedAt: status === 'done' ? now : null,
      labels: input.labels ?? [],
      order: newOrder,
      content,
      filePath
    }

    await this.fs.createDirectory(vscode.Uri.file(path.dirname(feature.filePath)))
    await this.fs.writeFile(
      vscode.Uri.file(feature.filePath),
      new TextEncoder().encode(serializeFeature(feature))
    )
    return feature
  }

  async setFeatureStatus(
    boardPath: string | null | undefined,
    featureId: string,
    newStatus: string
  ): Promise<Feature> {
    const resolved = await this.resolveBoard(boardPath)
    const columns = this.resolveColumns(resolved)
    if (!columns.some(c => c.id === newStatus)) {
      throw new Error(`Unknown status "${newStatus}". Valid: ${columns.map(c => c.id).join(', ')}`)
    }

    const features = await this.loadFeatures(resolved)
    const feature = features.find(f => f.id === featureId)
    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`)
    }

    const statusChanged = feature.status !== newStatus
    feature.status = newStatus as FeatureStatus
    feature.modified = new Date().toISOString()
    if (statusChanged) {
      feature.completedAt = newStatus === 'done' ? new Date().toISOString() : null
    }

    const targetColumnFeatures = features
      .filter(f => f.status === newStatus && f.id !== featureId)
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    const lastOrder = targetColumnFeatures.length > 0
      ? targetColumnFeatures[targetColumnFeatures.length - 1].order
      : null
    feature.order = generateKeyBetween(lastOrder, null)

    await this.fs.writeFile(
      vscode.Uri.file(feature.filePath),
      new TextEncoder().encode(serializeFeature(feature))
    )
    return feature
  }

  private async loadFeatures(boardPath: string): Promise<Feature[]> {
    try {
      await this.fs.createDirectory(vscode.Uri.file(boardPath))
    } catch {
      // directory may already exist
    }

    let entries: [string, vscode.FileType][]
    try {
      entries = await this.fs.readDirectory(vscode.Uri.file(boardPath))
    } catch {
      return []
    }

    const features: Feature[] = []
    for (const [file, fileType] of entries) {
      if (fileType !== vscode.FileType.File || !file.endsWith('.md')) continue
      const filePath = path.join(boardPath, file)
      try {
        const raw = new TextDecoder().decode(await this.fs.readFile(vscode.Uri.file(filePath)))
        const feature = parseFeatureFile(raw, filePath)
        if (feature) features.push(feature)
      } catch {
        // skip unreadable files
      }
    }

    return features.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
  }
}
