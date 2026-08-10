import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { vscode } from '../vscodeApi'
import { t } from '../lib/i18n'
import type { KanbanColumn } from '../../shared/types'

interface ColumnManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function ColumnManager({ isOpen, onClose }: Readonly<ColumnManagerProps>) {
  const { columns, features } = useStore()
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>([])
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setLocalColumns([...columns])
    }
  }

  if (!isOpen) return null

  const getCardCount = (columnId: string) => {
    return features.filter((f) => f.status === columnId).length
  }

  const handleAddColumn = () => {
    const newId = `col-${Date.now()}`
    setLocalColumns([
      ...localColumns,
      { id: newId, name: 'New Column', color: '#9ca3af' }
    ])
  }

  const handleUpdateColumn = (index: number, updates: Partial<KanbanColumn>) => {
    const newCols = [...localColumns]
    newCols[index] = { ...newCols[index], ...updates }
    setLocalColumns(newCols)
  }

  const handleDeleteColumn = (index: number) => {
    const col = localColumns[index]
    const cardCount = getCardCount(col.id)
    
    if (cardCount > 0) {
      vscode.postMessage({
        type: 'showErrorMessage',
        message: t('columnManager.deleteErrorNotEmpty')
      })
      return
    }

    const newCols = [...localColumns]
    newCols.splice(index, 1)
    setLocalColumns(newCols)
  }

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === localColumns.length - 1) return

    const newCols = [...localColumns]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newCols[index]
    newCols[index] = newCols[targetIndex]
    newCols[targetIndex] = temp
    setLocalColumns(newCols)
  }

  const handleSave = () => {
    // Validate
    const hasEmptyId = localColumns.some(c => !c.id.trim())
    const hasEmptyName = localColumns.some(c => !c.name.trim())
    const hasDuplicateIds = new Set(localColumns.map(c => c.id.trim())).size !== localColumns.length
    
    if (hasEmptyId || hasEmptyName) {
      vscode.postMessage({ type: 'showErrorMessage', message: t('columnManager.errorEmpty') })
      return
    }

    if (hasDuplicateIds) {
      vscode.postMessage({ type: 'showErrorMessage', message: t('columnManager.errorDuplicate') })
      return
    }

    vscode.postMessage({ type: 'saveBoardColumns', columns: localColumns })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative h-full w-1/2 shadow-xl flex flex-col animate-in slide-in-from-right duration-200"
        style={{
          background: 'var(--vscode-editor-background)',
          borderLeft: '1px solid var(--vscode-panel-border)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
        >
          <div className="flex items-center gap-3">
            <h2 className="font-medium" style={{ color: 'var(--vscode-foreground)' }}>
              {t('columnManager.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-base" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {t('columnManager.description')}
          </p>

          <div className="space-y-2">
            {localColumns.map((col, idx) => {
              const cardCount = getCardCount(col.id)
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded border"
                  style={{
                    borderColor: 'var(--vscode-panel-border)',
                    background: 'var(--vscode-editor-background)'
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveColumn(idx, 'up')}
                      disabled={idx === 0}
                      className="disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-0.5 rounded"
                      style={{ color: 'var(--vscode-icon-foreground)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button
                      onClick={() => moveColumn(idx, 'down')}
                      disabled={idx === localColumns.length - 1}
                      className="disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-0.5 rounded"
                      style={{ color: 'var(--vscode-icon-foreground)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>

                  <input
                    type="color"
                    value={col.color || '#9ca3af'}
                    onChange={(e) => handleUpdateColumn(idx, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer shrink-0 border-0 p-0"
                  />

                  <div className="flex-1 flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <span className="w-12 text-sm text-right" style={{ color: 'var(--vscode-descriptionForeground)' }}>Name</span>
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                        placeholder={t('columnManager.namePlaceholder')}
                        className="flex-1 text-base bg-transparent border rounded px-2 py-1"
                        style={{
                          color: 'var(--vscode-input-foreground)',
                          background: 'var(--vscode-input-background)',
                          borderColor: 'var(--vscode-input-border)'
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-12 text-sm text-right" style={{ color: 'var(--vscode-descriptionForeground)' }}>ID</span>
                      <input
                        type="text"
                        value={col.id}
                        onChange={(e) => handleUpdateColumn(idx, { id: e.target.value })}
                        placeholder={t('columnManager.idPlaceholder')}
                        className="flex-1 text-sm font-mono bg-transparent border rounded px-2 py-1 opacity-70"
                        style={{
                          color: 'var(--vscode-input-foreground)',
                          background: 'var(--vscode-input-background)',
                          borderColor: 'var(--vscode-input-border)'
                        }}
                      />
                    </label>
                  </div>

                  <div className="text-xs shrink-0 w-16 text-center" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    {cardCount} {t('columnManager.cards')}
                  </div>

                  <button
                    onClick={() => handleDeleteColumn(idx)}
                    className="p-1.5 rounded transition-colors shrink-0"
                    style={{
                      color: cardCount > 0 ? 'var(--vscode-disabledForeground)' : 'var(--vscode-errorForeground)'
                    }}
                    title={cardCount > 0 ? t('columnManager.deleteErrorNotEmpty') : t('columnManager.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            onClick={handleAddColumn}
            className="flex items-center justify-center gap-2 w-full py-2 rounded text-sm transition-colors border border-dashed"
            style={{
              borderColor: 'var(--vscode-panel-border)',
              color: 'var(--vscode-button-secondaryForeground)',
              background: 'var(--vscode-button-secondaryBackground)'
            }}
          >
            <Plus size={16} />
            {t('columnManager.addColumn')}
          </button>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 p-4"
          style={{ borderTop: '1px solid var(--vscode-panel-border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded transition-colors"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)'
            }}
          >
            {t('columnManager.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded transition-colors"
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)'
            }}
          >
            {t('columnManager.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
