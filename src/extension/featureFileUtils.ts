import * as path from 'path'
import * as vscode from 'vscode'

export interface FsAdapter {
  stat(uri: vscode.Uri): Thenable<vscode.FileStat>
  rename(source: vscode.Uri, target: vscode.Uri): Thenable<void>
  createDirectory(uri: vscode.Uri): Thenable<void>
}

export function getFeatureFilePath(featuresDir: string, filename: string): string {
  return path.join(featuresDir, `${filename}.md`)
}

/** Move a feature file into the board root, appending -N on name collisions. */
export async function moveFeatureFile(
  currentPath: string,
  featuresDir: string,
  fs: FsAdapter = vscode.workspace.fs
): Promise<string> {
  const filename = path.basename(currentPath)
  let targetPath = path.join(featuresDir, filename)

  if (currentPath === targetPath) return currentPath

  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let counter = 1
  while (await fileExists(targetPath, fs)) {
    targetPath = path.join(featuresDir, `${base}-${counter}${ext}`)
    counter++
  }

  await fs.createDirectory(vscode.Uri.file(featuresDir))
  await fs.rename(vscode.Uri.file(currentPath), vscode.Uri.file(targetPath))

  return targetPath
}

export async function fileExists(filePath: string, fs: FsAdapter = vscode.workspace.fs): Promise<boolean> {
  try {
    await fs.stat(vscode.Uri.file(filePath))
    return true
  } catch {
    return false
  }
}
