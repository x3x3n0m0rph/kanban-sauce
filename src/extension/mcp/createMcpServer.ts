import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Feature } from '../../shared/types'
import type { FeatureBoardService, CreateFeatureInput } from '../featureBoardService'

const boardPathSchema = z.string().optional().describe('Absolute board folder path; defaults to active/known board')

function featureSummary(feature: Feature) {
  return {
    id: feature.id,
    status: feature.status,
    priority: feature.priority,
    type: feature.type,
    assignee: feature.assignee,
    epic: feature.epic,
    dueDate: feature.dueDate,
    labels: feature.labels,
    order: feature.order,
    title: feature.content.split('\n').find(l => l.trim())?.replace(/^#\s*/, '') || feature.id,
    content: feature.content,
    filePath: feature.filePath
  }
}

function textResult(data: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
    isError
  }
}

export type KanbanToolHandlers = {
  list_boards: () => Promise<ReturnType<typeof textResult>>
  get_board: (args: { boardPath?: string }) => Promise<ReturnType<typeof textResult>>
  list_tasks: (args: { boardPath?: string; status?: string }) => Promise<ReturnType<typeof textResult>>
  search_tasks: (args: { query: string; boardPath?: string }) => Promise<ReturnType<typeof textResult>>
  create_task: (args: {
    content?: string
    title?: string
    boardPath?: string
    status?: string
    priority?: 'critical' | 'high' | 'medium' | 'low'
    type?: string
    assignee?: string
    epic?: string
    dueDate?: string
    labels?: string[]
  }) => Promise<ReturnType<typeof textResult>>
  set_task_status: (args: {
    featureId: string
    status: string
    boardPath?: string
  }) => Promise<ReturnType<typeof textResult>>
}

export function createKanbanToolHandlers(boardService: FeatureBoardService): KanbanToolHandlers {
  return {
    async list_boards() {
      try {
        const boards = await boardService.listBoards()
        return textResult({ boards })
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e), true)
      }
    },

    async get_board(args) {
      try {
        const board = await boardService.getBoard(args.boardPath)
        return textResult(board)
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e), true)
      }
    },

    async list_tasks(args) {
      try {
        const features = await boardService.listFeatures(args.boardPath, args.status)
        return textResult({
          boardPath: await boardService.resolveBoard(args.boardPath),
          count: features.length,
          tasks: features.map(featureSummary)
        })
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e), true)
      }
    },

    async search_tasks(args) {
      try {
        const features = await boardService.searchFeatures(args.boardPath, args.query)
        return textResult({
          query: args.query,
          count: features.length,
          tasks: features.map(featureSummary)
        })
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e), true)
      }
    },

    async create_task(args) {
      try {
        let content = args.content?.trim()
        if (!content) {
          const title = args.title?.trim()
          if (!title) {
            return textResult('Either content or title is required', true)
          }
          content = `# ${title}`
        }
        const input: CreateFeatureInput = {
          content,
          status: args.status,
          priority: args.priority,
          type: args.type,
          assignee: args.assignee,
          epic: args.epic,
          dueDate: args.dueDate,
          labels: args.labels
        }
        const feature = await boardService.createFeature(args.boardPath, input)
        return textResult({ created: featureSummary(feature) })
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e), true)
      }
    },

    async set_task_status(args) {
      try {
        const feature = await boardService.setFeatureStatus(args.boardPath, args.featureId, args.status)
        return textResult({ updated: featureSummary(feature) })
      } catch (e) {
        return textResult(e instanceof Error ? e.message : String(e), true)
      }
    }
  }
}

export function createKanbanMcpServer(boardService: FeatureBoardService): McpServer {
  const handlers = createKanbanToolHandlers(boardService)
  const server = new McpServer({
    name: 'kanban-sauce',
    version: '1.0.0'
  })

  server.registerTool(
    'list_boards',
    {
      title: 'List boards',
      description: 'List known Kanban Sauce boards and their columns',
      annotations: { readOnlyHint: true }
    },
    async () => handlers.list_boards()
  )

  server.registerTool(
    'get_board',
    {
      title: 'Get board',
      description: 'Get board path, name, and columns',
      inputSchema: { boardPath: boardPathSchema },
      annotations: { readOnlyHint: true }
    },
    async args => handlers.get_board(args)
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description: 'List tasks on a Kanban Sauce board, optionally filtered by status',
      inputSchema: {
        boardPath: boardPathSchema,
        status: z.string().optional().describe('Column/status id filter')
      },
      annotations: { readOnlyHint: true }
    },
    async args => handlers.list_tasks(args)
  )

  server.registerTool(
    'search_tasks',
    {
      title: 'Search tasks',
      description: 'Search tasks by content, id, assignee, epic, type, or labels',
      inputSchema: {
        query: z.string().describe('Search query'),
        boardPath: boardPathSchema
      },
      annotations: { readOnlyHint: true }
    },
    async args => handlers.search_tasks(args)
  )

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description: 'Create a new task card as a markdown file on the board',
      inputSchema: {
        content: z.string().optional().describe('Markdown body; if omitted, title is used as "# title"'),
        title: z.string().optional().describe('Short title used when content is omitted'),
        boardPath: boardPathSchema,
        status: z.string().optional(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
        type: z.string().optional(),
        assignee: z.string().optional(),
        epic: z.string().optional(),
        dueDate: z.string().optional(),
        labels: z.array(z.string()).optional()
      }
    },
    async args => handlers.create_task(args)
  )

  server.registerTool(
    'set_task_status',
    {
      title: 'Set task status',
      description: 'Move a task to another column/status',
      inputSchema: {
        featureId: z.string().describe('Task id (filename without .md)'),
        status: z.string().describe('Target column/status id'),
        boardPath: boardPathSchema
      }
    },
    async args => handlers.set_task_status(args)
  )

  return server
}
