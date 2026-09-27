import { MANIFEST_MAX_BYTES } from '../constants';
import {
  emptyContributes,
  type CommandContribution,
  type ConfigurationContribution,
  type ContributesInfo,
  type KeybindingContribution,
  type ParsedManifest,
} from '../models/ExtensionInfo';
import { asArray, asRecord, safeString, uniqueStrings } from '../utils/sanitization';

export interface ManifestParseResult {
  ok: boolean;
  manifest?: ParsedManifest;
  contributes: ContributesInfo;
  error?: string;
}

export function parseManifestText(text: string, sourceLabel = 'package.json'): ManifestParseResult {
  if (text.length > MANIFEST_MAX_BYTES) {
    return {
      ok: false,
      contributes: emptyContributes(),
      error: `${sourceLabel} exceeds the safe read limit and was not parsed.`,
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      contributes: emptyContributes(),
      error: `Unable to analyze ${sourceLabel}: the file is not valid JSON.`,
    };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      contributes: emptyContributes(),
      error: `Unable to analyze ${sourceLabel}: expected a JSON object.`,
    };
  }

  const record = raw as Record<string, unknown>;
  const repository = extractRepository(record.repository);
  const bugs = extractBugs(record.bugs);
  const engines = extractStringRecord(record.engines);
  const scripts = extractStringRecord(record.scripts);
  const dependencies = extractStringRecord(record.dependencies);
  const optionalDependencies = extractStringRecord(record.optionalDependencies);

  const manifest: ParsedManifest = {
    name: optionalString(record.name),
    displayName: optionalString(record.displayName),
    publisher: optionalString(record.publisher),
    version: optionalString(record.version),
    description: optionalString(record.description),
    engines,
    activationEvents: stringList(record.activationEvents),
    main: optionalString(record.main),
    browser: optionalString(record.browser),
    contributes: record.contributes,
    scripts,
    repository,
    homepage: optionalString(record.homepage),
    bugs,
    dependencies,
    optionalDependencies,
    extensionKind: stringList(record.extensionKind),
    capabilities: record.capabilities,
    galleryBanner: record.galleryBanner,
    categories: stringList(record.categories),
    keywords: stringList(record.keywords),
    enabledApiProposals: stringList(record.enabledApiProposals),
    extensionPack: stringList(record.extensionPack),
    extensionDependencies: stringList(record.extensionDependencies),
    raw: record,
  };

  return {
    ok: true,
    manifest,
    contributes: extractContributes(record.contributes, record),
  };
}

export function extractContributes(
  contributesValue: unknown,
  raw?: Record<string, unknown>,
): ContributesInfo {
  const contributes = asRecord(contributesValue) ?? {};
  const info = emptyContributes();

  info.commands = extractCommands(contributes.commands);
  info.configuration = extractConfiguration(contributes.configuration);
  info.languages = namedValues(contributes.languages, ['id', 'aliases']);
  info.languageProviders = extractLanguageProviders(contributes);
  info.debuggers = namedValues(contributes.debuggers, ['type', 'label']);
  info.snippets = extractSnippets(contributes.snippets);
  info.themes = namedValues(contributes.themes, ['id', 'label']);
  info.iconThemes = namedValues(contributes.iconThemes, ['id', 'label']);
  info.authentication = namedValues(contributes.authentication, ['id', 'label']);
  info.views = extractViews(contributes.views);
  info.viewsContainers = extractViewsContainers(contributes.viewsContainers);
  info.customEditors = namedValues(contributes.customEditors, ['viewType', 'displayName']);
  info.webviewHints = extractWebviewHints(contributes);
  info.tasks = extractTasks(contributes.taskDefinitions, contributes.problemMatchers);
  info.taskDefinitions = namedValues(contributes.taskDefinitions, ['type']);
  info.terminals = extractTerminals(contributes);
  info.fileSystemProviders = namedValues(contributes.fileSystem ?? contributes.fileSystemProvider, [
    'scheme',
    'id',
  ]);
  info.keybindings = extractKeybindings(contributes.keybindings);
  info.menus = Object.keys(asRecord(contributes.menus) ?? {});
  info.grammars = namedValues(contributes.grammars, ['language', 'scopeName']);
  info.problemMatchers = namedValues(contributes.problemMatchers, ['name', 'label']);
  info.colors = namedValues(contributes.colors, ['id']);
  info.walkthroughs = namedValues(contributes.walkthroughs, ['id', 'title']);
  info.notebooks = namedValues(contributes.notebooks, ['type', 'displayName']);
  info.chatParticipants = namedValues(contributes.chatParticipants, ['id', 'name']);
  info.languageModelTools = namedValues(contributes.languageModelTools ?? contributes.tools, [
    'name',
    'id',
  ]);
  info.other = extractOtherContributionPoints(contributes, raw);

  return info;
}

