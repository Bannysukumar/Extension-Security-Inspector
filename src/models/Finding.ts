export type Severity = 'informational' | 'low' | 'medium' | 'high' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  evidence: string[];
  explanation: string;
  recommendation: string;
  confidence: Confidence;
  detectionSource: string;
  category: FindingCategory;
}

export type FindingCategory =
  | 'filesystem'
  | 'process'
  | 'network'
  | 'authentication'
  | 'webview'
  | 'tasks'
  | 'terminal'
  | 'debugger'
  | 'commands'
  | 'configuration'
  | 'activation'
  | 'metadata'
  | 'dependency'
  | 'other';
