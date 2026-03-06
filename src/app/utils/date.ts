export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODateLocal(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();

  // Treat canonical YYYY-MM-DD values as local calendar dates (not UTC timestamps).
  const localIsoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (localIsoMatch) {
    const year = Number(localIsoMatch[1]);
    const month = Number(localIsoMatch[2]) - 1;
    const day = Number(localIsoMatch[3]);
    const date = new Date(year, month, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