function extractCommands(value: unknown): CommandContribution[] {
  return asArray(value)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      command: safeString(item.command),
      title: optionalString(item.title),
      category: optionalString(item.category),
      enablement: optionalString(item.enablement),
    }))
    .filter((item) => item.command);
}

function extractConfiguration(value: unknown): ConfigurationContribution[] {
  const records: Record<string, unknown>[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const record = asRecord(item);
      if (record?.properties) {
        records.push(asRecord(record.properties) ?? {});
      }
    }
  } else {
    const record = asRecord(value);
    if (record?.properties) {
      records.push(asRecord(record.properties) ?? {});
    } else if (record) {
      records.push(record);
    }
  }

  const results: ConfigurationContribution[] = [];
  for (const properties of records) {
    for (const [key, definitionValue] of Object.entries(properties)) {
      const definition = asRecord(definitionValue) ?? {};
      results.push({
        key,
        type: configurationType(definition.type),
        defaultValue: summarizeDefault(definition.default),
        description: optionalString(definition.description ?? definition.markdownDescription),
        sensitiveIndicators: detectSensitiveSetting(key, definition),
      });
    }
  }
  return results;
}

function extractKeybindings(value: unknown): KeybindingContribution[] {
  return asArray(value)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      command: safeString(item.command),
      key: optionalString(item.key),
      mac: optionalString(item.mac),
      when: optionalString(item.when),
    }))
    .filter((item) => item.command);
}

function extractViews(value: unknown): string[] {
  const record = asRecord(value);
  if (!record) {
    return namedValues(value, ['id', 'name']);
  }
  const names: string[] = [];
  for (const [container, views] of Object.entries(record)) {
    for (const view of asArray(views)) {
      const item = asRecord(view);
      const label = optionalString(item?.id) ?? optionalString(item?.name) ?? container;
      names.push(label);
    }
  }
  return uniqueStrings(names);
}

function extractViewsContainers(value: unknown): string[] {
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  const names: string[] = [];
  for (const views of Object.values(record)) {
    names.push(...namedValues(views, ['id', 'title']));
  }
  return uniqueStrings(names);
}

function extractSnippets(value: unknown): string[] {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      return optionalString(record?.language) ?? optionalString(record?.path);
    })
    .filter((item): item is string => Boolean(item));
}

function extractTasks(taskDefinitions: unknown, problemMatchers: unknown): string[] {
  return uniqueStrings([
    ...namedValues(taskDefinitions, ['type']),
    ...namedValues(problemMatchers, ['name']),
  ]);
}

function extractTerminals(contributes: Record<string, unknown>): string[] {
  const names = [
    ...namedValues(contributes.terminal, ['id', 'title']),
    ...namedValues(asRecord(contributes.terminal)?.profiles, ['id', 'title']),
    ...namedValues(contributes.terminalProfiles, ['id', 'title']),
  ];
  if (contributes.terminal) {
    names.push('terminal');
  }
  return uniqueStrings(names);
}

