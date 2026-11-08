import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { isAllowedHostHeader, isAuthorized, extractBearerToken } from '../../../src/extension/mcp/httpAuth'
import { McpHttpServer } from '../../../src/extension/mcp/McpHttpServer'
import type { FeatureBoardService } from '../../../src/extension/featureBoardService'

describe('httpAuth helpers', () => {
  it('allows localhost hosts with matching port', () => {
    expect(isAllowedHostHeader('127.0.0.1:3847', 3847)).toBe(true)
    expect(isAllowedHostHeader('localhost:3847', 3847)).toBe(true)
    expect(isAllowedHostHeader('127.0.0.1', 3847)).toBe(true)
  })

  it('rejects non-local hosts', () => {
    expect(isAllowedHostHeader('evil.example:3847', 3847)).toBe(false)
    expect(isAllowedHostHeader(undefined, 3847)).toBe(false)
  })

  it('extracts bearer token', () => {
    const req = { headers: { authorization: 'Bearer secret-token' } } as http.IncomingMessage
    expect(extractBearerToken(req)).toBe('secret-token')
    expect(isAuthorized(req, 'secret-token')).toBe(true)
    expect(isAuthorized(req, 'other')).toBe(false)
  })
})

describe('McpHttpServer security', () => {
  let server: McpHttpServer
  let port: number

  const boardService = {
    listBoards: vi.fn().mockResolvedValue([]),
    listFeatures: vi.fn().mockResolvedValue([]),
    resolveBoard: vi.fn().mockResolvedValue('/board'),
    searchFeatures: vi.fn().mockResolvedValue([]),
    createFeature: vi.fn(),
    setFeatureStatus: vi.fn(),
    getBoard: vi.fn().mockResolvedValue({ path: '/board', name: 'board', columns: [] })
  } as unknown as FeatureBoardService

  beforeEach(async () => {
    server = new McpHttpServer({
      port: 0,
      token: 'test-token',
      boardService
    })
    await server.start()
    port = server.listeningPort!
  })

  afterEach(async () => {
    await server.stop()
  })

  async function post(headers: Record<string, string>, body?: unknown) {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const text = await res.text()
    return { status: res.status, text }
  }

  it('returns 401 without Authorization', async () => {
    const res = await post({ Host: `127.0.0.1:${port}` })
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong token', async () => {
    const res = await post({
      Host: `127.0.0.1:${port}`,
      Authorization: 'Bearer wrong'
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for foreign Host header', async () => {
    // Undici/fetch always sets Host to the request URL host, so use raw http
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/mcp',
        method: 'POST',
        headers: {
          Host: 'evil.example',
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': 2
        }
      }, res => {
        res.resume()
        resolve(res.statusCode || 0)
      })
      req.on('error', reject)
      req.write('{}')
      req.end()
    })
    expect(status).toBe(403)
  })

  it('accepts initialize with valid token', async () => {
    const res = await post(
      {
        Host: `127.0.0.1:${port}`,
        Authorization: 'Bearer test-token'
      },
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '1.0.0' }
        }
      }
    )
    expect(res.status).toBe(200)
    expect(res.text).toContain('kanban-sauce')
  })
})
