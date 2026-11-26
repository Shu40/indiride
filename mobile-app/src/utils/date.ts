/**
 * Normalizes any ISO or SQLite UTC datetime string to UTC millisecond timestamp.
 * Handles strings without timezone offset ('Z' or '+00:00'), which would otherwise
 * be mistakenly parsed as local time by standard JS `new Date(str)`.
 */
export const parseUtcDate = (dateStr?: string | null): number => {
  if (!dateStr) return Date.now();
  let cleanStr = String(dateStr).trim();
  if (!cleanStr) return Date.now();

  // If there is no trailing Z or timezone offset (+05:30, -04:00, etc.)
  const hasTimezone =
    cleanStr.endsWith('Z') ||
    cleanStr.endsWith('z') ||
    cleanStr.includes('+') ||
    /T.*\d{2}-\d{2}$/.test(cleanStr) ||
    / \d{2}-\d{2}$/.test(cleanStr);

  if (!hasTimezone) {
    // Replace space between date and time with T if present, and append Z
    cleanStr = cleanStr.replace(' ', 'T') + 'Z';
  } else {
    cleanStr = cleanStr.replace(' ', 'T');
  }

  const parsed = new Date(cleanStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
};
