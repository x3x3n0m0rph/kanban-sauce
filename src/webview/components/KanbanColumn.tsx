import { Plus, ChevronLeft, MoreVertical, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { FeatureCard } from './FeatureCard'
import type { Feature, KanbanColumn as KanbanColumnType, ColumnSortField, ColumnSortDirection } from '../../shared/types'
import type { LayoutMode } from '../store'
import type { ColumnWidthMode } from '../../shared/types'
import { getColumnWidthClass } from '../lib/columnWidth'
import type { DropTarget } from './KanbanBoard'
import { t } from '../lib/i18n'

interface KanbanColumnProps {
  column: KanbanColumnType
  features: Feature[]
  otherColumns: KanbanColumnType[]
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onCollapse: () => void
  onMoveAllCards: (targetColumnId: string) => void
  onSortCards: (field: ColumnSortField, direction: ColumnSortDirection) => void
  onArchiveAllCards?: () => void
  bulkActionsDisabled?: boolean
  onDragStart: (e: React.DragEvent, feature: Feature) => void
  onDragOver: (e: React.DragEvent) => void
  onDragOverCard: (e: React.DragEvent, columnId: string, cardIndex: number) => void
  onDrop: (e: React.DragEvent, status: string) => void
  onDragEnd: () => void
  draggedFeature: Feature | null
  dropTarget: DropTarget | null
  layout: LayoutMode
  columnWidthMode: ColumnWidthMode
}

export function KanbanColumn({
  column,
  features,
  otherColumns,
  onFeatureClick,
  onAddFeature,
  onCollapse,
  onMoveAllCards,
  onSortCards,
  onArchiveAllCards,
  bulkActionsDisabled = false,
  onDragStart,
  onDragOver,
  onDragOverCard,
  onDrop,
  onDragEnd,
  draggedFeature,
  dropTarget,
  layout,
  columnWidthMode
}: KanbanColumnProps) {
  const isVertical = layout === 'vertical'
  const isDropTarget = dropTarget && dropTarget.columnId === column.id
  const [menuOpen, setMenuOpen] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState<'move' | 'sort' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const sortOptions: { field: ColumnSortField; direction: ColumnSortDirection; labelKey: string }[] = [
    { field: 'priority', direction: 'desc', labelKey: 'column.sort.priorityHighest' },
    { field: 'priority', direction: 'asc', labelKey: 'column.sort.priorityLowest' },
    { field: 'dueDate', direction: 'asc', labelKey: 'column.sort.dueSoonest' },
    { field: 'dueDate', direction: 'desc', labelKey: 'column.sort.dueLatest' },
    { field: 'title', direction: 'asc', labelKey: 'column.sort.titleAZ' },
    { field: 'title', direction: 'desc', labelKey: 'column.sort.titleZA' },
    { field: 'created', direction: 'desc', labelKey: 'column.sort.createdNewest' },
    { field: 'created', direction: 'asc', labelKey: 'column.sort.createdOldest' },
    { field: 'modified', direction: 'desc', labelKey: 'column.sort.modifiedNewest' },
    { field: 'modified', direction: 'asc', labelKey: 'column.sort.modifiedOldest' }
  ]

  const handleSort = (field: ColumnSortField, direction: ColumnSortDirection) => {
    onSortCards(field, direction)
    setMenuOpen(false)
    setSubmenuOpen(null)
  }

  const bulkDisabled = features.length === 0 || bulkActionsDisabled
  const bulkDisabledClass = bulkDisabled ? 'opacity-40 pointer-events-none' : ''

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div
      className={
        isVertical
          ? "flex flex-col bg-zinc-100 dark:bg-zinc-800/50 rounded-lg"
          : getColumnWidthClass(columnWidthMode)
      }
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between w-full px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 kanban-column-header-title">{column.name}</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
            {features.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCollapse}
            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title={t('column.collapse', { name: column.name })}
          >
            <ChevronLeft size={16} className="text-zinc-500" />
          </button>
          <button
            onClick={() => onAddFeature(column.id)}
            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title={t('column.addTo', { name: column.name })}
          >
            <Plus size={16} className="text-zinc-500" />
          </button>
          <div ref={menuRef} className="relative flex">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title={t('column.options')}
            >
              <MoreVertical size={16} className="text-zinc-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg py-1">
                {bulkActionsDisabled && (
                  <p className="px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                    {t('column.bulkActionsDisabledByFilters')}
                  </p>
                )}
                <div
                  className={`relative ${bulkDisabledClass}`}
                  title={bulkActionsDisabled ? t('column.bulkActionsDisabledByFilters') : undefined}
                  onMouseEnter={() => !bulkDisabled && setSubmenuOpen('move')}
                  onMouseLeave={() => setSubmenuOpen((prev) => (prev === 'move' ? null : prev))}
                >
                  <button
                    className="w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-between gap-2"
                  >
                    <span>{t('column.moveAllCards')}</span>
                    <ChevronRight size={14} className="text-zinc-400 flex-shrink-0" />
                  </button>
                  {submenuOpen === 'move' && (
                    <div className="absolute left-full top-0 ml-0.5 z-50 min-w-[160px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg py-1">
                      {otherColumns.map((col) => (
                        <button
                          key={col.id}
                          className="w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                          onClick={() => { onMoveAllCards(col.id); setMenuOpen(false); setSubmenuOpen(null) }}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                          {col.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className={`relative ${bulkDisabledClass}`}
                  title={bulkActionsDisabled ? t('column.bulkActionsDisabledByFilters') : undefined}
                  onMouseEnter={() => !bulkDisabled && setSubmenuOpen('sort')}
                  onMouseLeave={() => setSubmenuOpen((prev) => (prev === 'sort' ? null : prev))}
                >
                  <button
                    className="w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-between gap-2"
                  >
                    <span>{t('column.sortCards')}</span>
                    <ChevronRight size={14} className="text-zinc-400 flex-shrink-0" />
                  </button>
                  {submenuOpen === 'sort' && (
                    <div className="absolute left-full top-0 ml-0.5 z-50 min-w-[220px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg py-1">
                      {sortOptions.map((opt, index) => (
                        <div key={`${opt.field}-${opt.direction}`}>
                          {index > 0 && index % 2 === 0 && (
                            <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
                          )}
                          <button
                            className="w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            onClick={() => handleSort(opt.field, opt.direction)}
                          >
                            {t(opt.labelKey)}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {onArchiveAllCards && (
                  <button
                    className={`w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 ${bulkDisabledClass}`}
                    title={bulkActionsDisabled ? t('column.bulkActionsDisabledByFilters') : undefined}
                    onClick={() => { onArchiveAllCards(); setMenuOpen(false) }}
                  >
                    {t('column.archiveAllCards')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Column Content */}
      <div
        className={
          isVertical
            ? "flex-1 p-2 flex flex-wrap gap-2"
            : "flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]"
        }
      >
        {features.map((feature, index) => (
          <div key={feature.id}>
            {/* Drop indicator before this card */}
            {isDropTarget && dropTarget.index === index && (
              <div className="h-0.5 bg-blue-500 rounded-full mx-1 mb-1" />
            )}
            <div
              draggable
              onDragStart={(e) => onDragStart(e, feature)}
              onDragOver={(e) => onDragOverCard(e, column.id, index)}
              onDragEnd={onDragEnd}
              className={`${isVertical ? "w-64" : ""} ${
                draggedFeature?.id === feature.id ? "opacity-40" : ""
              }`}
            >
              <FeatureCard feature={feature} onClick={() => onFeatureClick(feature)} />
            </div>
          </div>
        ))}

        {/* Drop indicator at end of list */}
        {isDropTarget && dropTarget.index === features.length && features.length > 0 && (
          <div className="h-0.5 bg-blue-500 rounded-full mx-1" />
        )}

        {features.length === 0 && (
          <div className={isVertical ? "text-sm text-zinc-400 dark:text-zinc-500 py-4" : "text-center py-8 text-sm text-zinc-400 dark:text-zinc-500"}>
            {t('column.noFeatures')}
          </div>
        )}
      </div>
    </div>
  )
}
