import type { IncomingMessage } from 'node:http'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

export function isAllowedHostHeader(hostHeader: string | undefined, port: number): boolean {
  if (!hostHeader) return false
  const host = hostHeader.trim().toLowerCase()
  const hostname = host.startsWith('[')
    ? host.slice(0, host.indexOf(']') + 1)
    : host.split(':')[0]

  if (!LOCAL_HOSTS.has(hostname)) return false

  const expectedPorts = new Set([String(port), '80', '443'])
  if (hostname.startsWith('[')) {
    const after = host.slice(host.indexOf(']') + 1)
    if (after.startsWith(':')) {
      return expectedPorts.has(after.slice(1)) || after.slice(1) === String(port)
    }
    return true
  }
  const parts = host.split(':')
  if (parts.length === 1) return true
  return parts[1] === String(port)
}

export function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function isAuthorized(req: IncomingMessage, expectedToken: string): boolean {
  const token = extractBearerToken(req)
  return !!token && token === expectedToken
}
