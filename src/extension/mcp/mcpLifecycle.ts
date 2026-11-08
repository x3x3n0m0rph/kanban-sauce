import * as crypto from 'node:crypto'
import * as vscode from 'vscode'
import { FeatureBoardService } from '../featureBoardService'
import { getActiveBoardPath } from '../boardConfig'
import { McpHttpServer } from './McpHttpServer'

const SECRET_TOKEN_KEY = 'kanban-sauce.mcp.token'

export class McpLifecycle {
  private server: McpHttpServer | null = null
  private readonly output: vscode.OutputChannel
  private boardService: FeatureBoardService | null = null

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly getKnownBoards: () => Promise<string[]>
  ) {
    this.output = vscode.window.createOutputChannel('Kanban Sauce MCP')
    context.subscriptions.push(this.output)
  }

  async syncFromConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('kanban-sauce')
    const enabled = config.get<boolean>('mcp.enabled', false)
    if (!enabled) {
      await this.stop()
      return
    }

    const port = config.get<number>('mcp.port', 3847)
    const token = await this.resolveToken()
    await this.restart(port, token)
  }

  async copyConnectionInfo(): Promise<void> {
    const config = vscode.workspace.getConfiguration('kanban-sauce')
    if (!config.get<boolean>('mcp.enabled', false)) {
      vscode.window.showWarningMessage('Kanban Sauce MCP is disabled. Enable kanban-sauce.mcp.enabled first.')
      return
    }
    const token = await this.resolveToken()
    const port = this.server?.listeningPort ?? config.get<number>('mcp.port', 3847)
    const url = `http://127.0.0.1:${port}/mcp`
    const text = [
      `URL: ${url}`,
      `Authorization: Bearer ${token}`,
      '',
      'Example MCP client config:',
      JSON.stringify({
        mcpServers: {
          'kanban-sauce': {
            url,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }, null, 2)
    ].join('\n')
    await vscode.env.clipboard.writeText(text)
    vscode.window.showInformationMessage('Kanban Sauce MCP connection info copied to clipboard.')
  }

  async stop(): Promise<void> {
    if (!this.server) return
    try {
      await this.server.stop()
      this.output.appendLine('MCP server stopped.')
    } catch (e) {
      this.output.appendLine(`Failed to stop MCP server: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      this.server = null
    }
  }

  private async restart(port: number, token: string): Promise<void> {
    await this.stop()
    this.boardService = new FeatureBoardService(
      vscode.workspace.fs,
      () => getActiveBoardPath(),
      () => this.getKnownBoards()
    )
    this.server = new McpHttpServer({
      port,
      token,
      boardService: this.boardService
    })
    try {
      await this.server.start()
      this.output.appendLine(`MCP server listening on ${this.server.url}`)
    } catch (e) {
      this.server = null
      const message = e instanceof Error ? e.message : String(e)
      this.output.appendLine(`Failed to start MCP server: ${message}`)
      vscode.window.showErrorMessage(`Kanban Sauce MCP failed to start: ${message}`)
    }
  }

  private async resolveToken(): Promise<string> {
    const config = vscode.workspace.getConfiguration('kanban-sauce')
    const configured = config.get<string>('mcp.token', '')?.trim()
    if (configured) return configured

    const stored = await this.context.secrets.get(SECRET_TOKEN_KEY)
    if (stored) return stored

    const generated = crypto.randomBytes(24).toString('base64url')
    await this.context.secrets.store(SECRET_TOKEN_KEY, generated)
    this.output.appendLine('Generated MCP bearer token (stored in Secret Storage). Use "Copy MCP Connection Info" to retrieve it.')
    return generated
  }
}
