import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { KanbanColumn } from '../shared/types'
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

export function getBoardColumns(boardPath: string | null): KanbanColumn[] {
  const defaultColumns: KanbanColumn[] = [
    { id: 'backlog', name: 'Backlog', color: '#6b7280' },
    { id: 'todo', name: 'To Do', color: '#3b82f6' },
    { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
    { id: 'review', name: 'Review', color: '#8b5cf6' },
    { id: 'done', name: 'Done', color: '#22c55e' }
  ]

  if (boardPath) {
    const configPath = path.join(boardPath, '.kanbansauce')
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf-8')
        const parsedConfig = JSON.parse(configContent)
        if (parsedConfig && Array.isArray(parsedConfig.columns)) {
          return parsedConfig.columns as KanbanColumn[]
        }
      } catch (e) {
        console.error(`Failed to parse ${configPath}:`, e)
      }
    }
  }

  // Fallback to workspace settings
  const config = vscode.workspace.getConfiguration('kanban-sauce')
  return config.get<KanbanColumn[]>('columns', defaultColumns)
}
