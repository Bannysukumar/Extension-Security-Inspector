export const EXTENSION_NAME = 'Extension Security Inspector';
export const OUTPUT_CHANNEL_NAME = 'Extension Security Inspector';
export const VIEW_CONTAINER_ID = 'extensionSecurityInspector';
export const MAIN_VIEW_ID = 'extensionSecurityInspector.mainView';
export const CONFIG_SECTION = 'extensionSecurityInspector';
export const WEBVIEW_VIEW_TYPE = 'extensionSecurityInspector.panel';

export const COMMANDS = {
  auditAll: 'extensionSecurityInspector.auditAll',
  auditSelected: 'extensionSecurityInspector.auditSelected',
  exportReport: 'extensionSecurityInspector.exportReport',
  refresh: 'extensionSecurityInspector.refresh',
  openSettings: 'extensionSecurityInspector.openSettings',
  compare: 'extensionSecurityInspector.compare',
  search: 'extensionSecurityInspector.search',
  openOverview: 'extensionSecurityInspector.openOverview',
  openPrivacy: 'extensionSecurityInspector.openPrivacy',
  openExtension: 'extensionSecurityInspector.openExtension',
  openCapability: 'extensionSecurityInspector.openCapability',
  openReports: 'extensionSecurityInspector.openReports',
} as const;

export const MARKETPLACE_ITEM_URL = 'https://marketplace.visualstudio.com/items?itemName=';

export const LIMITATIONS = [
  'This audit is based on locally available metadata and static analysis. It cannot prove that an extension is safe or malicious.',
  'The tool cannot determine what every line of extension code does at runtime.',
  'The tool cannot determine whether an extension secretly behaves differently than its manifest suggests.',
  'The tool cannot determine whether external servers or publishers are trustworthy.',
  'The tool cannot determine whether an extension contains an unknown vulnerability unless vulnerability data has been obtained from a trusted source.',
  'This summary represents detected capabilities and review indicators. It is not a malware verdict.',
] as const;

export const RESTRICTED_MODE_NOTICE =
  'Some capabilities cannot be fully analyzed while the workspace is untrusted.';

export const MANIFEST_MAX_BYTES = 2_000_000;
export const LOCKFILE_MAX_BYTES = 8_000_000;
export const SCAN_BATCH_SIZE = 8;
export const AUTO_AUDIT_DEBOUNCE_MS = 2500;
export const HISTORY_STORAGE_KEY = 'extensionSecurityInspector.history.v1';
export const LEGACY_CACHE_STORAGE_KEY = 'extensionSecurityInspector.cache.v1';
export const HISTORY_LIMIT = 25;
