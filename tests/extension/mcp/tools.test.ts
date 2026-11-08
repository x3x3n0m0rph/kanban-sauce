import { describe, it, expect, vi } from 'vitest'
import { createKanbanToolHandlers } from '../../../src/extension/mcp/createMcpServer'
import type { FeatureBoardService } from '../../../src/extension/featureBoardService'
import type { Feature } from '../../../src/shared/types'

function makeFeature(id: string): Feature {
  return {
    id,
    status: 'todo',
    priority: 'medium',
    type: 'feature',
    assignee: null,
    epic: null,
    dueDate: null,
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    labels: [],
    order: 'a0',
    content: `# ${id}`,
    filePath: `/board/${id}.md`
  }
}

describe('createKanbanToolHandlers', () => {
  it('list_tasks returns summarized tasks', async () => {
    const boardService = {
      listFeatures: vi.fn().mockResolvedValue([makeFeature('one')]),
      resolveBoard: vi.fn().mockResolvedValue('/board')
    } as unknown as FeatureBoardService

    const handlers = createKanbanToolHandlers(boardService)
    const result = await handlers.list_tasks({ status: 'todo' })
    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toContain('"id": "one"')
    expect(boardService.listFeatures).toHaveBeenCalledWith(undefined, 'todo')
  })

  it('create_task builds content from title', async () => {
    const created = makeFeature('new-task')
    const boardService = {
      createFeature: vi.fn().mockResolvedValue(created)
    } as unknown as FeatureBoardService

    const handlers = createKanbanToolHandlers(boardService)
    const result = await handlers.create_task({ title: 'New Task', status: 'backlog' })
    expect(result.isError).toBeFalsy()
    expect(boardService.createFeature).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ content: '# New Task', status: 'backlog' })
    )
  })

  it('create_task errors when content and title missing', async () => {
    const boardService = {
      createFeature: vi.fn()
    } as unknown as FeatureBoardService
    const handlers = createKanbanToolHandlers(boardService)
    const result = await handlers.create_task({})
    expect(result.isError).toBe(true)
    expect(boardService.createFeature).not.toHaveBeenCalled()
  })

  it('set_task_status maps service errors', async () => {
    const boardService = {
      setFeatureStatus: vi.fn().mockRejectedValue(new Error('Feature not found: x'))
    } as unknown as FeatureBoardService
    const handlers = createKanbanToolHandlers(boardService)
    const result = await handlers.set_task_status({ featureId: 'x', status: 'done' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Feature not found')
  })

  it('search_tasks and list_boards delegate', async () => {
    const boardService = {
      searchFeatures: vi.fn().mockResolvedValue([makeFeature('hit')]),
      listBoards: vi.fn().mockResolvedValue([{ path: '/board', name: 'board', columns: [] }])
    } as unknown as FeatureBoardService
    const handlers = createKanbanToolHandlers(boardService)

    const search = await handlers.search_tasks({ query: 'hit' })
    expect(search.content[0].text).toContain('"id": "hit"')

    const boards = await handlers.list_boards()
    expect(boards.content[0].text).toContain('/board')
  })
})
