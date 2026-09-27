import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractContributes, parseManifestText } from '../src/analyzer/manifestParser';
import { emptyContributes, type ExtensionInfo } from '../src/models/ExtensionInfo';

export function readFixture(name: string): string {
  return readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

export function extensionFromFixture(
  name: string,
  overrides: Partial<ExtensionInfo> = {},
): ExtensionInfo {
  const parsed = parseManifestText(readFixture(name), name);
  const manifest = parsed.manifest;
  const publisher = manifest?.publisher ?? 'unknown';
  const extName = manifest?.name ?? name;
  const isBuiltin = Boolean(manifest?.raw.isBuiltin) || publisher === 'vscode';
  return {
    id: `${publisher}.${extName}`,
    name: extName,
    displayName: manifest?.displayName ?? extName,
    publisher,
    version: manifest?.version ?? '0.0.0',
    description: manifest?.description ?? '',
    enabled: true,
    isActive: false,
    isBuiltin,
    isThirdParty: !isBuiltin,
    homepage: manifest?.homepage,
    repository: manifest?.repository,
    bugs: manifest?.bugs,
    activationEvents: manifest?.activationEvents ?? [],
    categories: manifest?.categories ?? [],
    keywords: manifest?.keywords ?? [],
    engines: manifest?.engines,
    main: manifest?.main,
    browser: manifest?.browser,
    scripts: manifest?.scripts,
    dependencies: manifest?.dependencies,
    enabledApiProposals: manifest?.enabledApiProposals,
    capabilities: manifest?.capabilities,
    contributes: parsed.contributes ?? extractContributes(undefined),
    manifestAvailable: parsed.ok,
    parseError: parsed.error,
    metadataInsufficient: !parsed.ok,
    ...overrides,
  };
}

export function emptyExtension(overrides: Partial<ExtensionInfo> = {}): ExtensionInfo {
  return {
    id: 'example.empty',
    name: 'empty',
    displayName: 'Empty',
    publisher: 'example',
    version: '1.0.0',
    description: '',
    enabled: true,
    isActive: false,
    isBuiltin: false,
    isThirdParty: true,
    activationEvents: [],
    categories: [],
    keywords: [],
    contributes: emptyContributes(),
    manifestAvailable: true,
    metadataInsufficient: false,
    ...overrides,
  };
}
