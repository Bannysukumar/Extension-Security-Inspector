import * as vscode from 'vscode';
import { CONFIG_SECTION } from '../constants';
import type { ExtensionInfo } from '../models/ExtensionInfo';
import { describeApiExtension, discoverExtensions } from '../analyzer/extensionScanner';

export interface InspectorSettings {
  showBuiltinExtensions: boolean;
  includeDisabledExtensions: boolean;
  scanDependencies: boolean;
  showUnknownCapabilities: boolean;
  autoAudit: boolean;
  reportDirectory: string;
}

export function readSettings(): InspectorSettings {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    showBuiltinExtensions: config.get('showBuiltinExtensions', true),
    includeDisabledExtensions: config.get('includeDisabledExtensions', true),
    scanDependencies: config.get('scanDependencies', false),
    showUnknownCapabilities: config.get('showUnknownCapabilities', true),
    autoAudit: config.get('autoAudit', false),
    reportDirectory: config.get('reportDirectory', ''),
  };
}

export async function listInstalledExtensions(): Promise<ExtensionInfo[]> {
  return discoverExtensions(readSettings());
}

export async function findExtensionById(id: string): Promise<ExtensionInfo | undefined> {
  const fromApi = vscode.extensions.getExtension(id);
  if (fromApi) {
    return describeApiExtension(fromApi, true);
  }
  const all = await listInstalledExtensions();
  return all.find((item) => item.id.toLowerCase() === id.toLowerCase());
}

export function workspaceIsTrusted(): boolean {
  return vscode.workspace.isTrusted;
}
