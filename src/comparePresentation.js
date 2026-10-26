export function formatCompareResolutionStatus(leftCount, rightCount) {
  const unresolvedCounts = [leftCount, rightCount].filter(count => count > 1);
  if (unresolvedCounts.length === 0) return '';

  if (unresolvedCounts.length === 1 || unresolvedCounts[0] === unresolvedCounts[1]) {
    return `${unresolvedCounts[0]} matches found. Choose one exact taxon to compare.`;
  }

  return `${leftCount} matches found on the left and ${rightCount} on the right. Choose one exact taxon on each side to compare.`;
}
