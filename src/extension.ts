import * as vscode from 'vscode';
import { AUTO_AUDIT_DEBOUNCE_MS, COMMANDS, CONFIG_SECTION, MAIN_VIEW_ID } from './constants';
import { runAuditAll } from './commands/auditAll';
import { runAuditSelected } from './commands/auditSelected';
import { exportSecurityReport } from './commands/exportReport';
import type { AuditResult, AuditSummary } from './models/AuditResult';
import { ExtensionTreeProvider } from './providers/extensionTreeProvider';
import { SecurityTreeProvider } from './providers/securityTreeProvider';
import { AuditService } from './services/auditService';
import { listInstalledExtensions, readSettings } from './services/extensionService';
import { isReportFormat } from './services/reportService';
import { debounce } from './utils/debounce';
import { Logger } from './utils/logger';
import { capabilityFromUnknown, SecurityPanel } from './webview/SecurityPanel';

let logger: Logger;
let auditService: AuditService;
let latestSummary: AuditSummary | undefined;

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger();
  auditService = new AuditService(context, logger);

  const treeProvider = new SecurityTreeProvider();
  const inventoryProvider = new ExtensionTreeProvider();

  const treeView = vscode.window.createTreeView(MAIN_VIEW_ID, {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  const getSummary = () => latestSummary;
  const applySummary = (summary: AuditSummary | undefined) => {
    latestSummary = summary;
    treeProvider.setSummary(summary);
    inventoryProvider.setSummary(summary);
    SecurityPanel.current?.updateSummary(summary);
  };

  const showSummaryMessage = (summary: AuditSummary) => {
    const restricted = summary.restrictedModeNotice ? ` ${summary.restrictedModeNotice}` : '';
    void vscode.window.showInformationMessage(
      `Audit complete: ${summary.totalExtensions} extensions, ${summary.reviewRecommended} recommended for review, ${summary.highAttention} high attention.${restricted}`,
    );
  };

  const register = (command: string, callback: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  register(COMMANDS.auditAll, async () => {
    const summary = await runAuditAll(auditService, logger);
    if (summary) {
      applySummary(summary);
      SecurityPanel.show(context, auditService, getSummary, { kind: 'overview' });
      showSummaryMessage(summary);
    }
  });

  register(COMMANDS.auditSelected, async (extensionId?: unknown) => {
    const result = await runAuditSelected(
      auditService,
      logger,
      typeof extensionId === 'string' ? extensionId : undefined,
    );
    if (result) {
      mergeResult(result);
      SecurityPanel.show(context, auditService, getSummary).showDetail(result.extension.id);
    }
  });

  register(COMMANDS.exportReport, async (format?: unknown) => {
    await exportSecurityReport(latestSummary, logger, isReportFormat(format) ? format : undefined);
  });

  register(COMMANDS.refresh, async () => {
    auditService.cache.clear();
    const summary = await runAuditAll(auditService, logger);
    if (summary) {
      applySummary(summary);
    }
  });

  register(COMMANDS.openSettings, async () => {
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      `@ext:${context.extension.id}`,
    );
  });

  register(COMMANDS.compare, async () => {
    const extensions =
      latestSummary?.results.map((item) => item.extension) ?? (await listInstalledExtensions());
    const picked = await vscode.window.showQuickPick(
      extensions.map((item) => ({
        label: item.displayName,
        description: item.id,
        picked: false,
      })),
      { canPickMany: true, placeHolder: 'Select two or more extensions to compare' },
    );
    const ids =
      picked?.map((item) => item.description).filter((item): item is string => Boolean(item)) ?? [];
    if (ids.length < 2) {
      void vscode.window.showInformationMessage('Select at least two extensions to compare.');
      return;
    }
    SecurityPanel.show(context, auditService, getSummary).showCompare(ids);
  });

  register(COMMANDS.search, async () => {
    const query = await vscode.window.showInputBox({
      prompt:
        'Search by name, publisher, extension ID, capability, command, configuration, or finding',
      placeHolder: 'network',
    });
    if (query === undefined) {
      return;
    }
    SecurityPanel.show(context, auditService, getSummary).showSearch(query);
  });

  register(COMMANDS.openOverview, () => {
    SecurityPanel.show(context, auditService, getSummary, { kind: 'overview' });
  });

  register(COMMANDS.openPrivacy, () => {
    SecurityPanel.show(context, auditService, getSummary, { kind: 'privacy' });
  });

  register(COMMANDS.openExtension, (extensionId: unknown) => {
    if (typeof extensionId === 'string') {
      SecurityPanel.show(context, auditService, getSummary).showDetail(extensionId);
    }
  });

  register(COMMANDS.openCapability, (capability: unknown) => {
    const kind = typeof capability === 'string' ? capabilityFromUnknown(capability) : undefined;
    if (!kind) {
      return;
    }
    SecurityPanel.show(context, auditService, getSummary).showCapability(kind);
  });

  register(COMMANDS.openReports, () => {
    SecurityPanel.show(context, auditService, getSummary, { kind: 'reports' });
  });

  const scheduledAudit = debounce(() => {
    if (!readSettings().autoAudit) {
      return;
    }
    void runAuditAll(auditService, logger).then((summary) => {
      if (summary) {
        applySummary(summary);
      }
    });
  }, AUTO_AUDIT_DEBOUNCE_MS);

  context.subscriptions.push(
    logger,
    treeView,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        scheduledAudit();
      }
    }),
    vscode.extensions.onDidChange(() => {
      scheduledAudit();
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      logger.info('Workspace trust granted; some additional local analysis may now be available.');
    }),
  );

  if (readSettings().autoAudit) {
    scheduledAudit();
  }

  logger.info(`${context.extension.packageJSON.displayName} activated`);
}

export function deactivate(): void {
  SecurityPanel.current = undefined;
}

function mergeResult(result: AuditResult): void {
  if (!latestSummary) {
    return;
  }
  const results = latestSummary.results.filter((item) => item.extension.id !== result.extension.id);
  results.push(result);
  latestSummary = {
    ...latestSummary,
    results: results.sort((a, b) => a.extension.displayName.localeCompare(b.extension.displayName)),
  };
}
