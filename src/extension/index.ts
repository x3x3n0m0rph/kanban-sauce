import * as vscode from 'vscode'
import * as path from 'path'
import { generateKeyBetween } from 'fractional-indexing'
import { KanbanPanel } from './KanbanPanel'
import { SidebarViewProvider } from './SidebarViewProvider'
import { generateFeatureFilename } from '../shared/types'
import { serializeFeature } from '../shared/featureFrontmatter'
import type { Feature, FeatureStatus, Priority } from '../shared/types'
import { ensureStatusSubfolders, getFeatureFilePath } from './featureFileUtils'
import { t, loadBundle } from './l10n'
import { BoardsTreeProvider } from './BoardsTreeProvider'
import { InProgressTreeProvider } from './InProgressTreeProvider'

let boardsProvider: BoardsTreeProvider | undefined

interface StatusQuickPickItem extends vscode.QuickPickItem {
  statusValue: FeatureStatus
}

interface PriorityQuickPickItem extends vscode.QuickPickItem {
  priorityValue: Priority
}

async function createFeatureFromPrompts(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(t('ext.noWorkspace'))
    return
  }

  // Ask for title
  const title = await vscode.window.showInputBox({
    prompt: t('ext.featureTitle'),
    placeHolder: t('ext.featureTitlePlaceholder')
  })
  if (!title) return

  // Ask for status
  const statusItems: StatusQuickPickItem[] = [
    { label: t('status.backlog'), description: t('status.backlog.description'), statusValue: 'backlog' },
    { label: t('status.todo'), description: t('status.todo.description'), statusValue: 'todo' },
    { label: t('status.inProgress'), description: t('status.inProgress.description'), statusValue: 'in-progress' },
    { label: t('status.review'), description: t('status.review.description'), statusValue: 'review' },
    { label: t('status.done'), description: t('status.done.description'), statusValue: 'done' }
  ]
  const statusPick = await vscode.window.showQuickPick(statusItems, {
    placeHolder: t('ext.selectStatus')
  })
  if (!statusPick) return

  const status = statusPick.statusValue

  // Ask for priority
  const priorityItems: PriorityQuickPickItem[] = [
    { label: t('priority.critical'), description: t('priority.critical.description'), priorityValue: 'critical' },
    { label: t('priority.high'), description: t('priority.high.description'), priorityValue: 'high' },
    { label: t('priority.medium'), description: t('priority.medium.description'), priorityValue: 'medium' },
    { label: t('priority.low'), description: t('priority.low.description'), priorityValue: 'low' }
  ]
  const priorityPick = await vscode.window.showQuickPick(priorityItems, {
    placeHolder: t('ext.selectPriority')
  })
  if (!priorityPick) return

  const priority = priorityPick.priorityValue

  // Ask for description (optional)
  const description = await vscode.window.showInputBox({
    prompt: t('ext.descriptionOptional'),
    placeHolder: t('ext.descriptionPlaceholder')
  })

  // Create the feature file
  let featuresDir: string
  if (KanbanPanel.activePanel) {
    featuresDir = KanbanPanel.activePanel._boardPath
  } else if (KanbanPanel.openPanels.size === 1) {
    featuresDir = Array.from(KanbanPanel.openPanels.keys())[0]
  } else {
    const boardPaths = await getValidKnownBoards(context)
    if (boardPaths.length > 0) {
      const items = boardPaths.map(p => ({
        label: path.basename(p),
        description: vscode.workspace.asRelativePath(p),
        path: p
      }))
      items.push({
        label: "$(folder-opened) Choose folder...",
        description: "Select another folder in the workspace",
        path: "CHOOSE_FOLDER"
      })
      const selectedBoard = await vscode.window.showQuickPick(items, {
        placeHolder: "Select which Kanban Board to add the feature to"
      })
      if (!selectedBoard) return
      if (selectedBoard.path === 'CHOOSE_FOLDER') {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: "Select Board Folder"
        })
        if (!uris || uris.length === 0) return
        featuresDir = uris[0].fsPath
      } else {
        featuresDir = selectedBoard.path
      }
    } else {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Board Folder"
      })
      if (!uris || uris.length === 0) return
      featuresDir = uris[0].fsPath
    }
  }
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(featuresDir))
  await ensureStatusSubfolders(featuresDir)

  const filename = generateFeatureFilename(title)
  const now = new Date().toISOString()

  // Build content with title as first # heading
  const content = `# ${title}${description ? '\n\n' + description : ''}`

  const feature: Feature = {
    id: filename,
    status,
    priority,
    assignee: null,
    epic: null,
    dueDate: null,
    created: now,
    modified: now,
    completedAt: status === 'done' ? now : null,
    labels: [],
    order: generateKeyBetween(null, null),
    content,
    filePath: getFeatureFilePath(featuresDir, status, filename)
  }

  const fileContent = serializeFeature(feature)
  await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(fileContent))

  // Open the created file
  const document = await vscode.workspace.openTextDocument(feature.filePath)
  await vscode.window.showTextDocument(document)

  vscode.window.showInformationMessage(t('ext.createdFeature', { title }))
}

