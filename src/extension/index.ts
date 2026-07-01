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
    featuresDir = Array.from(KanbanPanel.openPanels.values())[0]._boardPath
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
  const rawBoardPaths = context.workspaceState.get<string[]>('kanban-markdown.knownBoards', [])
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
    await context.workspaceState.update('kanban-markdown.knownBoards', valid)
  }
  return valid
}

async function registerKnownBoard(context: vscode.ExtensionContext, boardPath: string) {
  const boards = new Set(context.workspaceState.get<string[]>('kanban-markdown.knownBoards', []))
  boards.add(boardPath)
  await context.workspaceState.update('kanban-markdown.knownBoards', Array.from(boards))
}

interface BoardQuickPickItem extends vscode.QuickPickItem {
  boardPath: string
}

export function activate(context: vscode.ExtensionContext) {
  loadBundle(context.extensionPath)
  // Sidebar webview in the activity bar
  const sidebarProvider = new SidebarViewProvider(context.extensionUri, context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, sidebarProvider)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-markdown.open', async () => {
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
          label: "$(folder-opened) Open folder...",
          description: "Select another folder in the workspace to open as a board",
          path: "CHOOSE_FOLDER"
        })
        items.push({
          label: "$(trash) Clear Board History...",
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
            await context.workspaceState.update('kanban-markdown.knownBoards', updatedPaths)
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
      const panel = KanbanPanel.openPanels.get(boardPath)
      if (panel) {
        panel.onDispose(() => {
          if (KanbanPanel.openPanels.size === 0) {
            sidebarProvider.setBoardOpen(false)
          }
        })
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-markdown.openDirectory', async (uri: vscode.Uri) => {
      if (uri && uri.scheme === 'file') {
        const boardPath = uri.fsPath
        const wasOpen = KanbanPanel.openPanels.size > 0
        KanbanPanel.createOrShow(context.extensionUri, context, boardPath)
        if (!wasOpen) {
          sidebarProvider.setBoardOpen(true)
        }
        await registerKnownBoard(context, boardPath)
        const panel = KanbanPanel.openPanels.get(boardPath)
        if (panel) {
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
    vscode.commands.registerCommand('kanban-markdown.addFeature', () => {
      createFeatureFromPrompts(context)
    })
  )



  // If a panel already exists, revive it
  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(KanbanPanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
        const boardPath = state?.boardPath
        if (boardPath) {
          KanbanPanel.revive(webviewPanel, context.extensionUri, context, boardPath)
          sidebarProvider.setBoardOpen(true)
          const panel = KanbanPanel.openPanels.get(boardPath)
          panel?.onDispose(() => {
            if (KanbanPanel.openPanels.size === 0) {
              sidebarProvider.setBoardOpen(false)
            }
          })
        } else {
          const boardPaths = await getValidKnownBoards(context)
          let fullPath: string
          if (boardPaths.length > 0) {
            fullPath = boardPaths[0]
          } else {
            webviewPanel.dispose()
            return
          }
          KanbanPanel.revive(webviewPanel, context.extensionUri, context, fullPath)
          sidebarProvider.setBoardOpen(true)
          const panel = KanbanPanel.openPanels.get(fullPath)
          panel?.onDispose(() => {
            if (KanbanPanel.openPanels.size === 0) {
              sidebarProvider.setBoardOpen(false)
            }
          })
        }
      }
    })
  }
}

export function deactivate() {}
