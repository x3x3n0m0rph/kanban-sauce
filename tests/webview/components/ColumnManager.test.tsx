// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColumnManager } from '../../../src/webview/components/ColumnManager'
import { useStore } from '../../../src/webview/store'
import type { KanbanColumn, Feature } from '../../../src/shared/types'

// Mock vscode API
const { mockPostMessage } = vi.hoisted(() => ({ mockPostMessage: vi.fn() }))
vi.mock('../../../src/webview/vscodeApi', () => ({
  vscode: { postMessage: mockPostMessage }
}))

// Mock l10n
vi.mock('../../../src/webview/lib/i18n', () => ({
  t: (key: string) => key
}))

const initialState = useStore.getState()

beforeEach(() => {
  useStore.setState(initialState, true)
  vi.clearAllMocks()
})

describe('ColumnManager', () => {
  const defaultColumns: KanbanColumn[] = [
    { id: 'todo', name: 'To Do', color: '#000000' },
    { id: 'done', name: 'Done', color: '#111111' }
  ]

  it('does not render when isOpen is false', () => {
    useStore.setState({ columns: defaultColumns })
    const { container } = render(<ColumnManager isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders columns from the store when opened', () => {
    useStore.setState({ columns: defaultColumns })
    render(<ColumnManager isOpen={true} onClose={vi.fn()} />)
    
    // It should render inputs with the column values
    expect(screen.getByDisplayValue('To Do')).toBeInTheDocument()
    expect(screen.getByDisplayValue('todo')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Done')).toBeInTheDocument()
    expect(screen.getByDisplayValue('done')).toBeInTheDocument()
  })

  it('updates local state when inputs are changed', async () => {
    useStore.setState({ columns: defaultColumns })
    render(<ColumnManager isOpen={true} onClose={vi.fn()} />)
    
    const user = userEvent.setup()
    const nameInput = screen.getByDisplayValue('To Do')
    await user.clear(nameInput)
    await user.type(nameInput, 'In Progress')
    
    expect(screen.getByDisplayValue('In Progress')).toBeInTheDocument()
    // It shouldn't trigger save until save button is clicked
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('posts saveBoardColumns message on save', async () => {
    useStore.setState({ columns: defaultColumns })
    render(<ColumnManager isOpen={true} onClose={vi.fn()} />)
    
    const user = userEvent.setup()
    const nameInput = screen.getByDisplayValue('To Do')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed Column')
    
    const saveButton = screen.getByText('columnManager.save')
    await user.click(saveButton)
    
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'saveBoardColumns',
      columns: [
        { id: 'todo', name: 'Renamed Column', color: '#000000' },
        { id: 'done', name: 'Done', color: '#111111' }
      ]
    })
  })

  it('shows an error if columns are invalid on save', async () => {
    useStore.setState({ columns: defaultColumns })
    render(<ColumnManager isOpen={true} onClose={vi.fn()} />)
    
    const user = userEvent.setup()
    // Blank name
    const nameInput = screen.getByDisplayValue('To Do')
    await user.clear(nameInput)
    
    const saveButton = screen.getByText('columnManager.save')
    await user.click(saveButton)
    
    // Should show error and not save
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'showErrorMessage',
      message: 'columnManager.errorEmpty'
    })
  })

  it('prevents deletion of column that contains cards', async () => {
    const mockFeature: Feature = {
      id: '1', filePath: '',
      status: 'todo', // Has a card in 'todo'
      content: '', priority: 'low', assignee: null, epic: null, dueDate: null, labels: [],
      created: '', modified: '', order: '0', completedAt: null
    }
    useStore.setState({ columns: defaultColumns, features: [mockFeature] })
    render(<ColumnManager isOpen={true} onClose={vi.fn()} />)
    
    const deleteButtons = screen.getAllByTitle('columnManager.deleteErrorNotEmpty')
    
    // We expect the button to be disabled visually and the event handler checks for cardCount > 0
    const user = userEvent.setup()
    await user.click(deleteButtons[0]) // Try deleting 'todo'
    
    // Error message should be shown (if you have the logic to show error on click, actually it's a title in the code)
    // Wait, the actual code doesn't show an error toast on click, it just returns if cardCount > 0!
    // So the state won't change
    expect(screen.getByDisplayValue('To Do')).toBeInTheDocument()
  })

  it('allows deletion of empty columns', async () => {
    useStore.setState({ columns: defaultColumns, features: [] })
    render(<ColumnManager isOpen={true} onClose={vi.fn()} />)
    
    const user = userEvent.setup()
    // Assuming trash icon button can be found by a test-id or order. Since it's an icon, we might need to find by title or role
    // The title attribute is 'columnManager.delete' for empty columns
    // Wait, there are two, getByTitle throws if multiple.
    const deleteButtons = screen.getAllByTitle('columnManager.delete')
    await user.click(deleteButtons[0])
    
    // 'To Do' should be gone
    expect(screen.queryByDisplayValue('To Do')).toBeNull()
  })
})
