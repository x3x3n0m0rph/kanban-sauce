import * as vscode from 'vscode'
import * as path from 'path'
import { KanbanPanel } from './KanbanPanel'
import { getTitleFromContent } from '../shared/types'
import { t } from './l10n'

export class InProgressTreeProvider implements vscode.TreeDataProvider<FeatureTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FeatureTreeItem | undefined | void> = new vscode.EventEmitter<FeatureTreeItem | undefined | void>()
  readonly onDidChangeTreeData: vscode.Event<FeatureTreeItem | undefined | void> = this._onDidChangeTreeData.event

  private _fileWatcher?: vscode.FileSystemWatcher
  private _debounceTimer?: NodeJS.Timeout

  constructor(private context: vscode.ExtensionContext) {
    this._setupFileWatcher()
    KanbanPanel.onActivePanelChangedCallbacks.add(() => {
      this.refresh()
    })
  }

  refresh(): void {
    this._setupFileWatcher()
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: FeatureTreeItem): vscode.TreeItem {
    return element
  }

  async getChildren(element?: FeatureTreeItem): Promise<FeatureTreeItem[]> {
    if (element) {
      return []
    }

    const featuresDir = this._getFeaturesDir()
    await vscode.commands.executeCommand('setContext', 'kanban-sauce.activeBoard', !!featuresDir)

    if (!featuresDir) {
      return []
    }

    const features = await this._loadInProgressFeatures(featuresDir)
    if (features.length === 0) {
      return []
    }
    
    const sortType = this.context.workspaceState.get<string>('kanban-sauce.inProgressSort', 'name')
    if (sortType === 'modified') {
      features.sort((a, b) => b.mtime - a.mtime)
    } else {
      features.sort((a, b) => a.title.localeCompare(b.title))
    }

    const inProgressColor = this._getInProgressColor()

    return features.map(f => {
      const item = new FeatureTreeItem(
        f.title,
        f.id,
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'kanban-sauce.openFeatureFromTree',
          title: 'Open Feature',
          arguments: [f.id]
        }
      )
      // Small yellow circle icon to represent in-progress status
      // We can use a ThemeIcon for now, or just rely on color logic if we had custom icons
      item.iconPath = new vscode.ThemeIcon('circle-filled')
      return item
    })
  }

  private _getFeaturesDir(): string | null {
    if (KanbanPanel.activePanel) {
      return KanbanPanel.activePanel._boardPath
    }
    return null
  }

  private _setupFileWatcher(): void {
    if (this._fileWatcher) {
      this._fileWatcher.dispose()
    }

    const featuresDir = this._getFeaturesDir()
    if (!featuresDir) return

    const pattern = new vscode.RelativePattern(featuresDir, '**/*.md')
    this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

    const handleChange = () => {
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => this.refresh(), 300)
    }

    this._fileWatcher.onDidChange(handleChange)
    this._fileWatcher.onDidCreate(handleChange)
    this._fileWatcher.onDidDelete(handleChange)
  }

  private async _loadInProgressFeatures(featuresDir: string): Promise<{ id: string, title: string, mtime: number }[]> {
    const features: { id: string, title: string, mtime: number }[] = []

    try {
      const rootEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(featuresDir))
      for (const [file, fileType] of rootEntries) {
        if (fileType !== vscode.FileType.File || !file.endsWith('.md')) continue
        const filePath = path.join(featuresDir, file)
        try {
          const uri = vscode.Uri.file(filePath)
          const stat = await vscode.workspace.fs.stat(uri)
          const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))
          const parsed = this._parseFrontmatter(content, file)
          if (parsed && parsed.status === 'in-progress') {
            features.push({ ...parsed, mtime: stat.mtime })
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Root directory may not exist
    }

    return features
  }

  private _parseFrontmatter(content: string, filename: string): { id: string, title: string, status: string } | null {
    content = content.replace(/\r\n/g, '\n')
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!match) return null

    const fm = match[1]
    const body = match[2] || ''

    const getValue = (key: string): string => {
      const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
      if (!m) return ''
      const v = m[1].trim().replace(/^["']|["']$/g, '')
      return v === 'null' ? '' : v
    }

    const id = getValue('id') || path.basename(filename, '.md')
    const status = getValue('status') || 'backlog'
    const title = getTitleFromContent(body)

    return { id, title, status }
  }

  private _getInProgressColor(): string {
    const config = vscode.workspace.getConfiguration('kanban-sauce')
    const columns = config.get<any[]>('columns', [])
    const inProgressCol = columns.find(c => c.id === 'in-progress')
    return inProgressCol ? inProgressCol.color : '#f59e0b'
  }
}

class FeatureTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly featureId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState)
    this.tooltip = this.label
  }
}
