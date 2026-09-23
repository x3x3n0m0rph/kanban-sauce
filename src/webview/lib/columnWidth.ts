import type { ColumnWidthMode } from '../../shared/types'
import { cn } from './utils'

const columnBase =
  'h-full flex flex-col bg-zinc-100 dark:bg-zinc-800/50 rounded-lg'

export function getColumnWidthClass(mode: ColumnWidthMode): string {
  switch (mode) {
    case 'fill':
      return cn(columnBase, 'flex-1 min-w-72 max-w-96')
    case 'compact':
      return cn(columnBase, 'flex-1 min-w-52')
    case 'fixed':
    default:
      return cn(columnBase, 'flex-shrink-0 w-72')
  }
}

export function getBoardRowClass(mode: ColumnWidthMode): string {
  const base = 'flex gap-4 h-full'
  switch (mode) {
    case 'fill':
    case 'compact':
      return cn(base, 'w-full')
    case 'fixed':
    default:
      return cn(base, 'min-w-max')
  }
}
