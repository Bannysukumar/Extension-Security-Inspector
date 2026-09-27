import {
  EMPTY_CAPABILITY_COUNTS,
  type CapabilityCounts,
  type CapabilityKind,
  type CapabilityStatus,
} from '../models/Capability';
import type { ExtensionInfo } from '../models/ExtensionInfo';
import type { Finding, FindingCategory } from '../models/Finding';

const CATEGORY_TO_CAPABILITY: Partial<Record<FindingCategory, CapabilityKind>> = {
  filesystem: 'filesystem',
  process: 'process',
  network: 'network',
  authentication: 'authentication',
  webview: 'webview',
  tasks: 'tasks',
  terminal: 'terminal',
  debugger: 'debugger',
};

export function analyzeCapabilities(
  extension: ExtensionInfo,
  findings: Finding[],
): CapabilityCounts {
  const counts: CapabilityCounts = { ...EMPTY_CAPABILITY_COUNTS };

  if (extension.contributes.fileSystemProviders.length > 0) {
    counts.filesystem += 1;
  }
  if (extension.capabilities) {
    counts.filesystem += 1;
  }
  if (extension.contributes.taskDefinitions.length > 0 || extension.contributes.tasks.length > 0) {
    counts.tasks += 1;
    counts.process += 1;
  }
  if (extension.contributes.terminals.length > 0) {
    counts.terminal += 1;
    counts.process += 1;
  }
  if (extension.contributes.debuggers.length > 0) {
    counts.debugger += 1;
    counts.process += 1;
  }
  if (extension.contributes.authentication.length > 0) {
    counts.authentication += 1;
  }
  if (
    extension.contributes.webviewHints.length > 0 ||
    extension.contributes.customEditors.length > 0
  ) {
    counts.webview += 1;
  }
  if (extension.main) {
    counts.process += 1;
  }

  for (const finding of findings) {
    const kind = CATEGORY_TO_CAPABILITY[finding.category];
    if (kind && finding.id === 'network-indicated') {
      counts.network += 1;
    }
  }

  return counts;
}

export function capabilityStatuses(counts: CapabilityCounts): CapabilityStatus[] {
  return (Object.keys(counts) as CapabilityKind[]).map((kind) => {
    const count = counts[kind];
    return {
      kind,
      label: kind.charAt(0).toUpperCase() + kind.slice(1),
      count,
      status: count > 0 ? 'review' : 'none',
    };
  });
}

export function hasCapability(counts: CapabilityCounts, kind: CapabilityKind): boolean {
  return counts[kind] > 0;
}

export function addCapabilityTotals(target: CapabilityCounts, source: CapabilityCounts): void {
  (Object.keys(target) as CapabilityKind[]).forEach((key) => {
    target[key] += source[key];
  });
}
