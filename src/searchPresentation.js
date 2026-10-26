export function formatNameMatchHeading(count) {
  const normalizedCount = Math.max(0, Number(count) || 0);
  return `${normalizedCount} name ${normalizedCount === 1 ? 'match' : 'matches'}`;
}
