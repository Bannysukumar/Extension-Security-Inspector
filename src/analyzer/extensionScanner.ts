import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { MARKETPLACE_ITEM_URL } from '../constants';
import {
  emptyContributes,
  type ContributesInfo,
  type ExtensionInfo,
} from '../models/ExtensionInfo';
import { asRecord, safeString } from '../utils/sanitization';
import { extractContributes, parseManifestText } from './manifestParser';

export interface ScanOptions {
  showBuiltinExtensions: boolean;
  includeDisabledExtensions: boolean;
}

export async function discoverExtensions(options: ScanOptions): Promise<ExtensionInfo[]> {
  const discovered = new Map<string, ExtensionInfo>();

  for (const extension of vscode.extensions.all) {
    try {
      const info = await describeApiExtension(extension, true);
      discovered.set(info.id.toLowerCase(), info);
    } catch {
      const fallbackId = extension.id || 'unknown.extension';
      discovered.set(
        fallbackId.toLowerCase(),
        unreadableExtension(fallbackId, 'Unable to analyze this extension from the VS Code API.'),
      );
    }
  }

  if (options.includeDisabledExtensions) {
    const disabled = await discoverDisabledExtensions(discovered);
    for (const info of disabled) {
      const key = info.id.toLowerCase();
      if (!discovered.has(key)) {
        discovered.set(key, info);
      }
    }
  }

  let results = [...discovered.values()];
  if (!options.showBuiltinExtensions) {
    results = results.filter((item) => !item.isBuiltin);
  }
  results.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return results;
}

export async function describeApiExtension(
  extension: vscode.Extension<unknown>,
  enabled: boolean,
): Promise<ExtensionInfo> {
  const packageJSON = asRecord(extension.packageJSON) ?? {};
  const extensionPath = extension.extensionPath || extension.extensionUri.fsPath;
  const isBuiltin = detectBuiltin(extension, packageJSON, extensionPath);
  const parsed = await readLocalManifest(extensionPath);
  const contributes =
    parsed.contributes ?? extractContributes(packageJSON.contributes, packageJSON);
  const publisher = safeString(packageJSON.publisher) || publisherFromId(extension.id);
  const name = safeString(packageJSON.name) || nameFromId(extension.id);
  const version = safeString(packageJSON.version, 'unknown');

  return finalizeInfo({
    id: extension.id,
    name,
    displayName:
      safeString(packageJSON.displayName) || safeString(packageJSON.name) || extension.id,
    publisher,
    version,
    description: safeString(packageJSON.description),
    enabled,
    isActive: extension.isActive,
    isBuiltin,
    isThirdParty: !isBuiltin,
    extensionPath,
    homepage: optionalUrl(packageJSON.homepage),
    repository: extractRepo(packageJSON.repository),
    bugs: extractBugs(packageJSON.bugs),
    marketplaceUrl: marketplaceUrl(publisher, name, isBuiltin),
    activationEvents: stringList(packageJSON.activationEvents),
    categories: stringList(packageJSON.categories),
    keywords: stringList(packageJSON.keywords),
    engines: stringRecord(packageJSON.engines),
    main: optionalString(packageJSON.main),
    browser: optionalString(packageJSON.browser),
    extensionKind: stringList(packageJSON.extensionKind),
    capabilities: packageJSON.capabilities,
    galleryBanner: packageJSON.galleryBanner,
    scripts: stringRecord(packageJSON.scripts),
    dependencies: stringRecord(packageJSON.dependencies),
    enabledApiProposals: stringList(packageJSON.enabledApiProposals),
    contributes,
    manifestAvailable: parsed.manifestAvailable,
    parseError: parsed.parseError,
    packageJsonMtime: parsed.packageJsonMtime,
    metadataInsufficient: false,
  });
}

export async function describeFolderExtension(
  extensionPath: string,
  enabled: boolean,
): Promise<ExtensionInfo | undefined> {
  const parsed = await readLocalManifest(extensionPath);
  if (!parsed.manifest && !parsed.parseError) {
    return undefined;
  }
  const manifest = parsed.manifest;
  const publisher = manifest?.publisher || 'unknown';
  const name = manifest?.name || path.basename(extensionPath);
  const id = `${publisher}.${name}`;
  const isBuiltin = false;
  return finalizeInfo({
    id,
    name,
    displayName: manifest?.displayName || name,
    publisher,
    version: manifest?.version || 'unknown',
    description: manifest?.description || '',
    enabled,
    isActive: false,
    isBuiltin,
    isThirdParty: true,
    extensionPath,
    homepage: manifest?.homepage,
    repository: manifest?.repository,
    bugs: manifest?.bugs,
    marketplaceUrl: marketplaceUrl(publisher, name, isBuiltin),
    activationEvents: manifest?.activationEvents ?? [],
    categories: manifest?.categories ?? [],
    keywords: manifest?.keywords ?? [],
    engines: manifest?.engines,
    main: manifest?.main,
    browser: manifest?.browser,
    extensionKind: manifest?.extensionKind,
    capabilities: manifest?.capabilities,
    galleryBanner: manifest?.galleryBanner,
    scripts: manifest?.scripts,
    dependencies: manifest?.dependencies,
    enabledApiProposals: manifest?.enabledApiProposals,
    contributes: parsed.contributes,
    manifestAvailable: parsed.manifestAvailable,
    parseError: parsed.parseError,
    packageJsonMtime: parsed.packageJsonMtime,
    metadataInsufficient: false,
  });
}

