import type { AuditResult, AuditSummary } from '../models/AuditResult';
import type { CapabilityKind } from '../models/Capability';
import type { Severity } from '../models/Finding';

export interface InventoryFilters {
  status: 'all' | 'enabled' | 'disabled';
  type: 'all' | 'builtin' | 'third-party';
  attention: 'all' | Severity;
  capability?: CapabilityKind;
  query?: string;
}

export function defaultFilters(): InventoryFilters {
  return { status: 'all', type: 'all', attention: 'all' };
}

export function filterResults(
  summary: AuditSummary | undefined,
  filters: InventoryFilters,
): AuditResult[] {
  if (!summary) {
    return [];
  }
  const query = filters.query?.trim().toLowerCase();
  return summary.results.filter((result) => {
    if (filters.status === 'enabled' && !result.extension.enabled) {
      return false;
    }
    if (filters.status === 'disabled' && result.extension.enabled) {
      return false;
    }
    if (filters.type === 'builtin' && !result.extension.isBuiltin) {
      return false;
    }
    if (filters.type === 'third-party' && !result.extension.isThirdParty) {
      return false;
    }
    if (filters.attention !== 'all' && result.attentionLevel !== filters.attention) {
      return false;
    }
    if (filters.capability && result.capabilities[filters.capability] <= 0) {
      return false;
    }
    if (query) {
      const haystack =
        `${result.extension.displayName} ${result.extension.id} ${result.extension.publisher}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}
