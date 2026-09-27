import { parseIncomingMessage } from '../../src/webview/messages';

describe('webview message validation', () => {
  it('accepts known messages', () => {
    expect(parseIncomingMessage({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(parseIncomingMessage({ type: 'openExtension', extensionId: 'a.b' })).toEqual({
      type: 'openExtension',
      extensionId: 'a.b',
    });
    expect(parseIncomingMessage({ type: 'export', format: 'markdown' })?.type).toBe('export');
  });

  it('rejects unknown or malformed messages', () => {
    expect(parseIncomingMessage(undefined)).toBeUndefined();
    expect(parseIncomingMessage({ type: 'explode' })).toBeUndefined();
    expect(parseIncomingMessage({ type: 'openExtension' })).toBeUndefined();
    expect(parseIncomingMessage({ type: 'export', format: 'exe' })).toBeUndefined();
    expect(parseIncomingMessage({ type: 'compare', extensionIds: [1, 2] })).toEqual({
      type: 'compare',
      extensionIds: [],
    });
  });

  it('limits search query length', () => {
    const query = 'n'.repeat(500);
    const parsed = parseIncomingMessage({ type: 'search', query });
    expect(parsed && parsed.type === 'search' ? parsed.query.length : 0).toBe(200);
  });
});
