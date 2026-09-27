import type { AuditResult, SecurityAnalyzer } from '../models/AuditResult';
import type { ExtensionInfo } from '../models/ExtensionInfo';
import type { Finding, Severity } from '../models/Finding';
import { isReviewSeverity } from '../utils/severity';
import { analyzeCapabilities } from './capabilityAnalyzer';
import { riskRules, type RuleContext } from './riskRules';

export class RuleAnalyzer implements SecurityAnalyzer {
  readonly id = 'rule-analyzer';

  constructor(private readonly context: RuleContext) {}

  analyze(extension: ExtensionInfo): Finding[] {
    const findings: Finding[] = [];
    for (const rule of riskRules) {
      const result = rule.analyze(extension, this.context);
      if (!result) {
        continue;
      }
      if (Array.isArray(result)) {
        findings.push(...result);
      } else {
        findings.push(result);
      }
    }
    return dedupeFindings(findings);
  }
}

export async function runAnalyzers(
  extension: ExtensionInfo,
  analyzers: SecurityAnalyzer[],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const analyzer of analyzers) {
    const result = await analyzer.analyze(extension);
    if (Array.isArray(result)) {
      findings.push(...result);
    }
  }
  return dedupeFindings(findings);
}

export function buildAuditResult(
  extension: ExtensionInfo,
  findings: Finding[],
  options: {
    workspaceTrusted: boolean;
    cached?: boolean;
    analyzedAt?: string;
    analysisNotes?: string[];
  },
): AuditResult {
  const capabilities = analyzeCapabilities(extension, findings);
  const attentionLevel = deriveAttentionLevel(findings);
  return {
    extension,
    findings,
    capabilities,
    attentionLevel,
    reviewRecommended: isReviewSeverity(attentionLevel),
    analyzedAt: options.analyzedAt ?? new Date().toISOString(),
    workspaceTrusted: options.workspaceTrusted,
    cached: Boolean(options.cached),
    analysisNotes: options.analysisNotes ?? [],
  };
}

export function deriveAttentionLevel(findings: Finding[]): Severity {
  const actionable = findings.filter(
    (finding) => finding.id !== 'commands-contributed' && finding.id !== 'node-runtime',
  );
  if (actionable.some((finding) => finding.severity === 'high')) {
    return 'high';
  }
  if (actionable.some((finding) => finding.severity === 'medium')) {
    return 'medium';
  }
  if (actionable.some((finding) => finding.severity === 'low')) {
    return 'low';
  }
  if (actionable.some((finding) => finding.severity === 'unknown')) {
    return 'unknown';
  }
  return 'informational';
}

export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const result: Finding[] = [];
  for (const finding of findings) {
    if (seen.has(finding.id)) {
      continue;
    }
    seen.add(finding.id);
    result.push(finding);
  }
  return result;
}
