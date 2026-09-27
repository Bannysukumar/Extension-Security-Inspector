export interface CommandContribution {
  command: string;
  title?: string;
  category?: string;
  enablement?: string;
  keybinding?: string;
}

export interface ConfigurationContribution {
  key: string;
  type?: string;
  defaultValue?: string;
  description?: string;
  sensitiveIndicators: string[];
}

export interface KeybindingContribution {
  command: string;
  key?: string;
  mac?: string;
  when?: string;
}

export interface ContributesInfo {
  commands: CommandContribution[];
  configuration: ConfigurationContribution[];
  languages: string[];
  languageProviders: string[];
  debuggers: string[];
  snippets: string[];
  themes: string[];
  iconThemes: string[];
  authentication: string[];
  views: string[];
  viewsContainers: string[];
  customEditors: string[];
  webviewHints: string[];
  tasks: string[];
  taskDefinitions: string[];
  terminals: string[];
  fileSystemProviders: string[];
  keybindings: KeybindingContribution[];
  menus: string[];
  grammars: string[];
  problemMatchers: string[];
  colors: string[];
  walkthroughs: string[];
  notebooks: string[];
  chatParticipants: string[];
  languageModelTools: string[];
  other: string[];
}

export interface ParsedManifest {
  name?: string;
  displayName?: string;
  publisher?: string;
  version?: string;
  description?: string;
  engines?: Record<string, string>;
  activationEvents: string[];
  main?: string;
  browser?: string;
  contributes: unknown;
  scripts?: Record<string, string>;
  repository?: string;
  homepage?: string;
  bugs?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  extensionKind?: string[];
  capabilities?: unknown;
  galleryBanner?: unknown;
  categories: string[];
  keywords: string[];
  enabledApiProposals?: string[];
  extensionPack?: string[];
  extensionDependencies?: string[];
  raw: Record<string, unknown>;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  version: string;
  description: string;
  enabled: boolean;
  isActive: boolean;
  isBuiltin: boolean;
  isThirdParty: boolean;
  extensionPath?: string;
  homepage?: string;
  repository?: string;
  bugs?: string;
  marketplaceUrl?: string;
  activationEvents: string[];
  categories: string[];
  keywords: string[];
  engines?: Record<string, string>;
  main?: string;
  browser?: string;
  extensionKind?: string[];
  capabilities?: unknown;
  galleryBanner?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  enabledApiProposals?: string[];
  contributes: ContributesInfo;
  manifestAvailable: boolean;
  parseError?: string;
  packageJsonMtime?: number;
  metadataInsufficient: boolean;
}

export function emptyContributes(): ContributesInfo {
  return {
    commands: [],
    configuration: [],
    languages: [],
    languageProviders: [],
    debuggers: [],
    snippets: [],
    themes: [],
    iconThemes: [],
    authentication: [],
    views: [],
    viewsContainers: [],
    customEditors: [],
    webviewHints: [],
    tasks: [],
    taskDefinitions: [],
    terminals: [],
    fileSystemProviders: [],
    keybindings: [],
    menus: [],
    grammars: [],
    problemMatchers: [],
    colors: [],
    walkthroughs: [],
    notebooks: [],
    chatParticipants: [],
    languageModelTools: [],
    other: [],
  };
}
