/**
 * Normalize test text for comparison by collapsing whitespace.
 */
export function normalizeTestText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
