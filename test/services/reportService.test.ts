import { EMPTY_CAPABILITY_COUNTS } from '../../src/models/Capability';
import type { AuditSummary } from '../../src/models/AuditResult';
import {
  isReportFormat,
  renderHtml,
  renderJson,
  renderMarkdown,
} from '../../src/services/reportService';
import { buildAuditResult } from '../../src/analyzer/findingsEngine';
import { emptyExtension } from '../helpers';

function sampleSummary(): AuditSummary {
  const result = buildAuditResult(
    emptyExtension({
      displayName: 'Example Extension',
      publisher: 'Example Publisher',
      version: '1.2.3',
    }),
    [
      {
        id: 'process-tasks',
        severity: 'medium',
        title: 'Process-related functionality detected',
        evidence: ['exampleTask'],
        explanation: 'This extension contributes task functionality.',
        recommendation: 'Review whether this capability is expected.',
        confidence: 'high',
        detectionSource: 'test',
        category: 'tasks',
      },
    ],
    { workspaceTrusted: true },
  );
  return {
    generatedAt: '2026-09-27T00:00:00.000Z',
    totalExtensions: 1,
    enabled: 1,
    disabled: 0,
    builtin: 0,
    thirdParty: 1,
    reviewRecommended: 1,
    highAttention: 0,
    mediumAttention: 1,
    lowAttention: 0,
    informational: 0,
    unknown: 0,
    capabilityTotals: { ...EMPTY_CAPABILITY_COUNTS, process: 1, tasks: 1 },
    results: [result],
    workspaceTrusted: true,
    limitations: ['This audit cannot prove that an extension is safe or malicious.'],
  };
}

describe('reportService', () => {
  it('renders markdown with summary and limitations', () => {
    const markdown = renderMarkdown(sampleSummary());
    expect(markdown).toContain('# VS Code Extension Security Audit');
    expect(markdown).toContain('Example Extension');
    expect(markdown).toContain('Process-related functionality detected');
    expect(markdown).toContain('not a malware verdict');
    expect(markdown).not.toMatch(/password|token|secret=/i);
  });

  it('renders json without secrets', () => {
    const json = renderJson(sampleSummary());
    expect(JSON.parse(json).totalExtensions).toBe(1);
    expect(json).not.toContain('Bearer ');
  });

  it('keeps JSON valid after redacting secret-like metadata', () => {
    const summary = sampleSummary();
    const first = summary.results[0];
    if (first) {
      first.extension.description = 'endpoint token=abcdEFGH1234 and password=supersecret';
    }
    const json = renderJson(summary);
    const parsed = JSON.parse(json) as { results: Array<{ extension: { description: string } }> };
    expect(parsed.results[0]?.extension.description).toContain('[REDACTED]');
    expect(parsed.results[0]?.extension.description).not.toContain('supersecret');
  });

  it('accepts only supported export formats', () => {
    expect(isReportFormat('markdown')).toBe(true);
    expect(isReportFormat('json')).toBe(true);
    expect(isReportFormat('html')).toBe(true);
    expect(isReportFormat('exe')).toBe(false);
    expect(isReportFormat(undefined)).toBe(false);
  });

  it('escapes html from extension metadata', () => {
    const summary = sampleSummary();
    const poisoned = summary.results[0];
    if (poisoned) {
      poisoned.extension.displayName = '<script>alert(1)</script>';
    }
    const html = renderHtml(summary);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
