/**
 * Integration tests for kanban-markdown VS Code extension.
 *
 * This suite runs inside a real VS Code host (via @vscode/test-electron),
 * so it has access to the actual vscode module and the real file system.
 * Tests create isolated temp directories and clean up after themselves.
 */

import * as assert from 'assert'
import * as path from 'path'
import * as os from 'os'
import * as vscode from 'vscode'

import {
  fileExists,
  moveFeatureFile,
  getFeatureFilePath
} from '../../../src/extension/featureFileUtils'

import {
  parseFeatureFile,
  serializeFeature
} from '../../../src/shared/featureFrontmatter'

import type { Feature } from '../../../src/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return path.join(os.tmpdir(), `kanban-int-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

async function createTmpDir(): Promise<string> {
  const dir = makeTmpDir()
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir))
  return dir
}

async function deleteTmpDir(dir: string): Promise<void> {
  try {
    await vscode.workspace.fs.delete(vscode.Uri.file(dir), { recursive: true })
  } catch {
    // ignore — temp dir may already be gone
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(content, 'utf8')
  )
}

async function readFile(filePath: string): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
  return Buffer.from(bytes).toString('utf8')
}

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'test-id-001',
    status: 'todo',
    priority: 'high',
    type: null,
    assignee: 'alice',
    epic: null,
    dueDate: '2026-06-01',
    created: '2026-01-15T10:00:00.000Z',
    modified: '2026-01-15T10:00:00.000Z',
    completedAt: null,
    labels: ['backend', 'api'],
    order: 'a0',
    content: '# Test Feature\n\nA test description.',
    filePath: '',
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Suite: fileExists
// ---------------------------------------------------------------------------

suite('Integration: fileExists', () => {
  let tmpDir: string

  setup(async () => { tmpDir = await createTmpDir() })
  teardown(async () => { await deleteTmpDir(tmpDir) })

  test('returns false for a path that does not exist', async () => {
    const result = await fileExists(path.join(tmpDir, 'ghost.md'))
    assert.strictEqual(result, false)
  })

  test('returns true for a file that was just written', async () => {
    const filePath = path.join(tmpDir, 'present.md')
    await writeFile(filePath, 'hello')
    const result = await fileExists(filePath)
    assert.strictEqual(result, true)
  })

  test('returns true for a directory', async () => {
    const dirPath = path.join(tmpDir, 'subdir')
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath))
    const result = await fileExists(dirPath)
    assert.strictEqual(result, true)
  })
})

// ---------------------------------------------------------------------------
// Suite: getFeatureFilePath
// ---------------------------------------------------------------------------

suite('Integration: getFeatureFilePath', () => {
  const featuresDir = '/workspace/.devtool/features'

  test('places all features at the board root', () => {
    assert.strictEqual(
      getFeatureFilePath(featuresDir, 'my-feature'),
      path.join(featuresDir, 'my-feature.md')
    )
    assert.strictEqual(
      getFeatureFilePath(featuresDir, 'done-card'),
      path.join(featuresDir, 'done-card.md')
    )
  })
})

// ---------------------------------------------------------------------------
// Suite: moveFeatureFile
// ---------------------------------------------------------------------------

suite('Integration: moveFeatureFile', () => {
  let tmpDir: string

  setup(async () => {
    tmpDir = await createTmpDir()
  })
  teardown(async () => { await deleteTmpDir(tmpDir) })

  test('returns the same path when source is already at board root', async () => {
    const filePath = path.join(tmpDir, 'unchanged.md')
    await writeFile(filePath, 'content')
    const result = await moveFeatureFile(filePath, tmpDir)
    assert.strictEqual(result, filePath)
    assert.ok(await fileExists(filePath), 'file should still exist')
  })

  test('moves file from done/ subfolder to board root', async () => {
    const doneDir = path.join(tmpDir, 'done')
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(doneDir))
    const donePath = path.join(doneDir, 'came-from-done.md')
    await writeFile(donePath, 'content')

    const result = await moveFeatureFile(donePath, tmpDir)
    const expectedPath = path.join(tmpDir, 'came-from-done.md')

    assert.strictEqual(result, expectedPath)
    assert.ok(await fileExists(expectedPath))
    assert.strictEqual(await fileExists(donePath), false)
  })

  test('appends -1 suffix when target filename already exists at root', async () => {
    const doneDir = path.join(tmpDir, 'done')
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(doneDir))
    const srcPath = path.join(doneDir, 'collision.md')
    const collidePath = path.join(tmpDir, 'collision.md')
    await writeFile(srcPath, 'src content')
    await writeFile(collidePath, 'pre-existing content')

    const result = await moveFeatureFile(srcPath, tmpDir)
    const expectedPath = path.join(tmpDir, 'collision-1.md')

    assert.strictEqual(result, expectedPath)
    assert.ok(await fileExists(expectedPath))
    assert.ok(await fileExists(collidePath), 'original target should still exist')
  })

  test('increments suffix until a free slot is found', async () => {
    const doneDir = path.join(tmpDir, 'done')
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(doneDir))
    const srcPath = path.join(doneDir, 'multi.md')
    await writeFile(srcPath, 'src')
    await writeFile(path.join(tmpDir, 'multi.md'), 'v0')
    await writeFile(path.join(tmpDir, 'multi-1.md'), 'v1')

    const result = await moveFeatureFile(srcPath, tmpDir)
    assert.strictEqual(result, path.join(tmpDir, 'multi-2.md'))
    assert.ok(await fileExists(path.join(tmpDir, 'multi-2.md')))
  })
})

