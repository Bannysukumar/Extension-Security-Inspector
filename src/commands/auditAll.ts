import * as vscode from 'vscode';
import type { AuditSummary } from '../models/AuditResult';
import type { AuditService } from '../services/auditService';
import type { Logger } from '../utils/logger';

export async function runAuditAll(
  auditService: AuditService,
  logger: Logger,
): Promise<AuditSummary | undefined> {
  try {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Extension Security Inspector: auditing installed extensions',
        cancellable: true,
      },
      async (_progress, token) => auditService.auditAll(token),
    );
  } catch (error) {
    logger.error('Audit failed', error);
    void vscode.window.showErrorMessage(
      'Unable to complete the extension audit. See the output channel for details.',
    );
    return undefined;
  }
}
