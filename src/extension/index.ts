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

async function createFeatureFromPrompts(): Promise<void> {
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
  const config = vscode.workspace.getConfiguration('kanban-markdown')
  const featuresDirectory = config.get<string>('featuresDirectory') || '.devtool/features'
  const featuresDir = path.join(workspaceFolders[0].uri.fsPath, featuresDirectory)
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
    vscode.commands.registerCommand('kanban-markdown.open', () => {
      const workspaceFolders = vscode.workspace.workspaceFolders
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(t('ext.noWorkspace'))
        return
      }
      const config = vscode.workspace.getConfiguration('kanban-markdown')
      const defaultDir = config.get<string>('featuresDirectory') || '.devtool/features'
      const boardPath = path.join(workspaceFolders[0].uri.fsPath, defaultDir)

      const wasOpen = KanbanPanel.openPanels.size > 0
      KanbanPanel.createOrShow(context.extensionUri, context, boardPath)
      if (!wasOpen) {
        sidebarProvider.setBoardOpen(true)
      }
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
    vscode.commands.registerCommand('kanban-markdown.selectBoard', async () => {
      const boardPaths = context.workspaceState.get<string[]>('kanban-markdown.knownBoards', [])
      if (boardPaths.length === 0) {
        vscode.window.showInformationMessage("No kanban boards registered yet. Right-click a folder to open one!")
        return
      }

      const items: BoardQuickPickItem[] = boardPaths.map(p => {
        const relativePath = vscode.workspace.asRelativePath(p)
        return {
          label: path.basename(p),
          description: relativePath,
          boardPath: p
        }
      })

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a Kanban Board to open"
      })

      if (selected) {
        const fullPath = selected.boardPath
        const wasOpen = KanbanPanel.openPanels.size > 0
        KanbanPanel.createOrShow(context.extensionUri, context, fullPath)
        if (!wasOpen) {
          sidebarProvider.setBoardOpen(true)
        }
        const panel = KanbanPanel.openPanels.get(fullPath)
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
      createFeatureFromPrompts()
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
          const config = vscode.workspace.getConfiguration('kanban-markdown')
          const defaultDir = config.get<string>('featuresDirectory') || '.devtool/features'
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
          const fullPath = workspaceRoot ? path.join(workspaceRoot, defaultDir) : defaultDir
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