// ---------------------------------------------------------------------------
// Suite: parseFeatureFile and serializeFeature round-trip
// ---------------------------------------------------------------------------

suite('Integration: frontmatter round-trip with vscode.workspace.fs', () => {
  let tmpDir: string

  setup(async () => { tmpDir = await createTmpDir() })
  teardown(async () => { await deleteTmpDir(tmpDir) })

  test('all fields survive serialize → write → read → parse', async () => {
    const feature = makeFeature()
    const filePath = path.join(tmpDir, 'round-trip.md')

    await writeFile(filePath, serializeFeature(feature))
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null, 'parseFeatureFile should return a Feature')
    assert.strictEqual(parsed!.id, feature.id)
    assert.strictEqual(parsed!.status, feature.status)
    assert.strictEqual(parsed!.priority, feature.priority)
    assert.strictEqual(parsed!.assignee, feature.assignee)
    assert.strictEqual(parsed!.dueDate, feature.dueDate)
    assert.strictEqual(parsed!.order, feature.order)
    assert.deepStrictEqual(parsed!.labels, feature.labels)
    assert.strictEqual(parsed!.content, feature.content)
  })

  test('null optional fields survive round-trip', async () => {
    const feature = makeFeature({
      priority: 'medium',
      type: null,
      assignee: null,
      dueDate: null,
      completedAt: null,
      labels: []
    })
    const filePath = path.join(tmpDir, 'nulls.md')

    await writeFile(filePath, serializeFeature(feature))
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null)
    assert.strictEqual(parsed!.assignee, null)
    assert.strictEqual(parsed!.dueDate, null)
    assert.strictEqual(parsed!.completedAt, null)
    assert.deepStrictEqual(parsed!.labels, [])
  })

  test('completedAt is preserved when set', async () => {
    const feature = makeFeature({
      status: 'done',
      completedAt: '2026-03-01T09:00:00.000Z'
    })
    const filePath = path.join(tmpDir, 'completed.md')

    await writeFile(filePath, serializeFeature(feature))
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null)
    assert.strictEqual(parsed!.completedAt, feature.completedAt)
  })

  test('parse returns null for a file with no frontmatter block', async () => {
    const filePath = path.join(tmpDir, 'plain.md')
    await writeFile(filePath, '# Just a heading\n\nNo frontmatter here.')

    const content = await readFile(filePath)
    const result = parseFeatureFile(content, filePath)
    assert.strictEqual(result, null)
  })

  test('CRLF line endings are normalised before parsing', async () => {
    const feature = makeFeature({ id: 'crlf-test' })
    const serialized = serializeFeature(feature).replace(/\n/g, '\r\n')
    const filePath = path.join(tmpDir, 'crlf.md')

    await writeFile(filePath, serialized)
    const content = await readFile(filePath)
    const parsed = parseFeatureFile(content, filePath)

    assert.ok(parsed !== null, 'CRLF file should parse successfully')
    assert.strictEqual(parsed!.id, 'crlf-test')
  })
})

// ---------------------------------------------------------------------------
// Suite: extension activation
// ---------------------------------------------------------------------------

suite('Integration: extension activation', () => {
  test('the extension is available in the extension host', async () => {
    const ext = vscode.extensions.getExtension('salsa-lab.kanban-sauce')
    // The extension may or may not auto-activate in this minimal workspace;
    // the important thing is it can be found and activated without throwing.
    assert.ok(ext !== undefined, 'Extension should be registered in the host')
    if (!ext!.isActive) {
      await ext!.activate()
    }
    assert.ok(ext!.isActive, 'Extension should activate without errors')
  })
})
