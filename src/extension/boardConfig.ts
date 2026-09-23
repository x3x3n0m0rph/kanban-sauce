import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { DEFAULT_FEATURE_TYPES, FeatureTypeConfig, KanbanColumn } from '../shared/types'
import { KanbanPanel } from './KanbanPanel'

export function getActiveBoardPath(): string | null {
  if (KanbanPanel.activePanel) {
    return KanbanPanel.activePanel._boardPath
  }
  if (KanbanPanel.openPanels.size === 1) {
    return Array.from(KanbanPanel.openPanels.keys())[0]
  }
  return null
}

function readBoardConfig(boardPath: string | null): Record<string, unknown> | null {
  if (!boardPath) return null
  const configPath = path.join(boardPath, '.kanbansauce')
  if (!fs.existsSync(configPath)) return null
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8')
    const parsedConfig = JSON.parse(configContent)
    return parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : null
  } catch (e) {
    console.error(`Failed to parse ${configPath}:`, e)
    return null
  }
}

export function validateFeatureTypes(types: unknown): FeatureTypeConfig[] | null {
  if (!Array.isArray(types) || types.length === 0) return null
  const ids = new Set<string>()
  const validated: FeatureTypeConfig[] = []
  for (const item of types) {
    if (!item || typeof item !== 'object') return null
    const { id, name, shortName } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id.trim()) return null
    if (typeof name !== 'string' || !name.trim()) return null
    if (typeof shortName !== 'string' || !shortName.trim()) return null
    if (ids.has(id)) return null
    ids.add(id)
    validated.push({ id: id.trim(), name: name.trim(), shortName: shortName.trim() })
  }
  return validated
}

export function getBoardFeatureTypes(boardPath: string | null): FeatureTypeConfig[] {
  const parsedConfig = readBoardConfig(boardPath)
  if (parsedConfig && Array.isArray(parsedConfig.types)) {
    const validated = validateFeatureTypes(parsedConfig.types)
    if (validated) return validated
  }

  const config = vscode.workspace.getConfiguration('kanban-sauce')
  const workspaceTypes = validateFeatureTypes(config.get<unknown>('featureTypes'))
  if (workspaceTypes) return workspaceTypes

  return DEFAULT_FEATURE_TYPES
}

export function getBoardDefaultFeatureType(boardPath: string | null, featureTypes: FeatureTypeConfig[]): string | null {
  const parsedConfig = readBoardConfig(boardPath)
  if (parsedConfig && typeof parsedConfig.defaultType === 'string') {
    const trimmed = parsedConfig.defaultType.trim()
    if (trimmed && featureTypes.some(t => t.id === trimmed)) return trimmed
    if (!trimmed) return null
  }

  const config = vscode.workspace.getConfiguration('kanban-sauce')
  const defaultType = config.get<string>('defaultFeatureType', 'feature')
  if (!defaultType) return null
  return featureTypes.some(t => t.id === defaultType) ? defaultType : null
}

export function getBoardColumns(boardPath: string | null): KanbanColumn[] {
  const defaultColumns: KanbanColumn[] = [
    { id: 'backlog', name: 'Backlog', color: '#6b7280' },
    { id: 'todo', name: 'To Do', color: '#3b82f6' },
    { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
    { id: 'review', name: 'Review', color: '#8b5cf6' },
    { id: 'done', name: 'Done', color: '#22c55e' }
  ]

  const parsedConfig = readBoardConfig(boardPath)
  if (parsedConfig && Array.isArray(parsedConfig.columns)) {
    return parsedConfig.columns as KanbanColumn[]
  }

  const config = vscode.workspace.getConfiguration('kanban-sauce')
  return config.get<KanbanColumn[]>('columns', defaultColumns)
}

export function saveBoardColumns(boardPath: string, columns: KanbanColumn[]): void {
  const configPath = path.join(boardPath, '.kanbansauce')
  let parsedConfig: { columns?: KanbanColumn[] } = {}

  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8')
      parsedConfig = JSON.parse(configContent)
    } catch (e) {
      console.error(`Failed to parse ${configPath} when saving:`, e)
    }
  }

  parsedConfig.columns = columns
  fs.writeFileSync(configPath, JSON.stringify(parsedConfig, null, 2), 'utf-8')
}
