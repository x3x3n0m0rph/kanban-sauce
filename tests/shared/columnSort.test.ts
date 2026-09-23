import { describe, it, expect } from 'vitest'
import { compareFeaturesForColumnSort, sortFeaturesForColumn } from '../../src/shared/columnSort'
import type { Feature } from '../../src/shared/types'

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'feat-1',
    status: 'backlog',
    priority: 'medium',
    type: null,
    assignee: null,
    epic: null,
    dueDate: null,
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    labels: [],
    order: 'a0',
    content: '# Alpha',
    filePath: '/workspace/features/feat.md',
    ...overrides
  }
}

describe('compareFeaturesForColumnSort', () => {
  describe('priority', () => {
    it('sorts critical before low when direction is desc', () => {
      const critical = makeFeature({ id: 'c', priority: 'critical', order: 'a1' })
      const low = makeFeature({ id: 'l', priority: 'low', order: 'a0' })
      expect(compareFeaturesForColumnSort(critical, low, 'priority', 'desc')).toBeLessThan(0)
      expect(compareFeaturesForColumnSort(low, critical, 'priority', 'desc')).toBeGreaterThan(0)
    })

    it('sorts low before critical when direction is asc', () => {
      const critical = makeFeature({ id: 'c', priority: 'critical', order: 'a0' })
      const low = makeFeature({ id: 'l', priority: 'low', order: 'a1' })
      expect(compareFeaturesForColumnSort(low, critical, 'priority', 'asc')).toBeLessThan(0)
    })

    it('falls back to order when priorities are equal', () => {
      const first = makeFeature({ id: 'a', priority: 'high', order: 'a0' })
      const second = makeFeature({ id: 'b', priority: 'high', order: 'a1' })
      expect(compareFeaturesForColumnSort(first, second, 'priority', 'desc')).toBeLessThan(0)
    })
  })

  describe('dueDate', () => {
    it('sorts soonest first when direction is asc', () => {
      const soon = makeFeature({ id: 's', dueDate: '2026-03-01', order: 'a1' })
      const late = makeFeature({ id: 'l', dueDate: '2026-06-01', order: 'a0' })
      expect(compareFeaturesForColumnSort(soon, late, 'dueDate', 'asc')).toBeLessThan(0)
    })

    it('puts null due dates at the end regardless of direction', () => {
      const dated = makeFeature({ id: 'd', dueDate: '2026-03-01', order: 'a1' })
      const noDate = makeFeature({ id: 'n', dueDate: null, order: 'a0' })
      expect(compareFeaturesForColumnSort(dated, noDate, 'dueDate', 'asc')).toBeLessThan(0)
      expect(compareFeaturesForColumnSort(dated, noDate, 'dueDate', 'desc')).toBeLessThan(0)
    })
  })

  describe('title', () => {
    it('sorts A to Z when direction is asc', () => {
      const alpha = makeFeature({ id: 'a', content: '# Alpha', order: 'a1' })
      const beta = makeFeature({ id: 'b', content: '# Beta', order: 'a0' })
      expect(compareFeaturesForColumnSort(alpha, beta, 'title', 'asc')).toBeLessThan(0)
    })

    it('sorts Z to A when direction is desc', () => {
      const alpha = makeFeature({ id: 'a', content: '# Alpha', order: 'a0' })
      const beta = makeFeature({ id: 'b', content: '# Beta', order: 'a1' })
      expect(compareFeaturesForColumnSort(beta, alpha, 'title', 'desc')).toBeLessThan(0)
    })
  })

  describe('created and modified', () => {
    it('sorts newest first when direction is desc', () => {
      const older = makeFeature({ id: 'o', created: '2026-01-01T00:00:00.000Z', order: 'a0' })
      const newer = makeFeature({ id: 'n', created: '2026-06-01T00:00:00.000Z', order: 'a1' })
      expect(compareFeaturesForColumnSort(newer, older, 'created', 'desc')).toBeLessThan(0)
    })

    it('sorts oldest first when direction is asc on modified', () => {
      const older = makeFeature({ id: 'o', modified: '2026-01-01T00:00:00.000Z', order: 'a1' })
      const newer = makeFeature({ id: 'n', modified: '2026-06-01T00:00:00.000Z', order: 'a0' })
      expect(compareFeaturesForColumnSort(older, newer, 'modified', 'asc')).toBeLessThan(0)
    })
  })
})

describe('sortFeaturesForColumn', () => {
  it('returns a new sorted array without mutating the input', () => {
    const features = [
      makeFeature({ id: 'a', priority: 'low', order: 'a0' }),
      makeFeature({ id: 'b', priority: 'critical', order: 'a1' }),
      makeFeature({ id: 'c', priority: 'medium', order: 'a2' })
    ]
    const sorted = sortFeaturesForColumn(features, 'priority', 'desc')
    expect(sorted.map((f) => f.id)).toEqual(['b', 'c', 'a'])
    expect(features.map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })
})
