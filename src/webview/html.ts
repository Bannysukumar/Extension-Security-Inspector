import { randomBytes } from 'node:crypto';
import type { Webview } from 'vscode';
import { LIMITATIONS, RESTRICTED_MODE_NOTICE } from '../constants';
import { escapeAttribute, escapeHtml } from '../utils/sanitization';

export function getNonce(): string {
  return randomBytes(16).toString('base64url');
}

export function renderWebviewHtml(
  webview: Webview,
  options: { scriptUri: string; styleUri: string; nonce: string },
): string {
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${options.nonce}'`,
    `font-src ${webview.cspSource}`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Security Inspector</title>
  <link rel="stylesheet" href="${escapeAttribute(options.styleUri)}">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <div>
      <p class="eyebrow">Local audit</p>
      <h1>Extension Security Inspector</h1>
    </div>
    <nav aria-label="Inspector actions">
      <button type="button" data-action="overview">Overview</button>
      <button type="button" data-action="search">Search</button>
      <button type="button" data-action="reports">Reports</button>
      <button type="button" data-action="privacy">Privacy</button>
      <button type="button" data-action="refresh">Refresh</button>
    </nav>
  </header>
  <p id="restricted" class="banner hidden" role="status">${escapeHtml(RESTRICTED_MODE_NOTICE)}</p>
  <main id="main" tabindex="-1"></main>
  <footer>
    <p>${escapeHtml(LIMITATIONS[0])}</p>
  </footer>
  <script nonce="${options.nonce}" src="${escapeAttribute(options.scriptUri)}"></script>
</body>
</html>`;
}
