import type { Severity } from '../models/Finding';

const RANK: Record<Severity, number> = {
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
  unknown: 0,
};

export function severityRank(severity: Severity): number {
  return RANK[severity];
}

export function highestSeverity(severities: Severity[]): Severity {
  if (severities.length === 0) {
    return 'informational';
  }
  return severities.reduce((current, next) =>
    severityRank(next) > severityRank(current) ? next : current,
  );
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'high':
      return 'High attention';
    case 'medium':
      return 'Medium attention';
    case 'low':
      return 'Low attention';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Informational';
  }
}

export function isReviewSeverity(severity: Severity): boolean {
  return severity === 'high' || severity === 'medium';
}
