import * as vscode from 'vscode'
import * as path from 'path'

export class BoardsTreeProvider implements vscode.TreeDataProvider<BoardTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<BoardTreeItem | undefined | void> = new vscode.EventEmitter<BoardTreeItem | undefined | void>()
  readonly onDidChangeTreeData: vscode.Event<BoardTreeItem | undefined | void> = this._onDidChangeTreeData.event

  private _watchers: vscode.FileSystemWatcher[] = []
  private _debounceTimer?: NodeJS.Timeout

  constructor(private context: vscode.ExtensionContext) {
    this._setupFileWatchers()
  }

  refresh(): void {
    this._setupFileWatchers()
    this._onDidChangeTreeData.fire()
  }

  private _setupFileWatchers(): void {
    // Clean up old watchers
    for (const watcher of this._watchers) {
      watcher.dispose()
    }
    this._watchers = []

    const knownBoards = this.context.workspaceState.get<string[]>('kanban-sauce.knownBoards', [])
    if (knownBoards.length === 0) return

    const handleChange = () => {
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => this._onDidChangeTreeData.fire(), 300)
    }

    for (const boardPath of knownBoards) {
      const pattern = new vscode.RelativePattern(boardPath, '**/*.md')
      const watcher = vscode.workspace.createFileSystemWatcher(pattern)
      
      watcher.onDidChange(handleChange)
      watcher.onDidCreate(handleChange)
      watcher.onDidDelete(handleChange)

      this._watchers.push(watcher)
    }
  }

  getTreeItem(element: BoardTreeItem): vscode.TreeItem {
    return element
  }

  async getChildren(element?: BoardTreeItem): Promise<BoardTreeItem[]> {
    if (element) {
      return []
    }

    const knownBoards = this.context.workspaceState.get<string[]>('kanban-sauce.knownBoards', [])
    const sortType = this.context.workspaceState.get<string>('kanban-sauce.boardsSort', 'name')
    const sortDir = this.context.workspaceState.get<string>('kanban-sauce.boardsSortDir', 'asc')

    let boardData = await Promise.all(knownBoards.map(async boardPath => {
      let mtime = 0
      if (sortType === 'modified') {
        try {
          const dirStat = await vscode.workspace.fs.stat(vscode.Uri.file(boardPath))
          mtime = dirStat.mtime
          
          const rootEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(boardPath))
          for (const [file, fileType] of rootEntries) {
            if (fileType === vscode.FileType.File && file.endsWith('.md')) {
              try {
                const fileStat = await vscode.workspace.fs.stat(vscode.Uri.file(path.join(boardPath, file)))
                if (fileStat.mtime > mtime) {
                  mtime = fileStat.mtime
                }
              } catch {
                // ignore
              }
            }
          }
        } catch {
          // ignore
        }
      }
      return { boardPath, mtime, name: path.basename(boardPath) }
    }))

    if (sortType === 'modified') {
      boardData.sort((a, b) => sortDir === 'asc' ? a.mtime - b.mtime : b.mtime - a.mtime)
    } else {
      boardData.sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
    }

    const items = boardData.map(data => {
      return new BoardTreeItem(
        data.name,
        data.boardPath,
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'kanban-sauce.openBoardFromTree',
          title: 'Open Board',
          arguments: [data.boardPath]
        }
      )
    })
    return items
  }
}

class BoardTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly boardPath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState)
    this.tooltip = this.boardPath
    this.description = vscode.workspace.asRelativePath(this.boardPath)
    this.iconPath = new vscode.ThemeIcon('folder')
  }
}