function extractWebviewHints(contributes: Record<string, unknown>): string[] {
  const hints: string[] = [];
  if (contributes.customEditors) {
    hints.push('customEditors');
  }
  if (contributes.webview) {
    hints.push('webview');
  }
  if (contributes.walkthroughs) {
    hints.push('walkthroughs');
  }
  if (contributes.notebooks) {
    hints.push('notebooks');
  }
  const views = asRecord(contributes.views);
  if (views) {
    for (const group of Object.values(views)) {
      for (const view of asArray(group)) {
        const record = asRecord(view);
        const type = optionalString(record?.type);
        if (type === 'webview') {
          hints.push(optionalString(record?.id) ?? 'webview view');
        }
      }
    }
  }
  return uniqueStrings(hints);
}

function extractLanguageProviders(contributes: Record<string, unknown>): string[] {
  const keys = [
    'semanticTokenProviders',
    'documentHighlights',
    'codeActions',
    'codeLens',
    'hoverProvider',
    'completion',
  ];
  const found = keys.filter((key) => contributes[key] !== undefined);
  if (contributes.languages) {
    found.push('languages');
  }
  if (contributes.grammars) {
    found.push('grammars');
  }
  return uniqueStrings(found);
}

function extractOtherContributionPoints(
  contributes: Record<string, unknown>,
  raw?: Record<string, unknown>,
): string[] {
  const known = new Set([
    'commands',
    'configuration',
    'configurationDefaults',
    'languages',
    'debuggers',
    'breakpoints',
    'snippets',
    'themes',
    'iconThemes',
    'productIconThemes',
    'authentication',
    'views',
    'viewsContainers',
    'customEditors',
    'webview',
    'taskDefinitions',
    'problemMatchers',
    'problemPatterns',
    'terminal',
    'terminalProfiles',
    'fileSystem',
    'fileSystemProvider',
    'keybindings',
    'menus',
    'grammars',
    'colors',
    'walkthroughs',
    'notebooks',
    'chatParticipants',
    'languageModelTools',
    'tools',
    'jsonValidation',
    'resourceLabelFormatters',
    'submenus',
    'icons',
    'typescriptServerPlugins',
  ]);
  const extras = Object.keys(contributes).filter((key) => !known.has(key));
  if (raw?.enabledApiProposals) {
    extras.push('enabledApiProposals');
  }
  if (raw?.extensionPack) {
    extras.push('extensionPack');
  }
  return uniqueStrings(extras);
}

function namedValues(value: unknown, fields: string[]): string[] {
  return uniqueStrings(
    asArray(value).map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }
      for (const field of fields) {
        const candidate = optionalString(record[field]);
        if (candidate) {
          return candidate;
        }
      }
      return undefined;
    }),
  );
}

function detectSensitiveSetting(key: string, definition: Record<string, unknown>): string[] {
  const haystack =
    `${key} ${safeString(definition.description)} ${safeString(definition.markdownDescription)} ${stringifySmall(definition.default)}`.toLowerCase();
  const indicators: string[] = [];
  if (/(command|task|script|shell|exec)/.test(haystack)) {
    indicators.push('may execute commands');
  }
  if (/(path|executable|bin|binary|runtime)/.test(haystack)) {
    indicators.push('may reference executable paths');
  }
  if (/(url|uri|endpoint|host|proxy|server|http|websocket)/.test(haystack)) {
    indicators.push('may configure network endpoints');
  }
  if (/(service|remote|cloud|api)/.test(haystack)) {
    indicators.push('may control external services');
  }
  if (/(trust|security|tls|ssl|insecure|allowhttp|secret|token|auth)/.test(haystack)) {
    indicators.push('may alter security-sensitive behavior');
  }
  return uniqueStrings(indicators);
}

function configurationType(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string').join(' | ');
  }
  return undefined;
}

function summarizeDefault(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const text = stringifySmall(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function stringifySmall(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function extractRepository(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  const record = asRecord(value);
  return optionalString(record?.url);
}

function extractBugs(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  const record = asRecord(value);
  return optionalString(record?.url);
}

function extractStringRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') {
      result[key] = item;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function stringList(value: unknown): string[] {
  return uniqueStrings(asArray(value).map((item) => (typeof item === 'string' ? item : undefined)));
}

function optionalString(value: unknown): string | undefined {
  const text = safeString(value);
  return text ? text : undefined;
}
