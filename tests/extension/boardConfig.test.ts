import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import { getBoardColumns, saveBoardColumns } from '../../src/extension/boardConfig'
import { KanbanColumn } from '../../src/shared/types'

// Mock vscode
vi.mock('vscode', () => {
  return {
    workspace: {
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn((key, defaultValue) => defaultValue)
      })
    }
  }
})

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}))

// Mock KanbanPanel since getActiveBoardPath depends on it, although we don't test getActiveBoardPath directly here, it's imported in boardConfig
vi.mock('../../src/extension/KanbanPanel', () => ({
  KanbanPanel: {
    activePanel: null,
    openPanels: new Map()
  }
}))

describe('boardConfig', () => {
  const defaultColumns: KanbanColumn[] = [
    { id: 'backlog', name: 'Backlog', color: '#6b7280' },
    { id: 'todo', name: 'To Do', color: '#3b82f6' },
    { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
    { id: 'review', name: 'Review', color: '#8b5cf6' },
    { id: 'done', name: 'Done', color: '#22c55e' }
  ]

  const customColumns: KanbanColumn[] = [
    { id: 'custom-todo', name: 'Custom To Do', color: '#000000' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {}) // silence console.errors in tests
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getBoardColumns', () => {
    it('returns default columns when boardPath is null', () => {
      const result = getBoardColumns(null)
      expect(result).toEqual(defaultColumns)
    })

    it('returns default columns when .kanbansauce does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      const result = getBoardColumns('/fake/path')
      expect(result).toEqual(defaultColumns)
    })

    it('returns custom columns when .kanbansauce exists and is valid', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ columns: customColumns }))

      const result = getBoardColumns('/fake/path')
      
      expect(fs.existsSync).toHaveBeenCalledWith(path.join('/fake/path', '.kanbansauce'))
      expect(fs.readFileSync).toHaveBeenCalledWith(path.join('/fake/path', '.kanbansauce'), 'utf-8')
      expect(result).toEqual(customColumns)
    })

    it('falls back to default columns if .kanbansauce contains invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }')

      const result = getBoardColumns('/fake/path')
      
      expect(console.error).toHaveBeenCalled()
      expect(result).toEqual(defaultColumns)
    })

    it('falls back to default columns if .kanbansauce has no columns array', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ otherKey: 'value' }))

      const result = getBoardColumns('/fake/path')
      expect(result).toEqual(defaultColumns)
    })
  })

  describe('saveBoardColumns', () => {
    it('creates a new .kanbansauce file if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      saveBoardColumns('/fake/path', customColumns)

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/fake/path', '.kanbansauce'),
        JSON.stringify({ columns: customColumns }, null, 2),
        'utf-8'
      )
    })

    it('updates an existing .kanbansauce file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ otherSetting: true }))

      saveBoardColumns('/fake/path', customColumns)

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/fake/path', '.kanbansauce'),
        JSON.stringify({ otherSetting: true, columns: customColumns }, null, 2),
        'utf-8'
      )
    })

    it('overwrites corrupted .kanbansauce file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }')

      saveBoardColumns('/fake/path', customColumns)

      expect(console.error).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/fake/path', '.kanbansauce'),
        JSON.stringify({ columns: customColumns }, null, 2),
        'utf-8'
      )
    })
  })
})
