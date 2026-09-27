import {
  buildAuditResult,
  deriveAttentionLevel,
  runAnalyzers,
} from '../../src/analyzer/findingsEngine';
import { RuleAnalyzer } from '../../src/analyzer/findingsEngine';
import type { Finding } from '../../src/models/Finding';
import { emptyExtension, extensionFromFixture } from '../helpers';

describe('findingsEngine', () => {
  it('derives attention without treating informational findings as review', () => {
    const findings: Finding[] = [
      {
        id: 'commands-contributed',
        severity: 'informational',
        title: 'Commands contributed',
        evidence: [],
        explanation: '',
        recommendation: '',
        confidence: 'high',
        detectionSource: 'test',
        category: 'commands',
      },
    ];
    expect(deriveAttentionLevel(findings)).toBe('informational');
  });

  it('elevates attention for high findings', () => {
    expect(
      deriveAttentionLevel([
        {
          id: 'authentication-provider',
          severity: 'high',
          title: 'Authentication',
          evidence: [],
          explanation: '',
          recommendation: '',
          confidence: 'high',
          detectionSource: 'test',
          category: 'authentication',
        },
      ]),
    ).toBe('high');
  });

  it('builds a complete audit result', () => {
    const extension = extensionFromFixture('auth-extension.json');
    const findings = new RuleAnalyzer({ showUnknownCapabilities: true }).analyze(extension);
    const result = buildAuditResult(extension, findings, { workspaceTrusted: true });
    expect(result.reviewRecommended).toBe(true);
    expect(result.attentionLevel).toBe('high');
    expect(result.findings[0]).toMatchObject({
      id: expect.any(String),
      severity: expect.any(String),
      title: expect.any(String),
      evidence: expect.any(Array),
      explanation: expect.any(String),
      recommendation: expect.any(String),
      confidence: expect.any(String),
      detectionSource: expect.any(String),
    });
  });

  it('runs analyzers including async ones', async () => {
    const findings = await runAnalyzers(emptyExtension(), [
      {
        id: 'async',
        analyze: async () => [
          {
            id: 'async-finding',
            severity: 'low',
            title: 'Async',
            evidence: [],
            explanation: 'x',
            recommendation: 'y',
            confidence: 'high',
            detectionSource: 'test',
            category: 'other',
          },
        ],
      },
    ]);
    expect(findings.map((item) => item.id)).toContain('async-finding');
  });

  it('marks disabled extensions without changing capability logic', () => {
    const extension = extensionFromFixture('tasks-extension.json', { enabled: false });
    const findings = new RuleAnalyzer({ showUnknownCapabilities: true }).analyze(extension);
    const result = buildAuditResult(extension, findings, { workspaceTrusted: true });
    expect(result.extension.enabled).toBe(false);
    expect(result.reviewRecommended).toBe(true);
  });

  it('marks built-in extensions separately', () => {
    const extension = extensionFromFixture('builtin-extension.json');
    expect(extension.isBuiltin).toBe(true);
    expect(extension.isThirdParty).toBe(false);
  });
});
