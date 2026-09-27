(function () {
  const vscode = acquireVsCodeApi();
  const main = document.getElementById('main');
  const restricted = document.getElementById('restricted');

  document.querySelectorAll('nav [data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-action');
      if (action === 'search') {
        const query = window.prompt(
          'Search extensions, publishers, commands, capabilities, or findings',
          '',
        );
        if (query !== null) {
          vscode.postMessage({ type: 'search', query });
        }
        return;
      }
      const type =
        action === 'overview'
          ? 'openOverview'
          : action === 'reports'
            ? 'openReports'
            : action === 'privacy'
              ? 'openPrivacy'
              : action;
      vscode.postMessage({ type });
    });
  });

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'render' || !data.payload) {
      return;
    }
    render(data.payload);
  });

  function render(payload) {
    if (restricted) {
      restricted.classList.toggle(
        'hidden',
        !payload.summary || !payload.summary.restrictedModeNotice,
      );
      if (payload.summary && payload.summary.restrictedModeNotice) {
        restricted.textContent = payload.summary.restrictedModeNotice;
      }
    }
    if (payload.empty) {
      main.innerHTML = cardPage(
        'Security overview',
        `<p>${escape(payload.title)}</p><p><button type="button" data-msg='{"type":"refresh"}'>Run Audit</button></p>`,
      );
      bind(main);
      return;
    }
    switch (payload.view) {
      case 'overview':
        main.innerHTML = renderOverview(payload.summary);
        break;
      case 'detail':
        main.innerHTML = payload.missing
          ? `<h2>Extension not found</h2><p>${escape(payload.extensionId)}</p>`
          : renderDetail(payload.detail);
        break;
      case 'compare':
        main.innerHTML = renderCompare(payload.extensions || []);
        break;
      case 'search':
        main.innerHTML = renderSearch(payload);
        break;
      case 'capability':
        main.innerHTML = renderCapability(payload);
        break;
      case 'reports':
        main.innerHTML = renderReports(payload);
        break;
      case 'privacy':
        main.innerHTML = renderPrivacy();
        break;
      default:
        main.innerHTML = '<p>Unknown view.</p>';
    }
    bind(main);
  }

  function renderOverview(summary) {
    const totals = summary.totals;
    const cards = [
      ['Extensions', totals.extensions],
      ['Enabled', totals.enabled],
      ['Third-party', totals.thirdParty],
      ['Built-in', totals.builtin],
      ['Review recommended', totals.reviewRecommended],
      ['High attention', totals.highAttention],
      ['Unknown', totals.unknown],
    ]
      .map(
        ([label, value]) =>
          `<article class="card"><div class="label">${escape(label)}</div><div class="value">${escape(String(value))}</div></article>`,
      )
      .join('');
    const capabilityCards = Object.entries(summary.capabilities)
      .map(
        ([key, value]) =>
          `<article class="card"><div class="label">${escape(capitalize(key))}</div><div class="value">${escape(String(value))}</div></article>`,
      )
      .join('');
    return `
      <h2>Security overview</h2>
      <p class="meta">This summary represents detected capabilities and review indicators. It is not a malware verdict.</p>
      <div class="grid">${cards}</div>
      <h3>Capability indicators</h3>
      <div class="grid">${capabilityCards}</div>
      <h3>Review findings</h3>
      <p>High attention: ${escape(String(summary.findings.high))} · Medium attention: ${escape(String(summary.findings.medium))} · Low attention: ${escape(String(summary.findings.low))}</p>
      ${renderInventory(summary.extensions, true)}
    `;
  }

  function renderInventory(extensions, selectable) {
    const rows = extensions
      .map((item) => {
        const compare = selectable
          ? `<label><input type="checkbox" data-compare="${escapeAttr(item.id)}"> Compare</label>`
          : '';
        return `<tr>
          <td><button class="linkish" type="button" data-msg='${escapeAttr(JSON.stringify({ type: 'openExtension', extensionId: item.id }))}'>${escape(item.displayName)}</button></td>
          <td>${escape(item.publisher)}</td>
          <td>${escape(item.version)}</td>
          <td>${escape(item.attention)}</td>
          <td>${compare}</td>
        </tr>`;
      })
      .join('');
    return `
      <div class="toolbar">
        <label>Filter <input type="search" id="filter" placeholder="Filter inventory"></label>
        <button type="button" class="ghost" id="compare-selected">Compare selected</button>
      </div>
      <table>
        <thead><tr><th>Extension</th><th>Publisher</th><th>Version</th><th>Attention</th><th></th></tr></thead>
        <tbody id="inventory">${rows}</tbody>
      </table>
    `;
  }

  function renderDetail(detail) {
    const capabilityRows = Object.entries(detail.capabilities)
      .map(
        ([key, count]) =>
          `<tr><th>${escape(capitalize(key))}</th><td>${count > 0 ? 'Review' : 'None detected'}</td></tr>`,
      )
      .join('');
    const why =
      (detail.whyReview || []).map((item) => `<li>${escape(item)}</li>`).join('') ||
      '<li>No medium or high attention capability indicators were generated.</li>';
    const commands = (detail.commands || [])
      .map(
        (item) =>
          `<tr><td>${escape(item.command)}</td><td>${escape(item.title || '')}</td><td>${escape(item.category || '')}</td><td>${escape(item.keybinding || 'Not declared')}</td></tr>`,
      )
      .join('');
    const config = (detail.configuration || [])
      .map((item) => {
        const flags = (item.sensitiveIndicators || []).join(', ');
        return `<tr><td>${escape(item.key)}</td><td>${escape(item.type || '')}</td><td>${escape(flags || 'None highlighted')}</td></tr>`;
      })
      .join('');
    const findings = (detail.findings || [])
      .map(
        (item) => `<article class="card">
          <h3>${escape(item.title)}</h3>
          <p><span class="pill">${escape(item.severity)}</span><span class="pill">Confidence: ${escape(item.confidence)}</span></p>
          <p>${escape(item.explanation)}</p>
          <p class="meta">Evidence: ${escape((item.evidence || []).join('; ') || 'Declared metadata')}</p>
          <p>${escape(item.recommendation)}</p>
          <p class="meta">Source: ${escape(item.detectionSource)}</p>
        </article>`,
      )
      .join('');
    const deps = detail.dependencyOverview
      ? `<p>${escape(detail.dependencyOverview.note)}</p><p>${escape(detail.dependencyOverview.vulnerabilityStatus)}</p><p>Direct dependencies: ${detail.dependencyOverview.directDependencies.length}. Count: ${detail.dependencyOverview.dependencyCount}.</p>`
      : '<p>Dependency scan is optional and currently not attached to this result.</p>';
    return `
      <p class="eyebrow">${escape(detail.id)}</p>
      <h2>${escape(detail.displayName)}</h2>
      <p>Publisher: ${escape(detail.publisher)} · Version: ${escape(detail.version)} · Status: ${escape(detail.status)} · ${detail.builtin ? 'Built-in' : 'Third-party'}</p>
      <p>${escape(detail.description || 'No description declared.')}</p>
      <h3>Security overview</h3>
      <table>${capabilityRows}</table>
      <h3>Why this needs review</h3>
      <ul>${why}</ul>
      <h3>Findings</h3>
      <div class="stack">${findings}</div>
      <h3>Declared capabilities</h3>
      ${sectionList('Activation Events', detail.activationEvents)}
      <h4>Commands</h4>
      <table><thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Keybinding</th></tr></thead><tbody>${commands || '<tr><td colspan="4">None declared</td></tr>'}</tbody></table>
      <h4>Configuration</h4>
      <table><thead><tr><th>Key</th><th>Type</th><th>Review notes</th></tr></thead><tbody>${config || '<tr><td colspan="3">None declared</td></tr>'}</tbody></table>
      ${sectionList('Languages', detail.languages)}
      ${sectionList('Language providers', detail.languageProviders)}
      ${sectionList('Tasks', detail.tasks)}
      ${sectionList('Debuggers', detail.debuggers)}
      ${sectionList('Terminals', detail.terminals)}
      ${sectionList('Authentication', detail.authentication)}
      ${sectionList('Webviews', detail.webviews)}
      ${sectionList('Snippets', detail.snippets)}
      ${sectionList('Themes', detail.themes)}
      ${sectionList('File-system providers', detail.fileSystemProviders)}
      ${sectionList('Other contribution points', detail.other)}
      <h3>Metadata</h3>
      <ul>
        <li>Repository: ${linkOrText(detail.repository)}</li>
        <li>Homepage: ${linkOrText(detail.homepage)}</li>
        <li>Marketplace: ${linkOrText(detail.marketplaceUrl)}</li>
        <li>Installation: ${escape(detail.installation || 'Not available')}</li>
      </ul>
      <h3>Dependencies</h3>
      ${deps}
      <h3>Limitations</h3>
      <p>This audit is based on locally available metadata and static analysis. It cannot prove that an extension is safe or malicious.</p>
    `;
  }

  function renderCompare(extensions) {
    if (!extensions.length) {
      return '<h2>Comparison</h2><p>Select two or more extensions to compare declared capabilities.</p>';
    }
    const cards = extensions
      .map((item) => {
        const caps = Object.entries(item.capabilities)
          .map(
            ([key, count]) =>
              `<li>${escape(capitalize(key))}: ${count > 0 ? 'detected / indicated' : 'none detected'}</li>`,
          )
          .join('');
        return `<article class="card"><h3>${escape(item.displayName)}</h3><p class="meta">${escape(item.attention)}</p><ul>${caps}</ul></article>`;
      })
      .join('');
    return `<h2>Comparison</h2><p>The comparison is descriptive. It does not label one extension as better or safer.</p><div class="compare">${cards}</div>`;
  }

  function renderSearch(payload) {
    const count = (payload.results || []).length;
    return `<h2>Search</h2><p>${escape(String(count))} result(s) for “${escape(payload.query || '')}”.</p>${renderInventory(payload.results || [], false)}`;
  }

  function renderCapability(payload) {
    return `<h2>${escape(payload.label || 'Capability')}</h2><p>Extensions with this declared or indicated capability:</p>${renderInventory(payload.results || [], false)}`;
  }

  function renderReports(payload) {
    const history = (payload.history || [])
      .map(
        (item) =>
          `<tr><td>${escape(item.timestamp)}</td><td>${escape(String(item.totalExtensions))}</td><td>${escape(String(item.reviewRecommended))}</td><td>${escape(String(item.highAttention))}</td></tr>`,
      )
      .join('');
    return `
      <h2>Reports</h2>
      <p>Export a local report. Reports never include secrets, source code, or workspace files.</p>
      <div class="toolbar">
        <button type="button" data-msg='{"type":"export","format":"markdown"}'>Export Markdown</button>
        <button type="button" data-msg='{"type":"export","format":"json"}'>Export JSON</button>
        <button type="button" data-msg='{"type":"export","format":"html"}'>Export HTML</button>
      </div>
      <h3>Audit history</h3>
      <table><thead><tr><th>Generated</th><th>Extensions</th><th>Review</th><th>High attention</th></tr></thead><tbody>${history || '<tr><td colspan="4">No audits stored yet.</td></tr>'}</tbody></table>
    `;
  }

  function renderPrivacy() {
    return `
      <h2>Privacy</h2>
      <p>Default behavior: <strong>LOCAL ONLY</strong>.</p>
      <p>This extension does not send source code, extension source, workspace files, credentials, environment variables, tokens, or telemetry to external servers.</p>
      <p>No telemetry is enabled by default. If analytics are added later, they must be explicitly opt-in and documented.</p>
      <p>This tool does not disable Workspace Trust, intercept credentials, modify other extensions, or change VS Code security settings automatically.</p>
    `;
  }

  function sectionList(title, values) {
    const items = (values || []).map((item) => `<li>${escape(String(item))}</li>`).join('');
    return `<h4>${escape(title)}</h4><ul>${items || '<li>None declared</li>'}</ul>`;
  }

  function cardPage(title, body) {
    return `<h2>${escape(title)}</h2>${body}`;
  }

  function bind(root) {
    root.querySelectorAll('[data-msg]').forEach((node) => {
      node.addEventListener('click', () => {
        try {
          vscode.postMessage(JSON.parse(node.getAttribute('data-msg') || '{}'));
        } catch {
          return;
        }
      });
    });
    const filter = root.querySelector('#filter');
    const inventory = root.querySelector('#inventory');
    if (filter && inventory) {
      filter.addEventListener('input', () => {
        const needle = filter.value.toLowerCase();
        inventory.querySelectorAll('tr').forEach((row) => {
          row.style.display = row.textContent.toLowerCase().includes(needle) ? '' : 'none';
        });
      });
    }
    const compare = root.querySelector('#compare-selected');
    if (compare) {
      compare.addEventListener('click', () => {
        const extensionIds = [...root.querySelectorAll('input[data-compare]:checked')].map(
          (input) => input.getAttribute('data-compare'),
        );
        vscode.postMessage({ type: 'compare', extensionIds });
      });
    }
  }

  function linkOrText(value) {
    if (!value) {
      return 'Not declared';
    }
    if (/^https?:\/\//i.test(value)) {
      return `<a href="${escapeAttr(value)}">${escape(value)}</a>`;
    }
    return escape(value);
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function escape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escape(value).replace(/`/g, '&#96;');
  }

  vscode.postMessage({ type: 'ready' });
})();
