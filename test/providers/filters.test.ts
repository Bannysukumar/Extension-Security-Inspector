import { EMPTY_CAPABILITY_COUNTS } from '../../src/models/Capability';
import type { AuditSummary } from '../../src/models/AuditResult';
import { defaultFilters, filterResults } from '../../src/utils/filters';
import { buildAuditResult } from '../../src/analyzer/findingsEngine';
import { emptyExtension } from '../helpers';

function summary(): AuditSummary {
  const enabled = buildAuditResult(
    emptyExtension({ id: 'a.enabled', displayName: 'Enabled', enabled: true }),
    [],
    {
      workspaceTrusted: true,
    },
  );
  const disabled = buildAuditResult(
    emptyExtension({ id: 'a.disabled', displayName: 'Disabled', enabled: false }),
    [],
    { workspaceTrusted: true },
  );
  const builtin = buildAuditResult(
    emptyExtension({
      id: 'vscode.helper',
      displayName: 'Helper',
      isBuiltin: true,
      isThirdParty: false,
      publisher: 'vscode',
    }),
    [],
    { workspaceTrusted: true },
  );
  enabled.capabilities = { ...EMPTY_CAPABILITY_COUNTS, network: 1 };
  enabled.attentionLevel = 'high';
  enabled.reviewRecommended = true;
  return {
    generatedAt: new Date().toISOString(),
    totalExtensions: 3,
    enabled: 2,
    disabled: 1,
    builtin: 1,
    thirdParty: 2,
    reviewRecommended: 1,
    highAttention: 1,
    mediumAttention: 0,
    lowAttention: 0,
    informational: 2,
    unknown: 0,
    capabilityTotals: { ...EMPTY_CAPABILITY_COUNTS, network: 1 },
    results: [enabled, disabled, builtin],
    workspaceTrusted: true,
    limitations: [],
  };
}

describe('inventory filters', () => {
  it('filters by status, type, attention, and capability', () => {
    const data = summary();
    expect(filterResults(data, { ...defaultFilters(), status: 'disabled' })).toHaveLength(1);
    expect(
      filterResults(data, { ...defaultFilters(), type: 'builtin' })[0]?.extension.isBuiltin,
    ).toBe(true);
    expect(filterResults(data, { ...defaultFilters(), attention: 'high' })).toHaveLength(1);
    expect(filterResults(data, { ...defaultFilters(), capability: 'network' })).toHaveLength(1);
    expect(filterResults(data, { ...defaultFilters(), query: 'disabled' })[0]?.extension.id).toBe(
      'a.disabled',
    );
  });
});
