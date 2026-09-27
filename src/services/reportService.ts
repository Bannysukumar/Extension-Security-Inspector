import type { AuditResult, AuditSummary } from '../models/AuditResult';
import { CAPABILITY_LABELS, type CapabilityKind } from '../models/Capability';
import { escapeHtml, sanitizeReportText } from '../utils/sanitization';
import { severityLabel } from '../utils/severity';

export type ReportFormat = 'json' | 'markdown' | 'html';

export function renderReport(summary: AuditSummary, format: ReportFormat): string {
  switch (format) {
    case 'json':
      return renderJson(summary);
    case 'html':
      return renderHtml(summary);
    default:
      return renderMarkdown(summary);
  }
}

export function renderJson(summary: AuditSummary): string {
  const sanitized = sanitizeSummary(summary);
  return `${JSON.stringify(sanitized, null, 2)}\n`;
}

export function renderMarkdown(summary: AuditSummary): string {
  const lines: string[] = [
    '# VS Code Extension Security Audit',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Summary',
    '',
    `Installed extensions: ${summary.totalExtensions}`,
    `Enabled: ${summary.enabled}`,
    `Disabled: ${summary.disabled}`,
    `Third-party: ${summary.thirdParty}`,
    `Built-in: ${summary.builtin}`,
    `Review recommended: ${summary.reviewRecommended}`,
    `High attention: ${summary.highAttention}`,
    `Unknown: ${summary.unknown}`,
    '',
    'This summary represents detected capabilities and review indicators. It is not a malware verdict.',
    '',
  ];

  if (summary.restrictedModeNotice) {
    lines.push(`> ${summary.restrictedModeNotice}`, '');
  }

  lines.push('## Capability indicators', '');
  for (const key of Object.keys(summary.capabilityTotals) as CapabilityKind[]) {
    lines.push(`- ${CAPABILITY_LABELS[key]}: ${summary.capabilityTotals[key]}`);
  }
  lines.push('', '## Extensions Requiring Review', '');

  const review = summary.results.filter((result) => result.reviewRecommended);
  if (review.length === 0) {
    lines.push(
      'No extensions were classified as requiring review based on declared capability indicators.',
      '',
    );
  } else {
    for (const result of review) {
      lines.push(...renderMarkdownExtension(result));
    }
  }

  lines.push('## All Extensions', '');
  for (const result of summary.results) {
    lines.push(
      `- ${result.extension.displayName} (${result.extension.id}) — ${severityLabel(result.attentionLevel)}`,
    );
  }

  lines.push('', '## Limitations', '');
  for (const limitation of summary.limitations) {
    lines.push(`- ${limitation}`);
  }
  lines.push('');
  return lines.map((line) => sanitizeReportText(line)).join('\n');
}

export function renderHtml(summary: AuditSummary): string {
  const review = summary.results.filter((result) => result.reviewRecommended);
  const capabilityRows = (Object.keys(summary.capabilityTotals) as CapabilityKind[])
    .map(
      (key) =>
        `<tr><th>${escapeHtml(CAPABILITY_LABELS[key])}</th><td>${summary.capabilityTotals[key]}</td></tr>`,
    )
    .join('');
  const reviewHtml = review.length
    ? review.map((result) => renderHtmlExtension(result)).join('')
    : '<p>No extensions were classified as requiring review based on declared capability indicators.</p>';
  const allRows = summary.results
    .map(
      (result) =>
        `<tr><td>${escapeHtml(result.extension.displayName)}</td><td>${escapeHtml(result.extension.id)}</td><td>${escapeHtml(severityLabel(result.attentionLevel))}</td></tr>`,
    )
    .join('');
  const limitations = summary.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const restricted = summary.restrictedModeNotice
    ? `<p><strong>${escapeHtml(summary.restrictedModeNotice)}</strong></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>VS Code Extension Security Audit</title>
  <style>
    body { font-family: Segoe UI, sans-serif; margin: 2rem; color: #122; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    .note { background: #f4f7fb; padding: 0.75rem 1rem; }
  </style>
</head>
<body>
  <h1>VS Code Extension Security Audit</h1>
  <p>Generated: ${escapeHtml(summary.generatedAt)}</p>
  ${restricted}
  <div class="note">This summary represents detected capabilities and review indicators. It is not a malware verdict.</div>
  <h2>Summary</h2>
  <ul>
    <li>Installed extensions: ${summary.totalExtensions}</li>
    <li>Enabled: ${summary.enabled}</li>
    <li>Third-party: ${summary.thirdParty}</li>
    <li>Built-in: ${summary.builtin}</li>
    <li>Review recommended: ${summary.reviewRecommended}</li>
    <li>High attention: ${summary.highAttention}</li>
  </ul>
  <h2>Capability indicators</h2>
  <table>${capabilityRows}</table>
  <h2>Extensions Requiring Review</h2>
  ${reviewHtml}
  <h2>All Extensions</h2>
  <table><thead><tr><th>Name</th><th>ID</th><th>Attention</th></tr></thead><tbody>${allRows}</tbody></table>
  <h2>Limitations</h2>
  <ul>${limitations}</ul>
</body>
</html>
`;
}

function renderMarkdownExtension(result: AuditResult): string[] {
  const ext = result.extension;
  const lines = [
    `### ${ext.displayName}`,
    '',
    `Publisher: ${ext.publisher}`,
    `Version: ${ext.version}`,
    `Status: ${ext.enabled ? 'Enabled' : 'Disabled'}`,
    `Type: ${ext.isBuiltin ? 'Built-in' : 'Third-party'}`,
    '',
    'Findings:',
    '',
  ];
  for (const finding of result.findings.filter((item) => item.severity !== 'informational')) {
    lines.push(`* ${finding.title}`);
    lines.push('');
    lines.push(`Explanation: ${finding.explanation}`);
    lines.push('');
  }
  return lines;
}

function renderHtmlExtension(result: AuditResult): string {
  const ext = result.extension;
  const findings = result.findings
    .filter((item) => item.severity !== 'informational')
    .map(
      (finding) =>
        `<li><strong>${escapeHtml(finding.title)}</strong><p>${escapeHtml(finding.explanation)}</p></li>`,
    )
    .join('');
  return `<section>
    <h3>${escapeHtml(ext.displayName)}</h3>
    <p>Publisher: ${escapeHtml(ext.publisher)}<br>Version: ${escapeHtml(ext.version)}</p>
    <ul>${findings}</ul>
  </section>`;
}

function sanitizeSummary(summary: AuditSummary): AuditSummary {
  const cleaned = sanitizeValue(summary);
  if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) {
    return {
      ...summary,
      results: [],
      limitations: summary.limitations.map((item) => sanitizeReportText(item)),
    };
  }
  return cleaned as AuditSummary;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeReportText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[sanitizeReportText(key)] = sanitizeValue(item);
    }
    return result;
  }
  return value;
}

export function isReportFormat(value: unknown): value is ReportFormat {
  return value === 'json' || value === 'markdown' || value === 'html';
}

export function fileExtensionFor(format: ReportFormat): string {
  switch (format) {
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    default:
      return 'md';
  }
}
