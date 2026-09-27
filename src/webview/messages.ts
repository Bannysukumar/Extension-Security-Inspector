export const INCOMING_MESSAGE_TYPES = [
  'ready',
  'openExtension',
  'compare',
  'search',
  'export',
  'refresh',
  'openPrivacy',
  'openOverview',
  'openReports',
] as const;

export type IncomingMessageType = (typeof INCOMING_MESSAGE_TYPES)[number];

export type IncomingMessage =
  | { type: 'ready' }
  | { type: 'openExtension'; extensionId: string }
  | { type: 'compare'; extensionIds: string[] }
  | { type: 'search'; query: string }
  | { type: 'export'; format: 'json' | 'markdown' | 'html' }
  | { type: 'refresh' }
  | { type: 'openPrivacy' }
  | { type: 'openOverview' }
  | { type: 'openReports' };

const EXPORT_FORMATS = new Set(['json', 'markdown', 'html']);

export function parseIncomingMessage(value: unknown): IncomingMessage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== 'string' || !INCOMING_MESSAGE_TYPES.includes(type as IncomingMessageType)) {
    return undefined;
  }

  switch (type) {
    case 'ready':
    case 'refresh':
    case 'openPrivacy':
    case 'openOverview':
    case 'openReports':
      return { type };
    case 'openExtension':
      return typeof record.extensionId === 'string' && record.extensionId.length > 0
        ? { type, extensionId: record.extensionId.slice(0, 200) }
        : undefined;
    case 'search':
      return typeof record.query === 'string'
        ? { type, query: record.query.slice(0, 200) }
        : undefined;
    case 'export':
      return typeof record.format === 'string' && EXPORT_FORMATS.has(record.format)
        ? { type, format: record.format as 'json' | 'markdown' | 'html' }
        : undefined;
    case 'compare':
      if (!Array.isArray(record.extensionIds)) {
        return undefined;
      }
      return {
        type,
        extensionIds: record.extensionIds
          .filter((item): item is string => typeof item === 'string' && item.length > 0)
          .slice(0, 8),
      };
    default:
      return undefined;
  }
}
