import * as vscode from 'vscode';
import type { AuditResult } from '../models/AuditResult';
import type { AuditService } from '../services/auditService';
import { findExtensionById, listInstalledExtensions } from '../services/extensionService';
import type { Logger } from '../utils/logger';

export async function runAuditSelected(
  auditService: AuditService,
  logger: Logger,
  extensionId?: string,
): Promise<AuditResult | undefined> {
  try {
    const selectedId = extensionId ?? (await pickExtensionId());
    if (!selectedId) {
      return undefined;
    }
    const info = await findExtensionById(selectedId);
    if (!info) {
      void vscode.window.showWarningMessage(`Unable to analyze ${selectedId}.`);
      return undefined;
    }
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Auditing ${info.displayName}`,
        cancellable: true,
      },
      async (_progress, token) => auditService.auditSelected(info, token),
    );
  } catch (error) {
    logger.error('Selected extension audit failed', error);
    void vscode.window.showErrorMessage('Unable to audit the selected extension.');
    return undefined;
  }
}

async function pickExtensionId(): Promise<string | undefined> {
  const extensions = await listInstalledExtensions();
  const picked = await vscode.window.showQuickPick(
    extensions.map((item) => ({
      label: item.displayName,
      description: item.id,
      detail: `${item.publisher} · ${item.version}`,
      id: item.id,
    })),
    { placeHolder: 'Select an extension to audit', matchOnDescription: true, matchOnDetail: true },
  );
  return picked?.id;
}