async function getValidKnownBoards(context: vscode.ExtensionContext): Promise<string[]> {
  const rawBoardPaths = context.workspaceState.get<string[]>('kanban-sauce.knownBoards', [])
  const checks = await Promise.all(
    rawBoardPaths.map(async p => {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(p))
        return { path: p, exists: true }
      } catch {
        return { path: p, exists: false }
      }
    })
  )
  const valid = checks.filter(item => item.exists).map(item => item.path)
  if (valid.length !== rawBoardPaths.length) {
    await context.workspaceState.update('kanban-sauce.knownBoards', valid)
  }
  return valid
}

async function registerKnownBoard(context: vscode.ExtensionContext, boardPath: string) {
  const boards = new Set(context.workspaceState.get<string[]>('kanban-sauce.knownBoards', []))
  boards.add(boardPath)
  await context.workspaceState.update('kanban-sauce.knownBoards', Array.from(boards))
  SidebarViewProvider.currentProvider?.refreshBoards()
  boardsProvider?.refresh()
}

export function activate(context: vscode.ExtensionContext) {
  loadBundle(context.extensionPath)
  // Sidebar webview in the activity bar
  const sidebarProvider = new SidebarViewProvider(context.extensionUri, context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, sidebarProvider)
  )

  boardsProvider = new BoardsTreeProvider(context)
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('kanban-sauce.boardsView', boardsProvider)
  )

  const inProgressProvider = new InProgressTreeProvider(context)
  const inProgressTreeView = vscode.window.createTreeView('kanban-sauce.inProgressView', {
    treeDataProvider: inProgressProvider
  })
  inProgressProvider.setTreeView(inProgressTreeView)
  context.subscriptions.push(inProgressTreeView)

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-sauce.open', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(t('ext.noWorkspace'))
        return
      }

      // Let the user choose a board to open (allowing multiple panels open)
      const boardPaths = await getValidKnownBoards(context)
      let boardPath: string
      if (boardPaths.length > 0) {
        const items = boardPaths.map(p => ({
          label: path.basename(p),
          description: vscode.workspace.asRelativePath(p),
          path: p
        }))
        items.push({
          label: "$(folder-opened) Open board...",
          description: "Select another folder in the workspace to open as a board",
          path: "CHOOSE_FOLDER"
        })
        items.push({
          label: "$(trash) Remove board...",
          description: "Remove boards from your history list",
          path: "CLEAR_HISTORY"
        })
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a Kanban Board to open"
        })
        if (!selected) return
        if (selected.path === 'CLEAR_HISTORY') {
          const toRemove = await vscode.window.showQuickPick(boardPaths.map(p => ({
            label: path.basename(p),
            description: vscode.workspace.asRelativePath(p),
            path: p
          })), {
            placeHolder: "Select Kanban Board history items to remove",
            canPickMany: true
          })
          if (toRemove && toRemove.length > 0) {
            const pathsToRemove = new Set(toRemove.map(item => item.path))
            const updatedPaths = boardPaths.filter(p => !pathsToRemove.has(p))
            await context.workspaceState.update('kanban-sauce.knownBoards', updatedPaths)
            SidebarViewProvider.currentProvider?.refreshBoards()
            boardsProvider?.refresh()
            vscode.window.showInformationMessage("Selected boards removed from history.")
          }
          return
        }
        if (selected.path === 'CHOOSE_FOLDER') {
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "Open Board"
          })
          if (!uris || uris.length === 0) return
          boardPath = uris[0].fsPath
        } else {
          boardPath = selected.path
        }
      } else {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: "Open Board"
        })
        if (!uris || uris.length === 0) return
        boardPath = uris[0].fsPath
      }

      const wasOpen = KanbanPanel.openPanels.size > 0
      KanbanPanel.createOrShow(context.extensionUri, context, boardPath)
      if (!wasOpen) {
        sidebarProvider.setBoardOpen(true)
      }
      await registerKnownBoard(context, boardPath)
      const panels = KanbanPanel.openPanels.get(boardPath)
      if (panels) {
        // We can just add the listener to all panels for this board (safe if added multiple times if we're careful, but we only need one to trigger the check)
        for (const panel of panels) {
          panel.onDispose(() => {
            if (KanbanPanel.openPanels.size === 0) {
              sidebarProvider.setBoardOpen(false)
            }
          })
        }
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-sauce.openDirectory', async (uri: vscode.Uri) => {
      if (uri && uri.scheme === 'file') {
        const boardPath = uri.fsPath
        const wasOpen = KanbanPanel.openPanels.size > 0
        KanbanPanel.createOrShow(context.extensionUri, context, boardPath)
        if (!wasOpen) {
          sidebarProvider.setBoardOpen(true)
        }
        await registerKnownBoard(context, boardPath)
        const panels = KanbanPanel.openPanels.get(boardPath)
        if (panels) {
          for (const panel of panels) {
            panel.onDispose(() => {
              if (KanbanPanel.openPanels.size === 0) {
                sidebarProvider.setBoardOpen(false)
              }
            })
          }
        }
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-sauce.addFeature', () => {
      createFeatureFromPrompts(context)
    })
  )

  context.subscriptions.push(
        vscode.commands.registerCommand('kanban-sauce.boards.renameBoard', async (item) => {
      if (!item || !item.boardPath) return
      
      const newName = await vscode.window.showInputBox({
        prompt: "Enter a new display name for this Kanban Board",
        value: typeof item.label === 'string' ? item.label : item.label.label
      })
      
      if (newName) {
        const boardAliases = context.workspaceState.get<Record<string, string>>('kanban-sauce.boardAliases', {})
        boardAliases[item.boardPath] = newName
        await context.workspaceState.update('kanban-sauce.boardAliases', boardAliases)
        boardsProvider?.refresh()
      }
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.removeBoard', async (item) => {
      if (!item || !item.boardPath) return
      
      const knownBoards = context.workspaceState.get<string[]>('kanban-sauce.knownBoards', [])
      const updatedPaths = knownBoards.filter(p => p !== item.boardPath)
      await context.workspaceState.update('kanban-sauce.knownBoards', updatedPaths)
      
      const boardAliases = context.workspaceState.get<Record<string, string>>('kanban-sauce.boardAliases', {})
      if (boardAliases[item.boardPath]) {
        delete boardAliases[item.boardPath]
        await context.workspaceState.update('kanban-sauce.boardAliases', boardAliases)
      }
      
      const panels = KanbanPanel.openPanels.get(item.boardPath)
      if (panels) {
        Array.from(panels).forEach(p => p.dispose())
      }
      
      const activeBoard = context.workspaceState.get<string>('kanban-sauce.activeBoard')
      if (activeBoard === item.boardPath) {
        await context.workspaceState.update('kanban-sauce.activeBoard', undefined)
        vscode.commands.executeCommand('setContext', 'kanban-sauce.activeBoard', false)
      }
      
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.openBoardFromTree', (boardPath: string) => {
      vscode.commands.executeCommand('kanban-sauce.openDirectory', vscode.Uri.file(boardPath))
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-sauce.openFeatureFromTree', (featureId: string) => {
      // First try to open the active panel or single panel
      if (KanbanPanel.activePanel) {
        KanbanPanel.activePanel.openFeature(featureId)
      } else if (KanbanPanel.openPanels.size === 1) {
        Array.from(KanbanPanel.openPanels.values())[0]?.values().next().value?.openFeature(featureId)
      } else {
        vscode.window.showErrorMessage('No active Kanban board to open this feature in.')
      }
    })
  )

  // Set default sorting states and context
  const boardsSort = context.workspaceState.get<string>('kanban-sauce.boardsSort', 'name')
  vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSort', boardsSort)

  const inProgressSort = context.workspaceState.get<string>('kanban-sauce.inProgressSort', 'name')
  vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSort', inProgressSort)

  const boardsSortDir = context.workspaceState.get<string>('kanban-sauce.boardsSortDir', 'asc')
  vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSortDir', boardsSortDir)

  const inProgressSortDir = context.workspaceState.get<string>('kanban-sauce.inProgressSortDir', 'asc')
  vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSortDir', inProgressSortDir)


  context.subscriptions.push(
        vscode.commands.registerCommand('kanban-sauce.boards.sortAscending', () => {
      context.workspaceState.update('kanban-sauce.boardsSortDir', 'asc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSortDir', 'asc')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.sortAscending.checked', () => {
      context.workspaceState.update('kanban-sauce.boardsSortDir', 'asc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSortDir', 'asc')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.sortDescending', () => {
      context.workspaceState.update('kanban-sauce.boardsSortDir', 'desc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSortDir', 'desc')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.sortDescending.checked', () => {
      context.workspaceState.update('kanban-sauce.boardsSortDir', 'desc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSortDir', 'desc')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortAscending', () => {
      context.workspaceState.update('kanban-sauce.inProgressSortDir', 'asc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSortDir', 'asc')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortAscending.checked', () => {
      context.workspaceState.update('kanban-sauce.inProgressSortDir', 'asc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSortDir', 'asc')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortDescending', () => {
      context.workspaceState.update('kanban-sauce.inProgressSortDir', 'desc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSortDir', 'desc')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortDescending.checked', () => {
      context.workspaceState.update('kanban-sauce.inProgressSortDir', 'desc')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSortDir', 'desc')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.sortByName', () => {
      context.workspaceState.update('kanban-sauce.boardsSort', 'name')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSort', 'name')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.sortByName.checked', () => {
      context.workspaceState.update('kanban-sauce.boardsSort', 'name')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSort', 'name')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.sortByModified', () => {
      context.workspaceState.update('kanban-sauce.boardsSort', 'modified')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSort', 'modified')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.boards.sortByModified.checked', () => {
      context.workspaceState.update('kanban-sauce.boardsSort', 'modified')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.boardsSort', 'modified')
      boardsProvider?.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortByName', () => {
      context.workspaceState.update('kanban-sauce.inProgressSort', 'name')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSort', 'name')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortByName.checked', () => {
      context.workspaceState.update('kanban-sauce.inProgressSort', 'name')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSort', 'name')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortByModified', () => {
      context.workspaceState.update('kanban-sauce.inProgressSort', 'modified')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSort', 'modified')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.inProgress.sortByModified.checked', () => {
      context.workspaceState.update('kanban-sauce.inProgressSort', 'modified')
      vscode.commands.executeCommand('setContext', 'kanban-sauce.inProgressSort', 'modified')
      inProgressProvider.refresh()
    }),
    vscode.commands.registerCommand('kanban-sauce.changeSidebarColumn', async () => {
      const config = vscode.workspace.getConfiguration('kanban-sauce')
      const columns = config.get<{ id: string; name: string }[]>('columns', [])
      const items = columns.map(c => ({
        label: c.name,
        description: c.id
      }))
      const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a column to display' })
      if (selected) {
        context.workspaceState.update('kanban-sauce.sidebarColumn', selected.description)
        inProgressProvider.refresh()
      }
    })
  )
}

export function deactivate() {}
