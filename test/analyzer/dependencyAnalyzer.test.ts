import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyzeDependencies, satisfiesRangeLocally } from '../../src/analyzer/dependencyAnalyzer';
import { emptyExtension } from '../helpers';

describe('dependencyAnalyzer', () => {
  it('reports that vulnerability status was not checked', async () => {
    const overview = await analyzeDependencies(
      emptyExtension({
        dependencies: { leftpad: '1.0.0' },
      }),
    );
    expect(overview.vulnerabilityStatus).toBe('Vulnerability status not checked.');
    expect(overview.directDependencies).toHaveLength(1);
  });

  it('reads a local lockfile without installing anything', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'esi-'));
    writeFileSync(
      path.join(dir, 'package-lock.json'),
      JSON.stringify({
        packages: {
          '': { version: '1.0.0' },
          'node_modules/leftpad': { version: '1.0.1' },
        },
      }),
    );
    const overview = await analyzeDependencies(
      emptyExtension({
        extensionPath: dir,
        dependencies: { leftpad: '^1.0.0' },
      }),
    );
    expect(overview.lockfilePresent).toBe(true);
    expect(overview.directDependencies[0]?.locked).toBe('1.0.1');
  });

  it('compares simple local version ranges', () => {
    expect(satisfiesRangeLocally('^1.2.3', '1.4.0')).toBe(true);
    expect(satisfiesRangeLocally('1.2.3', '1.2.3')).toBe(true);
    expect(satisfiesRangeLocally('~1.2.3', '1.2.9')).toBe(true);
  });
});
