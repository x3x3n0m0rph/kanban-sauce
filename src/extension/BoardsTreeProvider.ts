import * as vscode from 'vscode'
import * as path from 'path'

export class BoardsTreeProvider implements vscode.TreeDataProvider<BoardTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<BoardTreeItem | undefined | void> = new vscode.EventEmitter<BoardTreeItem | undefined | void>()
  readonly onDidChangeTreeData: vscode.Event<BoardTreeItem | undefined | void> = this._onDidChangeTreeData.event

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: BoardTreeItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: BoardTreeItem): Thenable<BoardTreeItem[]> {
    if (element) {
      return Promise.resolve([])
    }

    const knownBoards = this.context.workspaceState.get<string[]>('kanban-sauce.knownBoards', [])
    const items = knownBoards.map(boardPath => {
      return new BoardTreeItem(
        path.basename(boardPath),
        boardPath,
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'kanban-sauce.openBoardFromTree',
          title: 'Open Board',
          arguments: [boardPath]
        }
      )
    })
    return Promise.resolve(items)
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
