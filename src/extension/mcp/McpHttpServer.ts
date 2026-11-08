import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { FeatureBoardService } from '../featureBoardService'
import { createKanbanMcpServer } from './createMcpServer'
import { isAllowedHostHeader, isAuthorized } from './httpAuth'

export interface McpHttpServerOptions {
  port: number
  token: string
  boardService: FeatureBoardService
  host?: string
}

export class McpHttpServer {
  private server: http.Server | null = null
  private readonly host: string
  private readonly port: number
  private readonly token: string
  private readonly boardService: FeatureBoardService

  constructor(options: McpHttpServerOptions) {
    this.host = options.host ?? '127.0.0.1'
    this.port = options.port
    this.token = options.token
    this.boardService = options.boardService
  }

  get listeningPort(): number | null {
    if (!this.server) return null
    const addr = this.server.address()
    if (addr && typeof addr === 'object') return addr.port
    return this.port
  }

  get url(): string {
    const port = this.listeningPort ?? this.port
    return `http://127.0.0.1:${port}/mcp`
  }

  async start(): Promise<void> {
    if (this.server) return

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res)
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(this.port, this.host, () => {
        this.server!.off('error', reject)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = null
    if (!server) return
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()))
    })
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const port = this.listeningPort ?? this.port
    const hostHeader = req.headers.host

    if (!isAllowedHostHeader(hostHeader, port)) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Forbidden host' }))
      return
    }

    if (!isAuthorized(req, this.token)) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer'
      })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      // Stateless mode: no long-lived SSE sessions
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    try {
      const body = await readJsonBody(req)
      const mcpServer = createKanbanMcpServer(this.boardService)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      })
      await mcpServer.connect(transport)
      await transport.handleRequest(req, res, body)
      res.on('close', () => {
        void transport.close()
        void mcpServer.close()
      })
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal server error'
          },
          id: null
        }))
      }
    }
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}
