import { RuleAnalyzer } from '../../src/analyzer/findingsEngine';
import { riskRules } from '../../src/analyzer/riskRules';
import { emptyExtension, extensionFromFixture } from '../helpers';

describe('riskRules', () => {
  const analyzer = new RuleAnalyzer({ showUnknownCapabilities: true });

  it('does not treat ordinary commands as high attention', () => {
    const findings = analyzer.analyze(extensionFromFixture('commands-extension.json'));
    const commands = findings.find((item) => item.id === 'commands-contributed');
    expect(commands?.severity).toBe('informational');
    expect(findings.some((item) => item.severity === 'high')).toBe(false);
  });

  it('flags task and terminal capabilities for review', () => {
    const findings = analyzer.analyze(extensionFromFixture('tasks-extension.json'));
    expect(findings.some((item) => item.id === 'process-tasks')).toBe(true);
    expect(findings.some((item) => item.id === 'process-terminal')).toBe(true);
    expect(findings.find((item) => item.id === 'process-tasks')?.explanation).toMatch(
      /does not mean the extension is malicious/i,
    );
  });

  it('flags authentication providers as high attention', () => {
    const findings = analyzer.analyze(extensionFromFixture('auth-extension.json'));
    const auth = findings.find((item) => item.id === 'authentication-provider');
    expect(auth?.severity).toBe('high');
    expect(auth?.explanation).toMatch(/does not access those credentials/i);
  });

  it('flags webview contributions', () => {
    const findings = analyzer.analyze(extensionFromFixture('webview-extension.json'));
    expect(findings.some((item) => item.id === 'webview-capability')).toBe(true);
  });

  it('flags network indicators without claiming malware', () => {
    const findings = analyzer.analyze(extensionFromFixture('network-extension.json'));
    const network = findings.find((item) => item.id === 'network-indicated');
    expect(network).toBeTruthy();
    expect(network?.explanation).toMatch(/does not inspect network traffic/i);
  });

  it('creates unknown findings for unreadable manifests', () => {
    const findings = analyzer.analyze(
      emptyExtension({
        displayName: 'Broken',
        parseError: 'Unable to analyze extension A.',
        manifestAvailable: false,
        metadataInsufficient: true,
      }),
    );
    expect(findings.some((item) => item.id === 'manifest-unreadable')).toBe(true);
    expect(findings.some((item) => item.severity === 'unknown')).toBe(true);
  });

  it('can hide unknown capability findings', () => {
    const hidden = new RuleAnalyzer({ showUnknownCapabilities: false });
    const findings = hidden.analyze(
      emptyExtension({
        metadataInsufficient: true,
        parseError: undefined,
        manifestAvailable: false,
      }),
    );
    expect(findings.some((item) => item.id === 'insufficient-metadata')).toBe(false);
  });

  it('exposes a stable rule catalog', () => {
    expect(riskRules.length).toBeGreaterThan(8);
    expect(new Set(riskRules.map((rule) => rule.id)).size).toBe(riskRules.length);
  });
});
