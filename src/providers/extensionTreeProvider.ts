import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import type { AuditResult, AuditSummary } from '../models/AuditResult';
import { defaultFilters, filterResults, type InventoryFilters } from '../utils/filters';
import { severityLabel } from '../utils/severity';

export type { InventoryFilters } from '../utils/filters';
export { defaultFilters, filterResults } from '../utils/filters';

export class ExtensionTreeProvider implements vscode.TreeDataProvider<ExtensionItem> {
  private readonly emitter = new vscode.EventEmitter<ExtensionItem | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private summary: AuditSummary | undefined;
  private filters: InventoryFilters = defaultFilters();

  setSummary(summary: AuditSummary | undefined): void {
    this.summary = summary;
    this.refresh();
  }

  setFilters(filters: Partial<InventoryFilters>): void {
    this.filters = { ...this.filters, ...filters };
    this.refresh();
  }

  getFilters(): InventoryFilters {
    return this.filters;
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  getTreeItem(element: ExtensionItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ExtensionItem[] {
    return filterResults(this.summary, this.filters).map((result) => new ExtensionItem(result));
  }
}

export class ExtensionItem extends vscode.TreeItem {
  constructor(public readonly result: AuditResult) {
    super(result.extension.displayName, vscode.TreeItemCollapsibleState.None);
    this.id = `ext:${result.extension.id}`;
    this.description = `${result.extension.version} · ${severityLabel(result.attentionLevel)}`;
    this.tooltip = `${result.extension.id}\n${result.extension.publisher}`;
    this.contextValue = 'extension';
    this.iconPath = new vscode.ThemeIcon(result.extension.isBuiltin ? 'library' : 'extensions');
    this.command = {
      command: COMMANDS.openExtension,
      title: 'Open extension audit',
      arguments: [result.extension.id],
    };
  }
}
