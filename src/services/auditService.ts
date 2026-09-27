import * as vscode from 'vscode';
import { addCapabilityTotals } from '../analyzer/capabilityAnalyzer';
import { analyzeDependencies, DependencyAnalyzer } from '../analyzer/dependencyAnalyzer';
import { discoverExtensions } from '../analyzer/extensionScanner';
import { RuleAnalyzer, buildAuditResult, runAnalyzers } from '../analyzer/findingsEngine';
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  LEGACY_CACHE_STORAGE_KEY,
  LIMITATIONS,
  RESTRICTED_MODE_NOTICE,
  SCAN_BATCH_SIZE,
} from '../constants';
import { EMPTY_CAPABILITY_COUNTS } from '../models/Capability';
import type {
  AuditHistoryEntry,
  AuditResult,
  AuditSummary,
  SecurityAnalyzer,
} from '../models/AuditResult';
import type { ExtensionInfo } from '../models/ExtensionInfo';
import { yieldToEventLoop } from '../utils/debounce';
import type { Logger } from '../utils/logger';
import { CacheService, toCacheKey } from './cacheService';
import { readSettings, workspaceIsTrusted } from './extensionService';

export class AuditService {
  readonly cache: CacheService;
  private readonly history: AuditHistoryEntry[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger,
  ) {
    this.cache = new CacheService();
    this.history = context.globalState.get<AuditHistoryEntry[]>(HISTORY_STORAGE_KEY, []);
    void context.globalState.update(LEGACY_CACHE_STORAGE_KEY, undefined);
  }

  getHistory(): AuditHistoryEntry[] {
    return [...this.history];
  }

  async auditAll(token?: vscode.CancellationToken): Promise<AuditSummary> {
    const settings = readSettings();
    const trusted = workspaceIsTrusted();
    this.logger.info('Starting extension audit');
    const extensions = await discoverExtensions(settings);
    this.logger.info(`Found ${extensions.length} installed extensions`);

    const results: AuditResult[] = [];
    for (let index = 0; index < extensions.length; index += SCAN_BATCH_SIZE) {
      if (token?.isCancellationRequested) {
        break;
      }
      const batch = extensions.slice(index, index + SCAN_BATCH_SIZE);
      const analyzed = await Promise.all(
        batch.map((extension) =>
          this.auditOne(extension, trusted, settings.scanDependencies && trusted, token),
        ),
      );
      results.push(...analyzed);
      await yieldToEventLoop();
    }

    const summary = this.buildSummary(results, trusted);
    this.logger.info('Audit completed');
    this.logger.info(`${summary.reviewRecommended} extensions require review`);
    await this.persist(summary);
    return summary;
  }

  async auditSelected(
    extension: ExtensionInfo,
    token?: vscode.CancellationToken,
  ): Promise<AuditResult> {
    const settings = readSettings();
    const trusted = workspaceIsTrusted();
    this.logger.info(`Analyzing ${extension.displayName}`);
    return this.auditOne(extension, trusted, settings.scanDependencies && trusted, token);
  }

  private async auditOne(
    extension: ExtensionInfo,
    trusted: boolean,
    scanDependencies: boolean,
    token?: vscode.CancellationToken,
  ): Promise<AuditResult> {
    if (token?.isCancellationRequested) {
      return buildAuditResult(extension, [], {
        workspaceTrusted: trusted,
        analysisNotes: ['Scan cancelled.'],
      });
    }

    const cached = this.cache.get(toCacheKey({ extension }));
    if (cached) {
      return {
        ...cached,
        workspaceTrusted: trusted,
        analysisNotes: mergeNotes(cached.analysisNotes, trusted),
      };
    }

    this.logger.info(`Analyzing ${extension.displayName}`);
    const settings = readSettings();
    const analyzers: SecurityAnalyzer[] = [
      new RuleAnalyzer({ showUnknownCapabilities: settings.showUnknownCapabilities }),
    ];
    if (scanDependencies) {
      analyzers.push(new DependencyAnalyzer());
    }

    let findings;
    try {
      findings = await Promise.resolve(runAnalyzers(extension, analyzers));
    } catch (error) {
      this.logger.error(`Unable to analyze ${extension.displayName}`, error);
      findings = [
        {
          id: 'analysis-error',
          severity: 'unknown' as const,
          title: `Unable to analyze ${extension.displayName}`,
          category: 'metadata' as const,
          confidence: 'high' as const,
          detectionSource: 'auditService',
          evidence: ['An unexpected analysis error occurred and was isolated to this extension.'],
          explanation:
            'Analysis of this extension failed. Remaining extensions continued to be scanned. Technical details were written to the output channel without secrets.',
          recommendation:
            'Retry the audit. If the error persists, inspect the local manifest manually.',
        },
      ];
    }

    const notes = mergeNotes([], trusted);
    const result = buildAuditResult(extension, findings, {
      workspaceTrusted: trusted,
      analysisNotes: notes,
    });

    if (scanDependencies) {
      try {
        result.dependencyOverview = await analyzeDependencies(extension);
      } catch (error) {
        this.logger.error(`Dependency overview unavailable for ${extension.displayName}`, error);
      }
    }

    this.cache.set(result);
    return result;
  }

  private buildSummary(results: AuditResult[], trusted: boolean): AuditSummary {
    const capabilityTotals = { ...EMPTY_CAPABILITY_COUNTS };
    for (const result of results) {
      addCapabilityTotals(capabilityTotals, result.capabilities);
    }
    return {
      generatedAt: new Date().toISOString(),
      totalExtensions: results.length,
      enabled: results.filter((item) => item.extension.enabled).length,
      disabled: results.filter((item) => !item.extension.enabled).length,
      builtin: results.filter((item) => item.extension.isBuiltin).length,
      thirdParty: results.filter((item) => item.extension.isThirdParty).length,
      reviewRecommended: results.filter((item) => item.reviewRecommended).length,
      highAttention: results.filter((item) => item.attentionLevel === 'high').length,
      mediumAttention: results.filter((item) => item.attentionLevel === 'medium').length,
      lowAttention: results.filter((item) => item.attentionLevel === 'low').length,
      informational: results.filter((item) => item.attentionLevel === 'informational').length,
      unknown: results.filter(
        (item) => item.attentionLevel === 'unknown' || item.extension.metadataInsufficient,
      ).length,
      capabilityTotals,
      results,
      workspaceTrusted: trusted,
      limitations: [...LIMITATIONS],
      restrictedModeNotice: trusted ? undefined : RESTRICTED_MODE_NOTICE,
    };
  }

  private async persist(summary: AuditSummary): Promise<void> {
    this.history.unshift({
      timestamp: summary.generatedAt,
      totalExtensions: summary.totalExtensions,
      enabled: summary.enabled,
      thirdParty: summary.thirdParty,
      highAttention: summary.highAttention,
      mediumAttention: summary.mediumAttention,
      reviewRecommended: summary.reviewRecommended,
      unknown: summary.unknown,
    });
    this.history.splice(HISTORY_LIMIT);
    await this.context.globalState.update(HISTORY_STORAGE_KEY, this.history);
  }
}

function mergeNotes(existing: string[], trusted: boolean): string[] {
  const notes = [...existing];
  if (!trusted && !notes.includes(RESTRICTED_MODE_NOTICE)) {
    notes.push(RESTRICTED_MODE_NOTICE);
  }
  return notes;
}
