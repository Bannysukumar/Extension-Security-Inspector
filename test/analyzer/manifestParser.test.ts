import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractContributes, parseManifestText } from '../../src/analyzer/manifestParser';
import { readFixture } from '../helpers';

describe('manifestParser', () => {
  it('parses a normal extension manifest', () => {
    const result = parseManifestText(readFixture('normal-extension.json'));
    expect(result.ok).toBe(true);
    expect(result.manifest?.displayName).toBe('Normal Extension');
    expect(result.manifest?.publisher).toBe('example');
    expect(result.manifest?.activationEvents).toContain('onLanguage:markdown');
    expect(result.contributes.commands[0]?.command).toBe('normal.hello');
  });

  it('extracts commands and keybindings', () => {
    const result = parseManifestText(readFixture('commands-extension.json'));
    expect(result.contributes.commands).toHaveLength(2);
    expect(result.contributes.keybindings[0]?.key).toBe('ctrl+alt+r');
  });

  it('extracts tasks and terminals', () => {
    const result = parseManifestText(readFixture('tasks-extension.json'));
    expect(result.contributes.taskDefinitions).toContain('exampleTask');
    expect(result.contributes.terminals.length).toBeGreaterThan(0);
  });

  it('extracts authentication providers', () => {
    const result = parseManifestText(readFixture('auth-extension.json'));
    expect(result.contributes.authentication).toContain('example');
  });

  it('extracts webview contributions', () => {
    const result = parseManifestText(readFixture('webview-extension.json'));
    expect(result.contributes.customEditors).toContain('example.editor');
    expect(result.contributes.webviewHints.length).toBeGreaterThan(0);
  });

  it('handles malformed JSON without throwing', () => {
    const result = parseManifestText(
      readFixture('malformed-package.json'),
      'malformed-package.json',
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not valid JSON/i);
    expect(result.contributes.commands).toEqual([]);
  });

  it('rejects non-object JSON', () => {
    const result = parseManifestText('["nope"]');
    expect(result.ok).toBe(false);
  });

  it('handles missing fields', () => {
    const result = parseManifestText('{}');
    expect(result.ok).toBe(true);
    expect(result.manifest?.activationEvents).toEqual([]);
    expect(result.contributes.commands).toEqual([]);
  });

  it('never executes package.json contents', () => {
    const result = parseManifestText('{"name":"x","scripts":{"postinstall":"echo pwned"}}');
    expect(result.manifest?.scripts?.postinstall).toBe('echo pwned');
    expect(result.ok).toBe(true);
  });

  it('flags sensitive configuration keys', () => {
    const result = parseManifestText(readFixture('network-extension.json'));
    const endpoint = result.contributes.configuration.find(
      (item) => item.key === 'network.endpoint',
    );
    expect(endpoint?.sensitiveIndicators.some((item) => item.includes('network'))).toBe(true);
  });

  it('can extract contributes independently', () => {
    const raw = JSON.parse(
      readFileSync(path.join(__dirname, '../fixtures/normal-extension.json'), 'utf8'),
    ) as {
      contributes: unknown;
    };
    const contributes = extractContributes(raw.contributes);
    expect(contributes.commands).toHaveLength(1);
  });
});
