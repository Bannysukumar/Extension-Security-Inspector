import { escapeHtml, redactSecrets, sanitizeLogText } from '../../src/utils/sanitization';

describe('sanitization', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('xss')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;',
    );
  });

  it('redacts common secret patterns from logs', () => {
    const redacted = sanitizeLogText('password=supersecret token=abcdEFGH1234');
    expect(redacted).not.toContain('supersecret');
    expect(redacted).not.toContain('abcdEFGH1234');
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts jwt-like values', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.signaturevaluehere';
    expect(redactSecrets(jwt)).toContain('[REDACTED]');
  });
});
