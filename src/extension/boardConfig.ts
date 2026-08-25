import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { KanbanColumn } from '../shared/types'
import { KanbanPanel } from './KanbanPanel'

export interface BoardConfig {
  columns?: KanbanColumn[]
  descriptionTemplate?: string
  [key: string]: unknown
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', name: 'Backlog', color: '#6b7280' },
  { id: 'todo', name: 'To Do', color: '#3b82f6' },
  { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
  { id: 'review', name: 'Review', color: '#8b5cf6' },
  { id: 'done', name: 'Done', color: '#22c55e' }
]

export function getActiveBoardPath(): string | null {
  if (KanbanPanel.activePanel) {
    return KanbanPanel.activePanel._boardPath
  }
  if (KanbanPanel.openPanels.size === 1) {
    return Array.from(KanbanPanel.openPanels.keys())[0]
  }
  return null
}

function readBoardConfigFile(boardPath: string): BoardConfig | null {
  const configPath = path.join(boardPath, '.kanbansauce')
  if (!fs.existsSync(configPath)) {
    return null
  }
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8')
    const parsedConfig = JSON.parse(configContent)
    if (parsedConfig && typeof parsedConfig === 'object') {
      return parsedConfig as BoardConfig
    }
  } catch (e) {
    console.error(`Failed to parse ${configPath}:`, e)
  }
  return null
}

/** Read the full board config from `.kanbansauce` (or empty object if missing/invalid). */
export function getBoardConfig(boardPath: string | null): BoardConfig {
  if (!boardPath) {
    return {}
  }
  return readBoardConfigFile(boardPath) ?? {}
}

export function getBoardColumns(boardPath: string | null): KanbanColumn[] {
  if (boardPath) {
    const parsedConfig = readBoardConfigFile(boardPath)
    if (parsedConfig && Array.isArray(parsedConfig.columns)) {
      return parsedConfig.columns as KanbanColumn[]
    }
  }

  // Fallback to workspace settings
  const config = vscode.workspace.getConfiguration('kanban-sauce')
  return config.get<KanbanColumn[]>('columns', DEFAULT_COLUMNS)
}

/** Markdown body template for new cards (without the `# Title` heading). Empty if unset. */
export function getDescriptionTemplate(boardPath: string | null): string {
  if (!boardPath) {
    return ''
  }
  const parsedConfig = readBoardConfigFile(boardPath)
  const template = parsedConfig?.descriptionTemplate
  return typeof template === 'string' ? template : ''
}

/**
 * Merge-write board config. Preserves unknown keys.
 * Empty/whitespace-only descriptionTemplate is removed from the file.
 */
export function saveBoardConfig(
  boardPath: string,
  updates: { columns?: KanbanColumn[]; descriptionTemplate?: string }
): void {
  const configPath = path.join(boardPath, '.kanbansauce')
  let parsedConfig: BoardConfig = {}

  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8')
      parsedConfig = JSON.parse(configContent)
      if (!parsedConfig || typeof parsedConfig !== 'object') {
        parsedConfig = {}
      }
    } catch (e) {
      console.error(`Failed to parse ${configPath} when saving:`, e)
      parsedConfig = {}
    }
  }

  if (updates.columns !== undefined) {
    parsedConfig.columns = updates.columns
  }

  if (updates.descriptionTemplate !== undefined) {
    const trimmed = updates.descriptionTemplate.trim()
    if (trimmed) {
      parsedConfig.descriptionTemplate = updates.descriptionTemplate
    } else {
      delete parsedConfig.descriptionTemplate
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(parsedConfig, null, 2), 'utf-8')
}

export function saveBoardColumns(boardPath: string, columns: KanbanColumn[]): void {
  saveBoardConfig(boardPath, { columns })
}
