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
  const sourceLines = releaseNotes
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '$1')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map(line => ({
      explicitListItem: isExplicitListItem(line),
      value: normalizeReleaseNoteLine(line),
    }))
    .filter(({ value }) => value)
    .filter(({ value }) => isUsefulReleaseNoteLine(value));

  const uniqueLines = Array.from(new Map(sourceLines.map(item => [item.value, item])).values());
  const hasExplicitList = uniqueLines.some(item => item.explicitListItem);
  const candidateItems = hasExplicitList
    ? uniqueLines.reduce<string[]>((items, item) => {
      if (item.explicitListItem || items.length === 0) {
        items.push(item.value);
      } else {
        items[items.length - 1] = `${items[items.length - 1]} ${item.value}`;
      }
      return items;
    }, [])
    : [uniqueLines.map(item => item.value).join(' ')].filter(Boolean);
  const items = candidateItems.slice(0, maxItems);
  const summary = uniqueLines.find(line => !looksLikeListItem(line.value))?.value || items[0] || null;

  return {
    items,
    hasMore: candidateItems.length > items.length,
    summary,
    rawLines: uniqueLines.map(item => item.value),
  };
}

function isExplicitListItem(line: string) {
  return /^\s*(?:[-*•]\s+|\d+\.\s+)/.test(line);
}

function normalizeReleaseNoteLine(line: string) {
  return line
    .trim()
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
