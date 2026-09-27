import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import type { AuditSummary } from '../models/AuditResult';
import { CAPABILITY_LABELS, type CapabilityKind } from '../models/Capability';
import type { Severity } from '../models/Finding';
import { filterResults } from '../utils/filters';
import { ExtensionItem } from './extensionTreeProvider';

type TreeElement = InspectorNode | ExtensionItem;

export class SecurityTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private readonly emitter = new vscode.EventEmitter<TreeElement | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private summary: AuditSummary | undefined;

  setSummary(summary: AuditSummary | undefined): void {
    this.summary = summary;
    this.refresh();
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.rootNodes();
    }
    if (element instanceof InspectorNode) {
      return this.childNodes(element);
    }
    return [];
  }

  private rootNodes(): InspectorNode[] {
    const summary = this.summary;
    return [
      new InspectorNode('overview', 'Overview', vscode.TreeItemCollapsibleState.None, {
        icon: 'shield',
        description: summary ? `${summary.totalExtensions} extensions` : 'Not audited yet',
        command: COMMANDS.openOverview,
      }),
      new InspectorNode('high', 'High Attention', vscode.TreeItemCollapsibleState.Collapsed, {
        icon: 'error',
        description: summary ? String(summary.highAttention) : undefined,
      }),
      new InspectorNode('medium', 'Medium Attention', vscode.TreeItemCollapsibleState.Collapsed, {
        icon: 'warning',
        description: summary ? String(summary.mediumAttention) : undefined,
      }),
      new InspectorNode('low', 'Low Attention', vscode.TreeItemCollapsibleState.Collapsed, {
        icon: 'info',
        description: summary ? String(summary.lowAttention) : undefined,
      }),
      new InspectorNode('extensions', 'Extensions', vscode.TreeItemCollapsibleState.Collapsed, {
        icon: 'extensions',
        description: summary ? String(summary.totalExtensions) : undefined,
      }),
      new InspectorNode('capabilities', 'Capabilities', vscode.TreeItemCollapsibleState.Collapsed, {
        icon: 'symbol-misc',
      }),
      new InspectorNode('reports', 'Reports', vscode.TreeItemCollapsibleState.None, {
        icon: 'notebook',
        command: COMMANDS.openReports,
      }),
    ];
  }

  private childNodes(node: InspectorNode): TreeElement[] {
    if (!this.summary) {
      return [];
    }
    if (node.id === 'high' || node.id === 'medium' || node.id === 'low') {
      return filterResults(this.summary, {
        status: 'all',
        type: 'all',
        attention: node.id as Severity,
      }).map((result) => new ExtensionItem(result));
    }
    if (node.id === 'extensions') {
      return this.summary.results.map((result) => new ExtensionItem(result));
    }
    if (node.id === 'capabilities') {
      return (Object.keys(CAPABILITY_LABELS) as CapabilityKind[]).map(
        (kind) =>
          new InspectorNode(
            `cap:${kind}`,
            CAPABILITY_LABELS[kind],
            vscode.TreeItemCollapsibleState.Collapsed,
            {
              icon: 'circle-outline',
              description: String(this.summary?.capabilityTotals[kind] ?? 0),
              capability: kind,
            },
          ),
      );
    }
    if (node.id.startsWith('cap:')) {
      const capability = node.capability;
      if (!capability) {
        return [];
      }
      return filterResults(this.summary, {
        status: 'all',
        type: 'all',
        attention: 'all',
        capability,
      }).map((result) => new ExtensionItem(result));
    }
    return [];
  }
}

export class InspectorNode extends vscode.TreeItem {
  constructor(
    public override readonly id: string,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options?: {
      icon?: string;
      description?: string;
      command?: string;
      capability?: CapabilityKind;
    },
  ) {
    super(label, collapsibleState);
    this.description = options?.description;
    this.iconPath = new vscode.ThemeIcon(options?.icon ?? 'circle-large-outline');
    this.contextValue = options?.capability ? 'capability' : id;
    this.capability = options?.capability;
    if (options?.command) {
      this.command = { command: options.command, title: label };
    }
    if (options?.capability) {
      this.command = {
        command: COMMANDS.openCapability,
        title: label,
        arguments: [options.capability],
      };
    }
  }

  readonly capability?: CapabilityKind;
}
