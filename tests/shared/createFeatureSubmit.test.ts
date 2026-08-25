import { describe, it, expect } from 'vitest'
import {
  shouldCreateFeatureOnClose,
  buildCreateFeatureContent
} from '../../src/webview/lib/createFeatureSubmit'

describe('shouldCreateFeatureOnClose', () => {
  it('does not create when title and description are empty', () => {
    expect(shouldCreateFeatureOnClose('', '', false)).toBe(false)
    expect(shouldCreateFeatureOnClose('   ', '  ', true)).toBe(false)
  })

  it('does not create when only a pristine template is present (not dirty)', () => {
    expect(shouldCreateFeatureOnClose('', '## Context\n\n- [ ] AC', false)).toBe(false)
  })

  it('creates when the user edited the description without a title', () => {
    expect(shouldCreateFeatureOnClose('', '## Context\n\nedited', true)).toBe(true)
    expect(shouldCreateFeatureOnClose('', 'custom body only', true)).toBe(true)
  })

  it('creates when there is a title, even with an untouched template', () => {
    expect(shouldCreateFeatureOnClose('My feature', '## Context', false)).toBe(true)
    expect(shouldCreateFeatureOnClose('My feature', '', false)).toBe(true)
  })

  it('creates when there is a title and a dirty description', () => {
    expect(shouldCreateFeatureOnClose('My feature', 'changed body', true)).toBe(true)
  })

  it('trims title before deciding', () => {
    expect(shouldCreateFeatureOnClose('  titled  ', '', false)).toBe(true)
  })
})

describe('buildCreateFeatureContent', () => {
  it('builds heading-only content', () => {
    expect(buildCreateFeatureContent('Hello', '')).toBe('# Hello')
  })

  it('builds heading plus description', () => {
    expect(buildCreateFeatureContent('Hello', '## Body')).toBe('# Hello\n\n## Body')
  })

  it('returns description only when title is empty', () => {
    expect(buildCreateFeatureContent('', '## Body only')).toBe('## Body only')
  })

  it('trims title and description', () => {
    expect(buildCreateFeatureContent('  Hello  ', '  body  ')).toBe('# Hello\n\nbody')
  })
})
