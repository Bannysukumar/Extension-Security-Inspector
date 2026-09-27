import { analyzeCapabilities, hasCapability } from '../../src/analyzer/capabilityAnalyzer';
import { extensionFromFixture } from '../helpers';

describe('capabilityAnalyzer', () => {
  it('detects process-related capabilities from tasks and terminals', () => {
    const extension = extensionFromFixture('tasks-extension.json');
    const counts = analyzeCapabilities(extension, []);
    expect(counts.tasks).toBeGreaterThan(0);
    expect(counts.terminal).toBeGreaterThan(0);
    expect(counts.process).toBeGreaterThan(0);
    expect(hasCapability(counts, 'process')).toBe(true);
  });

  it('detects authentication capabilities', () => {
    const extension = extensionFromFixture('auth-extension.json');
    const counts = analyzeCapabilities(extension, []);
    expect(counts.authentication).toBeGreaterThan(0);
  });

  it('detects webview capabilities', () => {
    const extension = extensionFromFixture('webview-extension.json');
    const counts = analyzeCapabilities(extension, []);
    expect(counts.webview).toBeGreaterThan(0);
  });

  it('counts network findings when present', () => {
    const extension = extensionFromFixture('network-extension.json');
    const counts = analyzeCapabilities(extension, [
      {
        id: 'network-indicated',
        severity: 'medium',
        title: 'Network capability/functionality indicated',
        evidence: ['configuration:network.endpoint'],
        explanation: '',
        recommendation: '',
        confidence: 'medium',
        detectionSource: 'test',
        category: 'network',
      },
    ]);
    expect(counts.network).toBeGreaterThan(0);
  });
});
