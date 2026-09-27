import { getNonce } from '../../src/webview/html';

describe('webview html helpers', () => {
  it('generates unique nonces', () => {
    const first = getNonce();
    const second = getNonce();
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(16);
  });
});