async function discoverDisabledExtensions(
  existing: Map<string, ExtensionInfo>,
): Promise<ExtensionInfo[]> {
  const results: ExtensionInfo[] = [];
  const directories = await collectExtensionDirectories(existing);
  for (const directory of directories) {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(directory);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) {
        continue;
      }
      const fullPath = path.join(directory, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (!stat.isDirectory()) {
          continue;
        }
        const info = await describeFolderExtension(fullPath, false);
        if (!info) {
          continue;
        }
        if (existing.has(info.id.toLowerCase())) {
          continue;
        }
        results.push(info);
      } catch {
        continue;
      }
    }
  }
  return results;
}

async function collectExtensionDirectories(
  existing: Map<string, ExtensionInfo>,
): Promise<string[]> {
  const dirs = new Set<string>();
  for (const info of existing.values()) {
    if (info.extensionPath && !info.isBuiltin) {
      dirs.add(path.dirname(info.extensionPath));
    }
  }

  const home = os.homedir();
  const candidates = [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.vscode-insiders', 'extensions'),
    path.join(home, '.vscode-oss', 'extensions'),
    path.join(home, '.cursor', 'extensions'),
  ];
  for (const candidate of candidates) {
    dirs.add(candidate);
  }

  const appRoot = vscode.env.appRoot;
  if (appRoot) {
    dirs.add(path.join(appRoot, 'extensions'));
  }

  const existingDirs: string[] = [];
  for (const dir of dirs) {
    try {
      const stat = await fs.stat(dir);
      if (stat.isDirectory()) {
        existingDirs.push(dir);
      }
    } catch {
      continue;
    }
  }
  return existingDirs;
}

async function readLocalManifest(extensionPath?: string): Promise<{
  manifestAvailable: boolean;
  contributes: ContributesInfo;
  parseError?: string;
  packageJsonMtime?: number;
  manifest?: ReturnType<typeof parseManifestText>['manifest'];
}> {
  if (!extensionPath) {
    return { manifestAvailable: false, contributes: emptyContributes() };
  }
  const manifestPath = path.join(extensionPath, 'package.json');
  try {
    const stat = await fs.stat(manifestPath);
    const text = await fs.readFile(manifestPath, 'utf8');
    const parsed = parseManifestText(text, `${path.basename(extensionPath)}/package.json`);
    return {
      manifestAvailable: parsed.ok,
      contributes: parsed.contributes,
      parseError: parsed.error,
      packageJsonMtime: stat.mtimeMs,
      manifest: parsed.manifest,
    };
  } catch {
    return {
      manifestAvailable: false,
      contributes: emptyContributes(),
      parseError: 'package.json was not readable from the installation directory.',
    };
  }
}

function unreadableExtension(id: string, parseError: string): ExtensionInfo {
  return finalizeInfo({
    id,
    name: id.includes('.') ? id.slice(id.indexOf('.') + 1) : id,
    displayName: id,
    publisher: id.includes('.') ? id.slice(0, id.indexOf('.')) : 'unknown',
    version: 'unknown',
    description: '',
    enabled: true,
    isActive: false,
    isBuiltin: false,
    isThirdParty: true,
    activationEvents: [],
    categories: [],
    keywords: [],
    contributes: emptyContributes(),
    manifestAvailable: false,
    parseError,
    metadataInsufficient: true,
  });
}

function finalizeInfo(info: ExtensionInfo): ExtensionInfo {
  info.metadataInsufficient = Boolean(
    info.parseError ||
    !info.manifestAvailable ||
    !info.displayName ||
    !info.publisher ||
    info.publisher === 'unknown',
  );
  return info;
}

function detectBuiltin(
  extension: vscode.Extension<unknown>,
  packageJSON: Record<string, unknown>,
  extensionPath: string,
): boolean {
  if (packageJSON.isBuiltin === true) {
    return true;
  }
  const metadata = asRecord(packageJSON.__metadata);
  if (metadata?.isBuiltin === true || metadata?.isApplicationScoped === true) {
    return true;
  }
  const publisher = safeString(packageJSON.publisher) || publisherFromId(extension.id);
  if (publisher === 'vscode') {
    return true;
  }
  const appRoot = vscode.env.appRoot;
  if (appRoot && extensionPath.startsWith(path.join(appRoot, 'extensions'))) {
    return true;
  }
  return false;
}

function marketplaceUrl(publisher: string, name: string, isBuiltin: boolean): string | undefined {
  if (isBuiltin || !publisher || !name || publisher === 'unknown') {
    return undefined;
  }
  return `${MARKETPLACE_ITEM_URL}${encodeURIComponent(publisher)}.${encodeURIComponent(name)}`;
}

function extractRepo(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return optionalUrl(asRecord(value)?.url);
}

function extractBugs(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return optionalUrl(asRecord(value)?.url);
}

function optionalUrl(value: unknown): string | undefined {
  const text = optionalString(value);
  return text || undefined;
}

function optionalString(value: unknown): string | undefined {
  const text = safeString(value);
  return text || undefined;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function stringRecord(value: unknown): Record<string, string> | undefined {
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

function publisherFromId(id: string): string {
  const index = id.indexOf('.');
  return index > 0 ? id.slice(0, index) : id;
}

function nameFromId(id: string): string {
  const index = id.indexOf('.');
  return index > 0 ? id.slice(index + 1) : id;
}
