import type { ColumnSortDirection, ColumnSortField, Feature, Priority } from './types'
import { getTitleFromContent } from './types'

const PRIORITY_RANK: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
}

function compareOrder(a: Feature, b: Feature): number {
  if (a.order < b.order) return -1
  if (a.order > b.order) return 1
  return 0
}

function compareDueDate(a: Feature, b: Feature, direction: ColumnSortDirection): number {
  const aDate = a.dueDate
  const bDate = b.dueDate

  if (aDate === null && bDate === null) return compareOrder(a, b)
  if (aDate === null) return 1
  if (bDate === null) return -1

  const cmp = aDate.localeCompare(bDate)
  return direction === 'asc' ? cmp : -cmp
}

function comparePriority(a: Feature, b: Feature, direction: ColumnSortDirection): number {
  const aRank = PRIORITY_RANK[a.priority]
  const bRank = PRIORITY_RANK[b.priority]
  if (aRank !== bRank) {
    return direction === 'desc' ? bRank - aRank : aRank - bRank
  }
  return compareOrder(a, b)
}

function compareTitle(a: Feature, b: Feature, direction: ColumnSortDirection): number {
  const aTitle = getTitleFromContent(a.content)
  const bTitle = getTitleFromContent(b.content)
  const cmp = aTitle.localeCompare(bTitle, undefined, { sensitivity: 'base' })
  if (cmp !== 0) {
    return direction === 'asc' ? cmp : -cmp
  }
  return compareOrder(a, b)
}

function compareIsoDate(a: Feature, b: Feature, field: 'created' | 'modified', direction: ColumnSortDirection): number {
  const aDate = a[field]
  const bDate = b[field]
  const cmp = aDate.localeCompare(bDate)
  if (cmp !== 0) {
    return direction === 'desc' ? -cmp : cmp
  }
  return compareOrder(a, b)
}

export function compareFeaturesForColumnSort(
  a: Feature,
  b: Feature,
  field: ColumnSortField,
  direction: ColumnSortDirection
): number {
  switch (field) {
    case 'priority':
      return comparePriority(a, b, direction)
    case 'dueDate':
      return compareDueDate(a, b, direction)
    case 'title':
      return compareTitle(a, b, direction)
    case 'created':
      return compareIsoDate(a, b, 'created', direction)
    case 'modified':
      return compareIsoDate(a, b, 'modified', direction)
    default: {
      const _exhaustive: never = field
      return _exhaustive
    }
  }
}

export function sortFeaturesForColumn(
  features: Feature[],
  field: ColumnSortField,
  direction: ColumnSortDirection
): Feature[] {
  return [...features].sort((a, b) => compareFeaturesForColumnSort(a, b, field, direction))
}
