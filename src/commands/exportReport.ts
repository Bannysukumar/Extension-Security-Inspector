import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import type { AuditSummary } from '../models/AuditResult';
import { readSettings } from '../services/extensionService';
import {
  fileExtensionFor,
  isReportFormat,
  renderReport,
  type ReportFormat,
} from '../services/reportService';
import type { Logger } from '../utils/logger';

export async function exportSecurityReport(
  summary: AuditSummary | undefined,
  logger: Logger,
  format?: ReportFormat,
): Promise<vscode.Uri | undefined> {
  if (!summary) {
    void vscode.window.showInformationMessage('Run an audit before exporting a report.');
    return undefined;
  }

  const chosen = isReportFormat(format)
    ? format
    : (
        await vscode.window.showQuickPick(
          [
            {
              label: 'Markdown',
              description: 'Human-readable report',
              format: 'markdown' as const,
            },
            { label: 'JSON', description: 'Machine-readable report', format: 'json' as const },
            { label: 'HTML', description: 'Browser-readable report', format: 'html' as const },
          ],
          { placeHolder: 'Choose a report format' },
        )
      )?.format;

  if (!chosen) {
    return undefined;
  }

  const settings = readSettings();
  const fileName = `extension-security-audit-${safeStamp(summary.generatedAt)}.${fileExtensionFor(chosen)}`;
  let target: vscode.Uri | undefined;

  if (settings.reportDirectory.trim()) {
    target = vscode.Uri.file(path.join(settings.reportDirectory.trim(), fileName));
  } else {
    target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(os.homedir(), fileName)),
      filters: {
        Markdown: ['md'],
        JSON: ['json'],
        HTML: ['html'],
      },
    });
  }

  if (!target) {
    return undefined;
  }

  try {
    const contents = renderReport(summary, chosen);
    await fs.mkdir(path.dirname(target.fsPath), { recursive: true });
    await fs.writeFile(target.fsPath, contents, 'utf8');
    void vscode.window.showInformationMessage(`Exported security report to ${target.fsPath}`);
    return target;
  } catch (error) {
    logger.error('Report export failed', error);
    void vscode.window.showErrorMessage('Unable to export the security report.');
    return undefined;
  }
}

function safeStamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}
