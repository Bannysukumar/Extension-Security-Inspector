import * as vscode from 'vscode';
import { COMMANDS, WEBVIEW_VIEW_TYPE } from '../constants';
import type { AuditResult, AuditSummary } from '../models/AuditResult';
import type { CapabilityKind } from '../models/Capability';
import { CAPABILITY_LABELS } from '../models/Capability';
import type { AuditService } from '../services/auditService';
import { findExtensionById } from '../services/extensionService';
import { escapeHtml } from '../utils/sanitization';
import { severityLabel } from '../utils/severity';
import { getNonce, renderWebviewHtml } from './html';
import { parseIncomingMessage } from './messages';

export type PanelView =
  | { kind: 'overview' }
  | { kind: 'detail'; extensionId: string }
  | { kind: 'compare'; extensionIds: string[] }
  | { kind: 'search'; query: string }
  | { kind: 'reports' }
  | { kind: 'privacy' }
  | { kind: 'capability'; capability: CapabilityKind };

export class SecurityPanel {
  public static current: SecurityPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private view: PanelView = { kind: 'overview' };
  private summary: AuditSummary | undefined;
  private disposed = false;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly auditService: AuditService,
    private readonly getSummary: () => AuditSummary | undefined,
  ) {
    this.panel = panel;
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => {
      this.disposed = true;
      SecurityPanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage(async (raw) => {
      const message = parseIncomingMessage(raw);
      if (!message) {
        return;
      }
      switch (message.type) {
        case 'ready':
          await this.render();
          break;
        case 'openExtension':
          await this.showDetail(message.extensionId);
          break;
        case 'compare':
          await this.showCompare(message.extensionIds);
          break;
        case 'search':
          this.view = { kind: 'search', query: message.query };
          await this.render();
          break;
        case 'export':
          await vscode.commands.executeCommand(COMMANDS.exportReport, message.format);
          break;
        case 'refresh':
          await vscode.commands.executeCommand(COMMANDS.refresh);
          break;
        case 'openPrivacy':
          this.view = { kind: 'privacy' };
          await this.render();
          break;
        case 'openOverview':
          this.view = { kind: 'overview' };
          await this.render();
          break;
        case 'openReports':
          this.view = { kind: 'reports' };
          await this.render();
          break;
        default:
          break;
      }
    });
  }

  static show(
    context: vscode.ExtensionContext,
    auditService: AuditService,
    getSummary: () => AuditSummary | undefined,
    view?: PanelView,
  ): SecurityPanel {
    if (SecurityPanel.current) {
      SecurityPanel.current.summary = getSummary();
      if (view) {
        SecurityPanel.current.view = view;
      }
      void SecurityPanel.current.render();
      SecurityPanel.current.panel.reveal(vscode.ViewColumn.One, true);
      return SecurityPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      WEBVIEW_VIEW_TYPE,
      'Extension Security Inspector',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    SecurityPanel.current = new SecurityPanel(panel, context, auditService, getSummary);
    SecurityPanel.current.summary = getSummary();
    if (view) {
      SecurityPanel.current.view = view;
    }
    return SecurityPanel.current;
  }

  async showOverview(): Promise<void> {
    this.view = { kind: 'overview' };
    await this.render();
  }

  async showDetail(extensionId: string): Promise<void> {
    this.view = { kind: 'detail', extensionId };
    this.panel.reveal(vscode.ViewColumn.One, true);
    await this.render();
  }

  async showCompare(extensionIds: string[]): Promise<void> {
    this.view = { kind: 'compare', extensionIds };
    await this.render();
  }

  async showSearch(query: string): Promise<void> {
    this.view = { kind: 'search', query };
    await this.render();
  }

  async showCapability(capability: CapabilityKind): Promise<void> {
    this.view = { kind: 'capability', capability };
    await this.render();
  }

  async showReports(): Promise<void> {
    this.view = { kind: 'reports' };
    await this.render();
  }

  async showPrivacy(): Promise<void> {
    this.view = { kind: 'privacy' };
    await this.render();
  }

  updateSummary(summary: AuditSummary | undefined): void {
    this.summary = summary;
    if (!this.disposed) {
      void this.render();
    }
  }

  private html(): string {
    const nonce = getNonce();
    const scriptUri = this.panel.webview
      .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js'))
      .toString();
    const styleUri = this.panel.webview
      .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.css'))
      .toString();
    return renderWebviewHtml(this.panel.webview, { scriptUri, styleUri, nonce });
  }

  private async render(): Promise<void> {
    const summary = this.summary ?? this.getSummary();
    const payload = await this.payload(summary);
    await this.panel.webview.postMessage({ type: 'render', payload });
  }

  private async payload(summary: AuditSummary | undefined): Promise<Record<string, unknown>> {
    const view = this.view;
    if (!summary) {
      return {
        view: 'overview',
        empty: true,
        title: 'Run a local audit to see installed extension capabilities.',
      };
    }

    if (view.kind === 'overview') {
      return { view: 'overview', summary: toOverviewDto(summary) };
    }
    if (view.kind === 'privacy') {
      return { view: 'privacy' };
    }
    if (view.kind === 'reports') {
      return {
        view: 'reports',
        history: this.auditService.getHistory(),
        summary: toOverviewDto(summary),
      };
    }
    if (view.kind === 'search') {
      return {
        view: 'search',
        query: view.query,
        results: searchResults(summary, view.query),
      };
    }
    if (view.kind === 'capability') {
      return {
        view: 'capability',
        capability: view.capability,
        label: CAPABILITY_LABELS[view.capability],
        results: summary.results
          .filter((result) => result.capabilities[view.capability] > 0)
          .map(toListDto),
      };
    }
    if (view.kind === 'compare') {
      const selected = await Promise.all(
        view.extensionIds.map((id) => this.ensureResult(summary, id)),
      );
      return {
        view: 'compare',
        extensions: selected.filter((item): item is AuditResult => Boolean(item)).map(toCompareDto),
      };
    }

    const result = await this.ensureResult(summary, view.extensionId);
    if (!result) {
      return { view: 'detail', missing: true, extensionId: view.extensionId };
    }
    return { view: 'detail', detail: toDetailDto(result) };
  }

  private async ensureResult(
    summary: AuditSummary,
    extensionId: string,
  ): Promise<AuditResult | undefined> {
    const existing = summary.results.find((item) => item.extension.id === extensionId);
    if (existing) {
      return existing;
    }
    const info = await findExtensionById(extensionId);
    if (!info) {
      return undefined;
    }
    return this.auditService.auditSelected(info);
  }
}

function toOverviewDto(summary: AuditSummary) {
  return {
    generatedAt: summary.generatedAt,
    totals: {
      extensions: summary.totalExtensions,
      enabled: summary.enabled,
      disabled: summary.disabled,
      thirdParty: summary.thirdParty,
      builtin: summary.builtin,
      reviewRecommended: summary.reviewRecommended,
      highAttention: summary.highAttention,
      unknown: summary.unknown,
    },
    capabilities: summary.capabilityTotals,
    findings: {
      high: summary.highAttention,
      medium: summary.mediumAttention,
      low: summary.lowAttention,
    },
    restrictedModeNotice: summary.restrictedModeNotice,
    extensions: summary.results.map(toListDto),
  };
}

function toListDto(result: AuditResult) {
  return {
    id: result.extension.id,
    displayName: result.extension.displayName,
    publisher: result.extension.publisher,
    version: result.extension.version,
    enabled: result.extension.enabled,
    builtin: result.extension.isBuiltin,
    attention: severityLabel(result.attentionLevel),
    attentionId: result.attentionLevel,
    capabilities: result.capabilities,
    reviewRecommended: result.reviewRecommended,
  };
}

function toDetailDto(result: AuditResult) {
  const ext = result.extension;
  return {
    id: ext.id,
    displayName: ext.displayName,
    publisher: ext.publisher,
    version: ext.version,
    status: ext.enabled ? 'Enabled' : 'Disabled',
    builtin: ext.isBuiltin,
    description: ext.description,
    homepage: ext.homepage,
    repository: ext.repository,
    marketplaceUrl: ext.marketplaceUrl,
    installation: ext.extensionPath,
    activationEvents: ext.activationEvents,
    commands: ext.contributes.commands,
    configuration: ext.contributes.configuration,
    languages: ext.contributes.languages,
    tasks: ext.contributes.taskDefinitions,
    debuggers: ext.contributes.debuggers,
    terminals: ext.contributes.terminals,
    authentication: ext.contributes.authentication,
    webviews: ext.contributes.webviewHints,
    snippets: ext.contributes.snippets,
    themes: ext.contributes.themes,
    fileSystemProviders: ext.contributes.fileSystemProviders,
    languageProviders: ext.contributes.languageProviders,
    other: ext.contributes.other,
    capabilities: result.capabilities,
    findings: result.findings,
    whyReview: result.findings
      .filter((finding) => finding.severity === 'high' || finding.severity === 'medium')
      .map((finding) => finding.title),
    notes: result.analysisNotes,
    dependencyOverview: result.dependencyOverview,
    attention: severityLabel(result.attentionLevel),
  };
}

function toCompareDto(result: AuditResult) {
  return {
    id: result.extension.id,
    displayName: result.extension.displayName,
    capabilities: result.capabilities,
    attention: severityLabel(result.attentionLevel),
    findings: result.findings.map((finding) => finding.title),
  };
}

function searchResults(summary: AuditSummary, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  return summary.results.filter((result) => matchesQuery(result, needle)).map(toListDto);
}

function matchesQuery(result: AuditResult, needle: string): boolean {
  const ext = result.extension;
  const haystacks = [
    ext.displayName,
    ext.id,
    ext.publisher,
    ext.description,
    ...ext.activationEvents,
    ...ext.contributes.commands.map((item) => `${item.command} ${item.title ?? ''}`),
    ...ext.contributes.configuration.map((item) => item.key),
    ...result.findings.map((item) => `${item.title} ${item.category}`),
    ...Object.entries(result.capabilities)
      .filter(([, count]) => count > 0)
      .map(([key]) => key),
  ];
  return haystacks.some((item) => item.toLowerCase().includes(needle));
}

export function capabilityFromUnknown(value: string): CapabilityKind | undefined {
  const allowed: CapabilityKind[] = [
    'filesystem',
    'process',
    'network',
    'authentication',
    'webview',
    'tasks',
    'terminal',
    'debugger',
  ];
  return allowed.find((item) => item === value);
}

export function escapeForStatus(value: string): string {
  return escapeHtml(value);
}
