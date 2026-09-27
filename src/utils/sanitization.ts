const SECRET_PATTERNS: RegExp[] = [
  /\b(password|passwd|pwd|secret|token|api[_-]?key|authorization|bearer|cookie|credential)\b\s*[:=]\s*['"]?[^'"\s]+/gi,
  /\b(sk|pk|ghp|gho|ghu|ghs|ghr|xox[baprs]|AKIA)[A-Za-z0-9_-]{8,}/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

export function redactSecrets(value: string): string {
  let result = value;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function stripControlChars(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    const allowed = code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    if (allowed) {
      result += char;
    }
  }
  return result;
}

export function sanitizeLogText(value: unknown): string {
  const text = stripControlChars(stringifyUnknown(value));
  return redactSecrets(text).slice(0, 2000);
}

export function sanitizeReportText(value: unknown): string {
  const text = stripControlChars(stringifyUnknown(value));
  return redactSecrets(text).slice(0, 8000);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function stringifyUnknown(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((item): item is string => Boolean(item && item.trim())))];
}
