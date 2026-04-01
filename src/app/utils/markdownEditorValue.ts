export function normalizeMarkdownEditorValue(value: string): string {
  return value.trim().length === 0 ? '' : value;
}
