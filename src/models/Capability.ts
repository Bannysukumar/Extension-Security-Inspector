export type CapabilityKind =
  | 'filesystem'
  | 'process'
  | 'network'
  | 'authentication'
  | 'webview'
  | 'tasks'
  | 'terminal'
  | 'debugger';

export interface CapabilityCounts {
  filesystem: number;
  process: number;
  network: number;
  authentication: number;
  webview: number;
  tasks: number;
  terminal: number;
  debugger: number;
}

export interface CapabilityStatus {
  kind: CapabilityKind;
  label: string;
  count: number;
  status: 'review' | 'none' | 'unknown';
}

export const EMPTY_CAPABILITY_COUNTS: CapabilityCounts = {
  filesystem: 0,
  process: 0,
  network: 0,
  authentication: 0,
  webview: 0,
  tasks: 0,
  terminal: 0,
  debugger: 0,
};

export const CAPABILITY_LABELS: Record<CapabilityKind, string> = {
  filesystem: 'Filesystem',
  process: 'Process',
  network: 'Network',
  authentication: 'Authentication',
  webview: 'Webview',
  tasks: 'Tasks',
  terminal: 'Terminal',
  debugger: 'Debugger',
};
