export interface ParsedUpdateReleaseNotes {
  items: string[];
  hasMore: boolean;
  summary: string | null;
  rawLines: string[];
}

export function parseUpdateReleaseNotes(
  releaseNotes: string | null | undefined,
  options: { maxItems?: number } = {}
): ParsedUpdateReleaseNotes {
  if (!releaseNotes) {
    return {
      items: [],
      hasMore: false,
      summary: null,
      rawLines: [],
    };
  }

  const maxItems = Number.isFinite(options.maxItems) ? Math.max(1, Number(options.maxItems)) : 3;
  const rawLines = releaseNotes
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '$1')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map(normalizeReleaseNoteLine)
    .filter(Boolean)
    .filter(isUsefulReleaseNoteLine);

  const uniqueLines = Array.from(new Set(rawLines));
  const candidateItems = uniqueLines.filter(line => isUsefulReleaseNoteLine(line));
  const items = candidateItems.slice(0, maxItems);
  const summary = uniqueLines.find(line => !looksLikeListItem(line)) || items[0] || null;

  return {
    items,
    hasMore: candidateItems.length > items.length,
    summary,
    rawLines: uniqueLines,
  };
}

function normalizeReleaseNoteLine(line: string) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^\[(.+)\]\(.+\)$/, '$1')
    .replace(/`/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function looksLikeListItem(line: string) {
  return /^[A-Z0-9][^.!?]*$/.test(line) || line.length <= 80;
}

function isUsefulReleaseNoteLine(line: string) {
  if (!line) return false;
  if (/^(changes|what's new|whats new|release notes?)[:]?$/i.test(line)) return false;
  if (/^version\s+/i.test(line)) return false;
  return true;
}
