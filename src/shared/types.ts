// Kanban types

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type FeatureStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'

export interface FeatureTypeConfig {
  id: string
  name: string
  shortName: string
}

export const DEFAULT_FEATURE_TYPES: FeatureTypeConfig[] = [
  { id: 'feature', name: 'Feature', shortName: 'FEAT' },
  { id: 'bug', name: 'Bug', shortName: 'BUG' },
  { id: 'tech-debt', name: 'TechDebt', shortName: 'DEBT' }
]

export function resolveFeatureType(
  typeId: string | null | undefined,
  types: FeatureTypeConfig[]
): { id: string; name: string; shortName: string } | null {
  if (!typeId) return null
  const found = types.find(t => t.id === typeId)
  if (found) return found
  return { id: typeId, name: typeId, shortName: typeId }
}

export interface Feature {
  id: string
  status: FeatureStatus
  priority: Priority
  type: string | null
  assignee: string | null
  epic: string | null
  dueDate: string | null
  created: string
  modified: string
  completedAt: string | null
  labels: string[]
  order: string
  content: string
  filePath: string
}

// Parse title from the first # heading in markdown content, falling back to the first line
export function getTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  if (match) return match[1].trim()
  const firstLine = content.split('\n').map(l => l.trim()).find(l => l.length > 0)
  return firstLine || 'Untitled'
}

export type FilenamePattern =
  | 'name-date'
  | 'date-name'
  | 'name-datetime'
  | 'datetime-name'
  | 'type-name-date'
  | 'name-type-date'
  | 'type-name-datetime'
  | 'name-type-datetime'

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)

  return slug || 'feature'
}

function slugifyType(typeId: string | null | undefined): string {
  if (!typeId?.trim()) return 'task'
  const slug = typeId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'task'
}

// Generate a filename-safe slug from a title
export function generateFeatureFilename(
  title: string,
  pattern: FilenamePattern = 'name-date',
  date: Date = new Date(),
  typeId: string | null = null
): string {
  const name = slugifyTitle(title)
  const type = slugifyType(typeId)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`

  switch (pattern) {
    case 'date-name':           return `${dateStr}-${name}`
    case 'name-datetime':       return `${name}-${dateStr}-${timeStr}`
    case 'datetime-name':       return `${dateStr}-${timeStr}-${name}`
    case 'type-name-date':      return `${type}-${name}-${dateStr}`
    case 'name-type-date':      return `${name}-${type}-${dateStr}`
    case 'type-name-datetime':  return `${type}-${name}-${dateStr}-${timeStr}`
    case 'name-type-datetime':  return `${name}-${type}-${dateStr}-${timeStr}`
    case 'name-date':
    default:                    return `${name}-${dateStr}`
  }
}

export interface KanbanColumn {
  id: string
  name: string
  color: string
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', name: 'Backlog', color: '#6b7280' },
  { id: 'todo', name: 'To Do', color: '#3b82f6' },
  { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
  { id: 'review', name: 'Review', color: '#8b5cf6' },
  { id: 'done', name: 'Done', color: '#22c55e' }
]

export interface CardDisplaySettings {
  showPriorityBadges: boolean
  showAssignee: boolean
  showDueDate: boolean
  showLabels: boolean
  showEpic: boolean
  showType: boolean
  showFileName: boolean
  compactMode: boolean
  markdownEditorMode: boolean
  hideScrollbar: boolean
  defaultPriority: Priority
  defaultStatus: FeatureStatus
  defaultFeatureType: string | null
  fontSizeColumnHeader?: string
  fontSizeCardTitle?: string
  fontSizeCardDescription?: string
  fontSizeCardLabel?: string
  fontSizeCardMeta?: string
  fontSizeEditorHeader?: string
  fontSizeEditorBody?: string
  fontSizeEditorMeta?: string
}

// Messages between extension and webview
export type BoardViewMode = 'standard' | 'epic'

export type ColumnSortField = 'priority' | 'dueDate' | 'title' | 'created' | 'modified'
export type ColumnSortDirection = 'asc' | 'desc'

/** Stable id for the "no epic" swim lane (persisted collapse state). */
export const NO_EPIC_LANE_ID = '__no_epic__'

export function epicLaneId(epic: string | null | undefined): string {
  const t = epic?.trim()
  return t ? t : NO_EPIC_LANE_ID
}

export type ExtensionMessage =
  | { type: 'init'; features: Feature[]; columns: KanbanColumn[]; featureTypes: FeatureTypeConfig[]; settings: CardDisplaySettings; collapsedColumns: string[]; boardViewMode: BoardViewMode; collapsedEpics: string[]; locale: string; translations: Record<string, string>; boardPath: string }
  | { type: 'featuresUpdated'; features: Feature[] }
  | { type: 'triggerCreateDialog' }
  | { type: 'featureContent'; featureId: string; content: string; frontmatter: FeatureFrontmatter }

// Frontmatter for editing
export interface FeatureFrontmatter {
  id: string
  status: FeatureStatus
  priority: Priority
  type: string | null
  assignee: string | null
  epic: string | null
  dueDate: string | null
  created: string
  modified: string
  completedAt: string | null
  labels: string[]
  order: string
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'createFeature'; data: { status: FeatureStatus; priority: Priority; type: string | null; content: string; assignee: string | null; epic: string | null; dueDate: string | null; labels: string[] } }
  | { type: 'moveFeature'; featureId: string; newStatus: string; newOrder: number }
  | { type: 'deleteFeature'; featureId: string }
  | { type: 'updateFeature'; featureId: string; updates: Partial<Feature> }
  | { type: 'openFeature'; featureId: string }
  | { type: 'saveFeatureContent'; featureId: string; content: string; frontmatter: FeatureFrontmatter }
  | { type: 'closeFeature' }
  | { type: 'openFile'; featureId: string }
  | { type: 'openSettings' }
  | { type: 'toggleColumnCollapsed'; columnId: string }
  | { type: 'setBoardViewMode'; mode: BoardViewMode }
  | { type: 'toggleEpicCollapsed'; epicKey: string }
  | { type: 'moveAllCards'; sourceColumnId: string; targetColumnId: string; epicLane?: string | null }
  | { type: 'archiveAllCards'; sourceColumnId: string }
  | { type: 'sortColumnCards'; columnId: string; field: ColumnSortField; direction: ColumnSortDirection; epicLane?: string | null }
  | { type: 'renameLabel'; oldName: string; newName: string }
  | { type: 'deleteLabel'; labelName: string }
  | { type: 'refresh' }
  | { type: 'saveBoardColumns'; columns: KanbanColumn[] }
  | { type: 'showErrorMessage'; message: string }
