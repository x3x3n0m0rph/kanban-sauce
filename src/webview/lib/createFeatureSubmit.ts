/**
 * Decide whether closing the create dialog should persist a new card.
 * Pristine (unedited) board description templates alone must not create a draft.
 */
export function shouldCreateFeatureOnClose(
  title: string,
  description: string,
  descriptionDirty: boolean
): boolean {
  const heading = title.trim()
  const body = description.trim()
  if (!heading && !body) return false
  if (!heading && !descriptionDirty) return false
  return true
}

/** Build markdown content for a new feature from title + description body. */
export function buildCreateFeatureContent(title: string, description: string): string {
  const heading = title.trim()
  const body = description.trim()
  return heading
    ? `# ${heading}${body ? '\n\n' + body : ''}`
    : body
}
