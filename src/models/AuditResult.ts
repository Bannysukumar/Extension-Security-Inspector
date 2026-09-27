import type { CapabilityCounts } from './Capability';
import type { ExtensionInfo } from './ExtensionInfo';
import type { Finding, Severity } from './Finding';

export interface DependencyOverview {
  available: boolean;
  directDependencies: Array<{ name: string; requested?: string; locked?: string }>;
  dependencyCount: number;
  lockfilePresent: boolean;
  lockfileName?: string;
  maxDepth?: number;
  rangeMismatches: string[];
  vulnerabilityStatus: string;
  note: string;
}

export interface AuditResult {
  extension: ExtensionInfo;
  findings: Finding[];
  capabilities: CapabilityCounts;
  attentionLevel: Severity;
  reviewRecommended: boolean;
  dependencyOverview?: DependencyOverview;
  analyzedAt: string;
  workspaceTrusted: boolean;
  cached: boolean;
  analysisNotes: string[];
}

export interface AuditSummary {
  generatedAt: string;
  totalExtensions: number;
  enabled: number;
  disabled: number;
  builtin: number;
  thirdParty: number;
  reviewRecommended: number;
  highAttention: number;
  mediumAttention: number;
  lowAttention: number;
  informational: number;
  unknown: number;
  capabilityTotals: CapabilityCounts;
  results: AuditResult[];
  workspaceTrusted: boolean;
  limitations: string[];
  restrictedModeNotice?: string;
}

export interface AuditHistoryEntry {
  timestamp: string;
  totalExtensions: number;
  enabled: number;
  thirdParty: number;
  highAttention: number;
  mediumAttention: number;
  reviewRecommended: number;
  unknown: number;
}

export interface CacheKey {
  extensionId: string;
  version: string;
  packageJsonMtime?: number;
  extensionPath?: string;
}

export interface SecurityAnalyzer {
  id: string;
  analyze(extension: ExtensionInfo): Promise<Finding[]> | Finding[];
}
